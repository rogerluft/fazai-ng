/**
 * Embeddings Service Module - Refactored with Strategy Pattern
 *
 * Provider: ONNX BGE-base-en-v1.5 (via qdrant-universal-injection)
 * Dimension: 768d, local, sem dependência de rede/Ollama
 *
 * Mantém:
 * - Collection-specific preprocessing e chunking (sem zero padding)
 * - Semantic chunking via embedding-strategies.ts
 * - Cache decorator via CachedEmbeddingService
 *
 * O collectionType é usado para preprocessing/chunking,
 * mas o modelo ONNX é o mesmo para todas as collections.
 *
 * @module services/embeddings-refactored
 */

import { getEmbedder } from "qdrant-universal-injection";
import { logger } from "../logger";
import {
  CollectionType,
  getEmbeddingStrategy,
  semanticChunk,
  preprocessText,
} from "./embedding-strategies";
import { CachedEmbeddingService } from "./cached-embedding-service";
import { embeddingCache } from "./embedding-cache";

// Re-export for consumers that import CollectionType from here
export type { CollectionType };

/**
 * Embedding provider types
 */
export type EmbeddingProvider = "onnx";

/**
 * Embedding service interface
 */
export interface EmbeddingService {
  /**
   * Generate embedding for a single text
   */
  generate(text: string, collectionType: CollectionType): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts in batch
   */
  generateBatch(
    texts: string[],
    collectionType: CollectionType
  ): Promise<number[][]>;

  /**
   * Generate embeddings for chunked text (returns multiple vectors)
   */
  generateChunked(
    text: string,
    collectionType: CollectionType
  ): Promise<Array<{ chunk: string; embedding: number[] }>>;

  /**
   * Get provider info
   */
  getInfo(): {
    provider: EmbeddingProvider;
    model: string;
    dimension: number;
    isLocal: boolean;
  };
}

/**
 * ONNX Embedding Service - Collection-Aware
 *
 * Uses ONNX BGE-base-en-v1.5 (768d) for all collections.
 * collectionType drives preprocessing and chunking strategy,
 * but the same model is used for all.
 */
class ONNXEmbeddingServiceRefactored implements EmbeddingService {
  private readonly embedder = getEmbedder();
  private initPromise: Promise<void> | null = null;

  private async ensureInit(): Promise<void> {
    if (this.embedder.isReady) return;
    if (!this.initPromise) {
      this.initPromise = this.embedder.init();
    }
    return this.initPromise;
  }

  async generate(
    text: string,
    collectionType: CollectionType
  ): Promise<number[]> {
    const strategy = getEmbeddingStrategy(collectionType);

    if (!strategy || !strategy.requiresEmbedding) {
      return [];
    }

    const preprocessed = preprocessText(text, collectionType);
    await this.ensureInit();
    try {
      return await this.embedder.embed(preprocessed);
    } catch (error: any) {
      logger.error(
        `ONNX embed failed for ${collectionType}: ${error.message}`
      );
      return new Array(768).fill(0);
    }
  }

  async generateBatch(
    texts: string[],
    collectionType: CollectionType
  ): Promise<number[][]> {
    if (texts.length === 0) return [];

    const strategy = getEmbeddingStrategy(collectionType);

    if (!strategy || !strategy.requiresEmbedding) {
      return texts.map(() => []);
    }

    const preprocessed = texts.map((t) => preprocessText(t, collectionType));
    await this.ensureInit();
    try {
      return await this.embedder.embedBatch(preprocessed);
    } catch (error: any) {
      logger.error(
        `ONNX embedBatch failed for ${collectionType}: ${error.message}`
      );
      return texts.map(() => new Array(768).fill(0));
    }
  }

  async generateChunked(
    text: string,
    collectionType: CollectionType
  ): Promise<Array<{ chunk: string; embedding: number[] }>> {
    const strategy = getEmbeddingStrategy(collectionType);

    if (!strategy || !strategy.requiresEmbedding) {
      return [];
    }

    const preprocessed = preprocessText(text, collectionType);
    const chunks = semanticChunk(preprocessed, strategy.chunking);

    logger.info(
      `Chunked text for '${collectionType}': ${chunks.length} chunks`
    );

    const embeddings = await this.generateBatch(chunks, collectionType);

    return chunks.map((chunk, i) => ({
      chunk,
      embedding: embeddings[i],
    }));
  }

  getInfo() {
    return {
      provider: "onnx" as const,
      model: "BGE-base-en-v1.5",
      dimension: 768,
      isLocal: true,
    };
  }
}

// Module-level singleton
let _serviceInstance: EmbeddingService | null = null;

/**
 * Create embedding service with ONNX BGE-base-en-v1.5 + cache
 *
 * Returns a singleton wrapped with CachedEmbeddingService.
 *
 * @returns EmbeddingService instance
 */
export async function createEmbeddingService(): Promise<EmbeddingService> {
  if (!_serviceInstance) {
    const underlying = new ONNXEmbeddingServiceRefactored();
    _serviceInstance = new CachedEmbeddingService(underlying, embeddingCache);
    logger.info(
      "✓ Using ONNX BGE-base-en-v1.5 for embeddings (768d, local, collection-aware)"
    );
  }
  return _serviceInstance;
}

/**
 * Get embedding dimension for collection type
 *
 * Returns 768 for all collection types that require embeddings,
 * 0 for inference (no embeddings needed).
 */
export async function getEmbeddingDimension(
  collectionType: CollectionType
): Promise<number> {
  const strategy = getEmbeddingStrategy(collectionType);

  if (!strategy || !strategy.requiresEmbedding) {
    return 0;
  }

  return 768;
}
