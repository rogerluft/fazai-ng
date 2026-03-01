/**
 * Qdrant Block Storage Backend
 *
 * Backend com busca semântica via Qdrant.
 * USA embeddings BGE-base-en-v1.5 (768 dim nativo - Lei 768).
 * Ideal para produção.
 *
 * @module agentic/block-storage/qdrant-backend
 */

import { BlockStorageBackend, ExecutionBlock, BlockMatch, CleanupOptions, SystemContext } from "./types";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getConfigValue } from "../../config";
import { logger } from "../../logger";
import { randomUUID } from "crypto";

const COLLECTION_NAME = "fazai_execution_blocks";
const VECTOR_SIZE = 768; // Native dimension (BGE-base-en-v1.5)

/**
 * Backend Qdrant - COM embeddings e busca semântica
 */
export class QdrantBlockStorage implements BlockStorageBackend {
  private client: QdrantClient;
  private initialized = false;

  constructor() {
    const url = getConfigValue("QDRANT_URL") || "http://localhost:6333";
    const apiKey = getConfigValue("QDRANT_API_KEY");

    this.client = new QdrantClient({
      url,
      apiKey: apiKey || undefined,
    });
  }

  /**
   * Garante que collection existe
   */
  private async ensureCollection(): Promise<void> {
    if (this.initialized) return;

    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

      if (!exists) {
        await this.client.createCollection(COLLECTION_NAME, {
          vectors: {
            size: VECTOR_SIZE,
            distance: "Cosine",
          },
        });
        logger.info(`✅ Created Qdrant collection: ${COLLECTION_NAME}`);
      }

      this.initialized = true;
    } catch (error) {
      logger.error(`Failed to initialize Qdrant collection: ${error}`);
      throw error;
    }
  }

  /**
   * Gera embedding para texto
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const { createEmbeddingService } = await import("../../services/embeddings");
    const embeddingService = await createEmbeddingService();
    return embeddingService.generate(text);
  }

  /**
   * Constrói filtro do Qdrant para contexto
   */
  private buildContextFilter(context?: SystemContext): object | undefined {
    if (!context) return undefined;

    const must: object[] = [];

    // Filtro por OS (OR dentro de um array)
    // Qdrant não suporta diretamente "match any of these values" em arrays aninhados
    // Usamos should para isso

    return must.length > 0 ? { must } : undefined;
  }

  async findSimilar(
    intent: string,
    context?: SystemContext,
    threshold = 0.75,
    limit = 5
  ): Promise<BlockMatch[]> {
    await this.ensureCollection();

    try {
      const embedding = await this.generateEmbedding(intent);

      const results = await this.client.search(COLLECTION_NAME, {
        vector: embedding,
        limit: limit * 2, // Busca mais para filtrar por contexto depois
        score_threshold: threshold,
        with_payload: true,
      });

      // Filtra por contexto manualmente (mais flexível que filtros Qdrant)
      const matches: BlockMatch[] = [];

      for (const point of results) {
        const block = point.payload as unknown as ExecutionBlock;

        // Verifica compatibilidade de contexto
        if (context && block.context_requirements) {
          const req = block.context_requirements;

          if (req.os && req.os.length > 0 && !req.os.includes(context.os)) {
            continue;
          }

          if (req.pkg_manager && req.pkg_manager.length > 0 && !req.pkg_manager.includes(context.pkg_manager)) {
            continue;
          }

          if (req.requires_root && !context.is_root) {
            continue;
          }
        }

        matches.push({
          block,
          similarity: point.score,
        });

        if (matches.length >= limit) break;
      }

      return matches;
    } catch (error) {
      logger.error(`Qdrant search failed: ${error}`);
      return [];
    }
  }

  async save(block: Omit<ExecutionBlock, "block_id">): Promise<string> {
    await this.ensureCollection();

    try {
      // Verifica deduplicação via busca semântica e hash de comandos/código
      const similar = await this.findSimilar(block.intent, undefined, 0.85, 5);

      if (similar.length > 0) {
        // Verifica se algum bloco similar tem exatamente os mesmos comandos
        const exactMatch = similar.find(s => {
          const sCmds = JSON.stringify(s.block.execution_steps || []);
          const bCmds = JSON.stringify(block.execution_steps || []);
          return sCmds === bCmds;
        });

        if (exactMatch || similar[0].similarity > 0.95) {
          const matchedBlock = exactMatch ? exactMatch.block : similar[0].block;
          logger.debug(`Block already exists (semantic/exact match): ${matchedBlock.block_id}`);
          await this.updateStats(matchedBlock.block_id, true);
          return matchedBlock.block_id;
        }
      }

      const blockId = randomUUID();
      const embedding = await this.generateEmbedding(block.intent);

      const fullBlock: ExecutionBlock = {
        ...block,
        block_id: blockId,
        intent_embedding: embedding,
        stats: {
          times_used: block.stats?.times_used ?? 1,
          success_rate: block.stats?.success_rate ?? 1.0,
          last_used: new Date().toISOString(),
          learned_from: block.stats?.learned_from ?? [],
        },
      };

      await this.client.upsert(COLLECTION_NAME, {
        points: [
          {
            id: blockId,
            vector: embedding,
            payload: fullBlock as unknown as Record<string, unknown>,
          },
        ],
      });

      logger.info(`💾 Saved execution block (Qdrant): ${blockId}`);
      return blockId;
    } catch (error) {
      logger.error(`Failed to save block to Qdrant: ${error}`);
      throw error;
    }
  }

  async updateStats(blockId: string, wasSuccessful: boolean): Promise<void> {
    await this.ensureCollection();

    try {
      // Busca bloco atual
      const results = await this.client.retrieve(COLLECTION_NAME, {
        ids: [blockId],
        with_payload: true,
      });

      if (results.length === 0) return;

      const block = results[0].payload as unknown as ExecutionBlock;

      // Atualiza stats
      const newTimesUsed = (block.stats?.times_used || 0) + 1;
      const currentRate = block.stats?.success_rate || 1.0;

      const weight = 0.1;
      const newSuccessRate =
        currentRate * (1 - weight) + (wasSuccessful ? 1 : 0) * weight;

      await this.client.setPayload(COLLECTION_NAME, {
        points: [blockId],
        payload: {
          stats: {
            times_used: newTimesUsed,
            success_rate: newSuccessRate,
            last_used: new Date().toISOString(),
            learned_from: block.stats?.learned_from || [],
          },
        },
      });
    } catch (error) {
      logger.error(`Failed to update block stats: ${error}`);
    }
  }

  async getById(blockId: string): Promise<ExecutionBlock | null> {
    await this.ensureCollection();

    try {
      const results = await this.client.retrieve(COLLECTION_NAME, {
        ids: [blockId],
        with_payload: true,
      });

      return results.length > 0
        ? (results[0].payload as unknown as ExecutionBlock)
        : null;
    } catch (error) {
      logger.error(`Failed to get block by ID: ${error}`);
      return null;
    }
  }

  async listAll(limit = 100): Promise<ExecutionBlock[]> {
    await this.ensureCollection();

    try {
      const results = await this.client.scroll(COLLECTION_NAME, {
        limit,
        with_payload: true,
      });

      return results.points.map((p) => p.payload as unknown as ExecutionBlock);
    } catch (error) {
      logger.error(`Failed to list blocks: ${error}`);
      return [];
    }
  }

  async cleanup(options: CleanupOptions = {}): Promise<number> {
    await this.ensureCollection();

    const { maxAgeDays = 90, minSuccessRate = 0.3 } = options;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    try {
      // Busca blocos antigos ou com baixa taxa de sucesso
      const results = await this.client.scroll(COLLECTION_NAME, {
        limit: 1000,
        with_payload: true,
        filter: {
          should: [
            {
              key: "stats.last_used",
              range: { lt: cutoffTimestamp },
            },
            {
              key: "stats.success_rate",
              range: { lt: minSuccessRate },
            },
          ],
        },
      });

      if (results.points.length === 0) {
        return 0;
      }

      const idsToDelete = results.points.map((p) => p.id as string);

      await this.client.delete(COLLECTION_NAME, {
        points: idsToDelete,
      });

      logger.info(`🧹 Cleaned up ${idsToDelete.length} execution blocks (Qdrant)`);
      return idsToDelete.length;
    } catch (error) {
      logger.error(`Failed to cleanup blocks: ${error}`);
      return 0;
    }
  }

  async count(): Promise<number> {
    await this.ensureCollection();

    try {
      const info = await this.client.getCollection(COLLECTION_NAME);
      return info.points_count || 0;
    } catch (error) {
      logger.error(`Failed to count blocks: ${error}`);
      return 0;
    }
  }
}
