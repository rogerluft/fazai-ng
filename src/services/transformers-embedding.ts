/**
 * Transformers Embedding Service
 *
 * Provider: ONNX BGE-base-en-v1.5 (via qdrant-universal-injection)
 * Replaces: @xenova/transformers (Xenova/multilingual-e5-base)
 *
 * Kept for backward compat — class name and exports preserved.
 * All operations delegate to the shared ONNX embedder singleton.
 *
 * @module services/transformers-embedding
 */

import { getEmbedder } from "qdrant-universal-injection";
import { logger } from "../logger";
import type { EmbeddingService, CollectionType } from "./embeddings-refactored";

export const MODEL_NAME = "BGE-base-en-v1.5";
export const MODEL_DIMENSION = 768;

class TransformersEmbeddingService implements EmbeddingService {
  private readonly embedder = getEmbedder();

  async generate(
    text: string,
    _collectionType: CollectionType
  ): Promise<number[]> {
    try {
      if (!this.embedder.isReady) await this.embedder.init();
      return await this.embedder.embed(text);
    } catch (error: any) {
      logger.error(
        `TransformersEmbeddingService.generate failed: ${error.message}`
      );
      return new Array(MODEL_DIMENSION).fill(0);
    }
  }

  async generateBatch(
    texts: string[],
    _collectionType: CollectionType
  ): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      if (!this.embedder.isReady) await this.embedder.init();
      return await this.embedder.embedBatch(texts);
    } catch (error: any) {
      logger.error(
        `TransformersEmbeddingService.generateBatch failed: ${error.message}`
      );
      return texts.map(() => new Array(MODEL_DIMENSION).fill(0));
    }
  }

  async generateChunked(
    text: string,
    collectionType: CollectionType
  ): Promise<Array<{ chunk: string; embedding: number[] }>> {
    const chunks = text.match(/.{1,512}/g) || [];
    const embeddings = await this.generateBatch(chunks, collectionType);
    return chunks.map((chunk, i) => ({
      chunk,
      embedding: embeddings[i],
    }));
  }

  getInfo() {
    return {
      provider: "onnx" as const,
      model: MODEL_NAME,
      dimension: MODEL_DIMENSION,
      isLocal: true,
    };
  }
}

export { TransformersEmbeddingService };
