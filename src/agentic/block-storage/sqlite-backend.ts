/**
 * SQLite Block Storage Backend
 *
 * Backend robusto baseado em SQLite.
 * Suporta busca por keywords (FTS5) e busca semântica (embeddings em BLOB).
 * Ideal para uso local persistente.
 *
 * @module agentic/block-storage/sqlite-backend
 */

import { BlockStorageBackend, ExecutionBlock, BlockMatch, CleanupOptions, SystemContext } from "./types";
import { getConfigValue } from "../../config";
import { logger } from "../../logger";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/**
 * Backend SQLite - Intermediário entre JSON e Qdrant
 */
export class SqliteBlockStorage implements BlockStorageBackend {
  private db: Database.Database;
  private initialized = false;

  constructor(dbPath?: string) {
    const defaultPath = path.join(process.cwd(), "data", "execution-blocks.sqlite");
    const finalPath = dbPath || getConfigValue("EXECUTION_BLOCKS_SQLITE_PATH") || defaultPath;

    // Garante que o diretório existe
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(finalPath);
    this.ensureInitialized();
  }

  /**
   * Inicializa schema do banco
   */
  private ensureInitialized(): void {
    if (this.initialized) return;

    try {
      // Cria tabela principal
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS execution_blocks (
          block_id TEXT PRIMARY KEY,
          intent TEXT NOT NULL,
          intent_embedding BLOB,
          data JSON NOT NULL,
          times_used INTEGER DEFAULT 1,
          success_rate REAL DEFAULT 1.0,
          last_used TEXT,
          os_requirements TEXT, -- JSON array
          pkg_manager_requirements TEXT -- JSON array
        )
      `);

      // Índice para busca rápida
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_intent ON execution_blocks(intent)`);

      // Registra função de similaridade de cosseno (opcional, para busca em SQL)
      this.db.function("cosine_similarity", (a: Buffer, b: Buffer) => {
        if (!a || !b) return 0;
        const vecA = new Float32Array(a.buffer, a.byteOffset, a.byteLength / 4);
        const vecB = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
          dotProduct += vecA[i] * vecB[i];
          normA += vecA[i] * vecA[i];
          normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      });

      this.initialized = true;
      logger.debug("SQLite Block Storage initialized");
    } catch (error) {
      logger.error("Failed to initialize SQLite storage:", error);
      throw error;
    }
  }

  /**
   * Gera embedding para texto
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const { createEmbeddingService } = await import("../../services/embeddings");
      const embeddingService = await createEmbeddingService();
      return await embeddingService.generate(text);
    } catch (error) {
      logger.warn("Failed to generate embedding, falling back to keyword search:", error);
      return [];
    }
  }

  /**
   * Converte number[] para Buffer para o SQLite
   */
  private vectorToBuffer(vector: number[]): Buffer {
    return Buffer.from(new Float32Array(vector).buffer);
  }

  /**
   * Converte Buffer para number[]
   */
  private bufferToVector(buffer: Buffer): number[] {
    return Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4));
  }

  /**
   * Verifica se bloco é compatível com contexto
   */
  private isContextCompatible(block: ExecutionBlock, context?: SystemContext): boolean {
    if (!context || !block.context_requirements) {
      return true;
    }

    const req = block.context_requirements;

    if (req.os && req.os.length > 0 && !req.os.includes(context.os)) {
      return false;
    }

    if (req.pkg_manager && req.pkg_manager.length > 0 && !req.pkg_manager.includes(context.pkg_manager)) {
      return false;
    }

    if (req.requires_root && !context.is_root) {
      return false;
    }

    return true;
  }

  async findSimilar(
    intent: string,
    context?: SystemContext,
    threshold = 0.7,
    limit = 5
  ): Promise<BlockMatch[]> {
    const embedding = await this.generateEmbedding(intent);

    if (embedding.length > 0) {
      // Busca semântica usando a função customizada
      const embeddingBuffer = this.vectorToBuffer(embedding);
      const stmt = this.db.prepare(`
        SELECT *, cosine_similarity(intent_embedding, ?) as similarity
        FROM execution_blocks
        WHERE intent_embedding IS NOT NULL AND similarity >= ?
        ORDER BY similarity DESC
        LIMIT ?
      `);

      const rows = stmt.all(embeddingBuffer, threshold, limit * 2) as any[];

      const matches: BlockMatch[] = [];
      for (const row of rows) {
        const block = JSON.parse(row.data) as ExecutionBlock;
        if (this.isContextCompatible(block, context)) {
          matches.push({
            block,
            similarity: row.similarity
          });
        }
        if (matches.length >= limit) break;
      }
      return matches;
    } else {
      // Fallback para busca por LIKE (muito simples) ou Jaccard em JS
      // Vamos carregar e fazer Jaccard como no JSON se não houver embeddings
      const rows = this.db.prepare("SELECT data FROM execution_blocks").all() as any[];
      const results: BlockMatch[] = [];

      // Funções auxiliares de Jaccard (copiadas do JsonBlockStorage para consistência)
      const tokenize = (text: string) => new Set(text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 2));
      const jaccard = (a: Set<string>, b: Set<string>) => {
        const intersection = new Set([...a].filter(x => b.has(x)));
        const union = new Set([...a, ...b]);
        return union.size > 0 ? intersection.size / union.size : 0;
      };

      const intentWords = tokenize(intent);
      for (const row of rows) {
        const block = JSON.parse(row.data) as ExecutionBlock;
        if (!this.isContextCompatible(block, context)) continue;

        const blockWords = tokenize(block.intent);
        const similarity = jaccard(intentWords, blockWords);

        if (similarity >= threshold) {
          results.push({ block, similarity });
        }
      }

      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, limit);
    }
  }

  async save(block: Omit<ExecutionBlock, "block_id">): Promise<string> {
    // Verifica deduplicação
    const similar = await this.findSimilar(block.intent, undefined, 0.90, 1);
    if (similar.length > 0) {
      await this.updateStats(similar[0].block.block_id, true);
      return similar[0].block.block_id;
    }

    const blockId = randomUUID();
    const embedding = await this.generateEmbedding(block.intent);

    const fullBlock: ExecutionBlock = {
      ...block,
      block_id: blockId,
      intent_embedding: embedding.length > 0 ? embedding : undefined,
      stats: {
        times_used: block.stats?.times_used ?? 1,
        success_rate: block.stats?.success_rate ?? 1.0,
        last_used: new Date().toISOString(),
        learned_from: block.stats?.learned_from ?? [],
      },
    };

    const stmt = this.db.prepare(`
      INSERT INTO execution_blocks (
        block_id, intent, intent_embedding, data, times_used, success_rate, last_used, os_requirements, pkg_manager_requirements
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      blockId,
      fullBlock.intent,
      fullBlock.intent_embedding ? this.vectorToBuffer(fullBlock.intent_embedding) : null,
      JSON.stringify(fullBlock),
      fullBlock.stats.times_used,
      fullBlock.stats.success_rate,
      fullBlock.stats.last_used,
      JSON.stringify(fullBlock.context_requirements?.os || []),
      JSON.stringify(fullBlock.context_requirements?.pkg_manager || [])
    );

    logger.info(`💾 Saved execution block (SQLite): ${blockId}`);
    return blockId;
  }

  async updateStats(blockId: string, wasSuccessful: boolean): Promise<void> {
    const row = this.db.prepare("SELECT data, times_used, success_rate FROM execution_blocks WHERE block_id = ?").get(blockId) as any;
    if (!row) return;

    const block = JSON.parse(row.data) as ExecutionBlock;
    const newTimesUsed = row.times_used + 1;
    const weight = 0.1;
    const newSuccessRate = row.success_rate * (1 - weight) + (wasSuccessful ? 1 : 0) * weight;
    const lastUsed = new Date().toISOString();

    block.stats.times_used = newTimesUsed;
    block.stats.success_rate = newSuccessRate;
    block.stats.last_used = lastUsed;

    const stmt = this.db.prepare(`
      UPDATE execution_blocks
      SET data = ?, times_used = ?, success_rate = ?, last_used = ?
      WHERE block_id = ?
    `);

    stmt.run(JSON.stringify(block), newTimesUsed, newSuccessRate, lastUsed, blockId);
  }

  async getById(blockId: string): Promise<ExecutionBlock | null> {
    const row = this.db.prepare("SELECT data FROM execution_blocks WHERE block_id = ?").get(blockId) as any;
    return row ? JSON.parse(row.data) : null;
  }

  async listAll(limit = 100): Promise<ExecutionBlock[]> {
    const rows = this.db.prepare("SELECT data FROM execution_blocks ORDER BY times_used DESC LIMIT ?").all(limit) as any[];
    return rows.map(r => JSON.parse(r.data));
  }

  async cleanup(options: CleanupOptions = {}): Promise<number> {
    const { maxAgeDays = 90, minSuccessRate = 0.3 } = options;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    const stmt = this.db.prepare(`
      DELETE FROM execution_blocks
      WHERE last_used < ? OR success_rate < ?
    `);

    const result = stmt.run(cutoffTimestamp, minSuccessRate);
    if (result.changes > 0) {
      logger.info(`🧹 Cleaned up ${result.changes} execution blocks (SQLite)`);
    }
    return result.changes;
  }

  async count(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM execution_blocks").get() as any;
    return row.count;
  }
}
