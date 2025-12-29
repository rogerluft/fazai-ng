/**
 * JSON Block Storage Backend
 *
 * Backend simples baseado em arquivo JSON.
 * SEM embeddings - usa Jaccard similarity para matching.
 * Ideal para desenvolvimento e testes.
 *
 * @module agentic/block-storage/json-backend
 */

import { BlockStorageBackend, ExecutionBlock, BlockMatch, CleanupOptions, SystemContext } from "./types";
import { getConfigValue } from "../../config";
import { logger } from "../../logger";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

/**
 * Backend JSON simples - SEM embeddings
 * Usa busca por keywords/fuzzy matching
 */
export class JsonBlockStorage implements BlockStorageBackend {
  private filePath: string;
  private blocks: Map<string, ExecutionBlock> = new Map();
  private loaded = false;

  constructor(filePath?: string) {
    this.filePath = filePath
      || getConfigValue("EXECUTION_BLOCKS_PATH")
      || "/opt/fazai/data/execution-blocks.json";
  }

  /**
   * Carrega blocos do arquivo (lazy loading)
   */
  private ensureLoaded(): void {
    if (this.loaded) return;

    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
        // Suporta tanto objeto quanto array
        if (Array.isArray(data)) {
          for (const block of data) {
            this.blocks.set(block.block_id, block);
          }
        } else {
          this.blocks = new Map(Object.entries(data));
        }
        logger.debug(`Loaded ${this.blocks.size} execution blocks from JSON`);
      }
    } catch (error) {
      logger.warn(`Failed to load blocks from ${this.filePath}:`, error);
    }

    this.loaded = true;
  }

  /**
   * Persiste blocos no arquivo
   */
  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.blocks);
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(`Failed to save blocks to ${this.filePath}:`, error);
    }
  }

  /**
   * Tokeniza texto para Jaccard similarity
   */
  private tokenize(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  }

  /**
   * Calcula Jaccard similarity entre dois conjuntos
   */
  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    const intersection = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Verifica se bloco é compatível com contexto
   */
  private isContextCompatible(block: ExecutionBlock, context?: SystemContext): boolean {
    if (!context || !block.context_requirements) {
      return true; // Sem requisitos = compatível
    }

    const req = block.context_requirements;

    // Verifica OS
    if (req.os && req.os.length > 0) {
      if (!req.os.includes(context.os)) {
        return false;
      }
    }

    // Verifica package manager
    if (req.pkg_manager && req.pkg_manager.length > 0) {
      if (!req.pkg_manager.includes(context.pkg_manager)) {
        return false;
      }
    }

    // Verifica root
    if (req.requires_root && !context.is_root) {
      return false;
    }

    return true;
  }

  async findSimilar(
    intent: string,
    context?: SystemContext,
    threshold = 0.5,
    limit = 5
  ): Promise<BlockMatch[]> {
    this.ensureLoaded();

    const results: BlockMatch[] = [];
    const intentWords = this.tokenize(intent);

    for (const block of this.blocks.values()) {
      // Verifica compatibilidade de contexto
      if (!this.isContextCompatible(block, context)) {
        continue;
      }

      const blockWords = this.tokenize(block.intent);
      const similarity = this.jaccardSimilarity(intentWords, blockWords);

      if (similarity >= threshold) {
        results.push({ block, similarity });
      }
    }

    // Ordena por similaridade decrescente, depois por success_rate
    results.sort((a, b) => {
      if (Math.abs(b.similarity - a.similarity) > 0.05) {
        return b.similarity - a.similarity;
      }
      return b.block.stats.success_rate - a.block.stats.success_rate;
    });

    return results.slice(0, limit);
  }

  async save(block: Omit<ExecutionBlock, "block_id">): Promise<string> {
    this.ensureLoaded();

    // Verifica deduplicação (threshold alto para evitar duplicatas)
    const similar = await this.findSimilar(block.intent, undefined, 0.85, 1);
    if (similar.length > 0) {
      logger.debug(`Block already exists: ${similar[0].block.block_id} (similarity: ${similar[0].similarity.toFixed(2)})`);
      // Incrementa times_used do bloco existente
      await this.updateStats(similar[0].block.block_id, true);
      return similar[0].block.block_id;
    }

    const blockId = randomUUID();
    const fullBlock: ExecutionBlock = {
      ...block,
      block_id: blockId,
      stats: {
        times_used: block.stats?.times_used ?? 1,
        success_rate: block.stats?.success_rate ?? 1.0,
        last_used: new Date().toISOString(),
        learned_from: block.stats?.learned_from ?? [],
      },
    };

    this.blocks.set(blockId, fullBlock);
    this.persist();

    logger.info(`💾 Saved new execution block: ${blockId} ("${block.intent.substring(0, 50)}")`);
    return blockId;
  }

  async updateStats(blockId: string, wasSuccessful: boolean): Promise<void> {
    this.ensureLoaded();

    const block = this.blocks.get(blockId);
    if (!block) return;

    block.stats.times_used++;
    block.stats.last_used = new Date().toISOString();

    // Ajusta success_rate incrementalmente (exponential moving average)
    const weight = 0.1; // Peso da nova observação
    block.stats.success_rate =
      block.stats.success_rate * (1 - weight) + (wasSuccessful ? 1 : 0) * weight;

    this.blocks.set(blockId, block);
    this.persist();
  }

  async getById(blockId: string): Promise<ExecutionBlock | null> {
    this.ensureLoaded();
    return this.blocks.get(blockId) || null;
  }

  async listAll(limit = 100): Promise<ExecutionBlock[]> {
    this.ensureLoaded();

    const blocks = Array.from(this.blocks.values());

    // Ordena por times_used decrescente
    blocks.sort((a, b) => b.stats.times_used - a.stats.times_used);

    return blocks.slice(0, limit);
  }

  async cleanup(options: CleanupOptions = {}): Promise<number> {
    this.ensureLoaded();

    const { maxAgeDays = 90, minSuccessRate = 0.3 } = options;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    let removed = 0;

    for (const [id, block] of this.blocks) {
      const lastUsed = block.stats.last_used
        ? new Date(block.stats.last_used)
        : new Date(0);

      const shouldRemove =
        lastUsed < cutoffDate || block.stats.success_rate < minSuccessRate;

      if (shouldRemove) {
        this.blocks.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.persist();
      logger.info(`🧹 Cleaned up ${removed} execution blocks`);
    }

    return removed;
  }

  async count(): Promise<number> {
    this.ensureLoaded();
    return this.blocks.size;
  }
}
