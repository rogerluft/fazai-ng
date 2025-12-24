/**
 * Cached Embedding Service Decorator
 *
 * Wraps an existing EmbeddingService to add a caching layer.
 * Uses the EmbeddingCache to store and retrieve embeddings, avoiding
 * recomputation for recently processed texts.
 *
 * This follows the Decorator pattern, adding functionality without
 * altering the underlying service's code.
 */

import {
  CollectionType,
  EmbeddingService,
} from "./embeddings-refactored";
import { EmbeddingCache } from "./embedding-cache";
import { logger } from "../logger";

export class CachedEmbeddingService implements EmbeddingService {
  private readonly underlyingService: EmbeddingService;
  private readonly cache: EmbeddingCache;

  /**
   * Creates an instance of CachedEmbeddingService.
   * @param underlyingService The embedding service to wrap.
   * @param cache The cache instance to use for storing and retrieving embeddings.
   */
  constructor(underlyingService: EmbeddingService, cache: EmbeddingCache) {
    this.underlyingService = underlyingService;
    this.cache = cache;
    logger.info("Embedding cache enabled.");
  }

  /**
   * Gets the info from the underlying service.
   */
  getInfo() {
    return this.underlyingService.getInfo();
  }

  /**
   * Generates an embedding for a single text, using the cache if possible.
   */
  async generate(text: string, collectionType: CollectionType): Promise<number[]> {
    const { model } = this.getInfo();
    const cachedEmbedding = this.cache.get(text, model);

    if (cachedEmbedding) {
      return cachedEmbedding;
    }

    const embedding = await this.underlyingService.generate(text, collectionType);
    this.cache.set(text, model, embedding);
    return embedding;
  }

  /**
   * Generates embeddings for a batch of texts, using the cache for texts that have already been processed.
   */
  async generateBatch(texts: string[], collectionType: CollectionType): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const { model } = this.getInfo();
    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const textsToProcess: { index: number; text: string }[] = [];

    // First pass: check the cache
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const cachedEmbedding = this.cache.get(text, model);
      if (cachedEmbedding) {
        results[i] = cachedEmbedding;
      } else {
        textsToProcess.push({ index: i, text });
      }
    }

    // Second pass: process cache misses
    if (textsToProcess.length > 0) {
      const missTexts = textsToProcess.map(item => item.text);
      logger.debug(`Cache miss for ${missTexts.length}/${texts.length} embeddings. Computing...`);
      const newEmbeddings = await this.underlyingService.generateBatch(missTexts, collectionType);

      // Store new embeddings in cache and results array
      for (let i = 0; i < newEmbeddings.length; i++) {
        const originalIndex = textsToProcess[i].index;
        const text = textsToProcess[i].text;
        const embedding = newEmbeddings[i];

        results[originalIndex] = embedding;
        this.cache.set(text, model, embedding);
      }
    }

    // All texts should now be resolved
    return results as number[][];
  }

  /**
   * Generates chunked embeddings, delegating to the underlying service.
   * Caching is handled at the `generateBatch` level.
   */
  async generateChunked(
    text: string,
    collectionType: CollectionType
  ): Promise<Array<{ chunk: string; embedding: number[] }>> {
    // The underlying generateChunked method will call generateBatch,
    // which is already cached by this decorator. No extra caching logic needed here.
    return this.underlyingService.generateChunked(text, collectionType);
  }
}
