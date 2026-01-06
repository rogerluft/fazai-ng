/**
 * Embeddings Service Module - Refactored with Strategy Pattern
 *
 * Provides collection-aware text embedding generation with:
 * - Native dimensions (no zero padding)
 * - Semantic chunking (no hard truncation)
 * - Model selection by content type
 * - Automatic fallback handling
 *
 * Key Changes from Original:
 * - ❌ Removed: Zero padding (1024 → 1536)
 * - ✅ Added: Collection-specific strategies
 * - ✅ Added: Semantic chunking
 * - ✅ Added: Model availability checking
 *
 * @module services/embeddings
 */

import { getConfigValue } from "../config";
import { logger } from "../logger";
import { withRetry } from "../utils/retry";
import { API_TIMEOUTS } from "../config/timeouts";
import { processBatches } from "../utils/batch-processor";
import {
  EmbeddingStrategy,
  CollectionType,
  getEmbeddingStrategy,
  semanticChunk,
  preprocessText,
  isModelAvailable,
  getFallbackModel,
  EmbeddingModel,
} from "./embedding-strategies";
import { CachedEmbeddingService } from "./cached-embedding-service";
import { embeddingCache } from "./embedding-cache";
import { TransformersEmbeddingService } from "./transformers-embedding";

/**
 * Embedding provider types
 */
export type EmbeddingProvider = "ollama" | "openai" | "transformers.js";

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
 * Ollama Embedding Service - Refactored
 *
 * Uses native dimensions (1024 or 768) without zero padding.
 * Model selection based on collection type.
 */
class OllamaEmbeddingService implements EmbeddingService {
  private readonly baseUrl: string;
  private modelCache: Map<CollectionType, EmbeddingModel>;

  constructor(baseUrl: string = "http://192.168.0.101:11434") {
    this.baseUrl = baseUrl;
    this.modelCache = new Map();
  }

  /**
   * Get appropriate model for collection type
   */
  private async getModelForCollection(
    collectionType: CollectionType
  ): Promise<{ model: EmbeddingModel; dimension: number }> {
    // Check cache first
    if (this.modelCache.has(collectionType)) {
      const cachedModel = this.modelCache.get(collectionType)!;
      const strategy = getEmbeddingStrategy(collectionType);
      return { model: cachedModel, dimension: strategy.dimension };
    }

    const strategy = getEmbeddingStrategy(collectionType);

    // Check if preferred model is available
    if (await isModelAvailable(strategy.model, this.baseUrl)) {
      this.modelCache.set(collectionType, strategy.model);
      return { model: strategy.model, dimension: strategy.dimension };
    }

    // Try fallback
    const fallback = await getFallbackModel(strategy.model, this.baseUrl);
    if (fallback) {
      this.modelCache.set(collectionType, fallback);

      // Get dimension for fallback model
      const fallbackDim =
        fallback === "mxbai-embed-large" ? 1024 : 768;

      logger.warn(
        `Collection '${collectionType}': Using fallback model '${fallback}' (${fallbackDim}D)`
      );

      return { model: fallback, dimension: fallbackDim };
    }

    throw new Error(
      `No embedding model available for collection '${collectionType}'. ` +
      `Preferred: ${strategy.model}, Checked: mxbai-embed-large, nomic-embed-text`
    );
  }

  async generate(
    text: string,
    collectionType: CollectionType
  ): Promise<number[]> {
    const strategy = getEmbeddingStrategy(collectionType);

    if (!strategy.requiresEmbedding) {
      logger.warn(
        `Collection '${collectionType}' does not require embeddings. Returning empty vector.`
      );
      return [];
    }

    const preprocessed = preprocessText(text, collectionType);
    const embeddings = await this.generateBatch([preprocessed], collectionType);
    return embeddings[0];
  }

  async generateBatch(
    texts: string[],
    collectionType: CollectionType
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const strategy = getEmbeddingStrategy(collectionType);

    if (!strategy.requiresEmbedding) {
      logger.warn(
        `Collection '${collectionType}' does not require embeddings. Returning empty vectors.`
      );
      return texts.map(() => []);
    }

    const { model, dimension } = await this.getModelForCollection(
      collectionType
    );

    const embeddings: number[][] = [];
    const endpoint = `${this.baseUrl}/api/embeddings`;

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const preprocessed = preprocessText(text, collectionType);

      try {
        const embedding = await withRetry(
          async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(
              () => controller.abort(),
              API_TIMEOUTS.ollama
            );

            try {
              const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model,
                  prompt: preprocessed,
                }),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (!response.ok) {
                const errorText = await response.text().catch(() => "");

                // NON-RETRYABLE: Context length exceeded
                if (
                  response.status === 500 &&
                  errorText.includes("context length")
                ) {
                  logger.warn(
                    `⚠️  Ollama context exceeded for text ${i + 1}. Using zero vector.`
                  );
                  return new Array(dimension).fill(0);
                }

                throw new Error(
                  `Ollama API error ${response.status}: ${errorText}`
                );
              }

              const data = await response.json();

              if (!data.embedding || !Array.isArray(data.embedding)) {
                throw new Error("Invalid response from Ollama API");
              }

              const rawEmbedding = data.embedding as number[];

              // Dimension should be native from the model. No more padding/truncating.
              if (rawEmbedding.length !== dimension) {
                logger.warn(
                  `Ollama model '${model}' returned an unexpected dimension: ${rawEmbedding.length} (expected ${dimension})`
                );
              }

              return rawEmbedding;
            } catch (error: any) {
              clearTimeout(timeoutId);
              throw error;
            }
          },
          {
            provider: "ollama",
            maxRetries: 2,
          }
        );

        embeddings.push(embedding);

        // Log progress for large batches
        if (texts.length > 10 && (i + 1) % 10 === 0) {
          logger.debug(
            `Ollama embeddings (${model}): ${i + 1}/${texts.length} (${Math.round(((i + 1) / texts.length) * 100)}%)`
          );
        }
      } catch (error: any) {
        logger.error(
          `Failed to generate embedding for text ${i + 1}: ${error.message}`
        );
        embeddings.push(new Array(dimension).fill(0));
      }
    }

    return embeddings;
  }

  async generateChunked(
    text: string,
    collectionType: CollectionType
  ): Promise<Array<{ chunk: string; embedding: number[] }>> {
    const strategy = getEmbeddingStrategy(collectionType);

    if (!strategy.requiresEmbedding) {
      return [];
    }

    // 1. Preprocess text
    const preprocessed = preprocessText(text, collectionType);

    // 2. Chunk semantically
    const chunks = semanticChunk(preprocessed, strategy.chunking);

    logger.info(
      `Chunked text for '${collectionType}': ${chunks.length} chunks`
    );

    // 3. Generate embeddings for all chunks
    const embeddings = await this.generateBatch(chunks, collectionType);

    // 4. Combine chunks with embeddings
    return chunks.map((chunk, i) => ({
      chunk,
      embedding: embeddings[i],
    }));
  }

  getInfo() {
    // Return info for default model (will vary by collection at runtime)
    return {
      provider: "ollama" as const,
      model: "mxbai-embed-large (dynamic)",
      dimension: 1024, // Most common dimension
      isLocal: true,
    };
  }
}

/**
 * OpenAI Embedding Service - Refactored
 *
 * Uses OpenAI text-embedding-3-small (1536 dim).
 * Supports collection-aware preprocessing and chunking.
 */
class OpenAIEmbeddingService implements EmbeddingService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimension: number;
  private readonly MAX_BATCH_SIZE = 100;

  constructor(
    apiKey: string,
    model: string = "text-embedding-3-small",
    dimension: number = 1536
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimension = dimension;
  }

  async generate(
    text: string,
    collectionType: CollectionType
  ): Promise<number[]> {
    const strategy = getEmbeddingStrategy(collectionType);

    if (!strategy.requiresEmbedding) {
      return [];
    }

    const preprocessed = preprocessText(text, collectionType);
    const embeddings = await this.generateBatch([preprocessed], collectionType);
    return embeddings[0];
  }

  async generateBatch(
    texts: string[],
    collectionType: CollectionType
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const strategy = getEmbeddingStrategy(collectionType);

    if (!strategy.requiresEmbedding) {
      return texts.map(() => []);
    }

    // Preprocess all texts
    const preprocessed = texts.map((t) => preprocessText(t, collectionType));

    const allEmbeddings: number[][] = [];

    const result = await processBatches(
      preprocessed,
      async (batch) => {
        const batchEmbeddings = await this.generateBatchInternal(batch);
        allEmbeddings.push(...batchEmbeddings);
      },
      {
        batchSize: this.MAX_BATCH_SIZE,
        operationName: "OpenAI embeddings",
        logProgress: texts.length > 100,
      }
    );

    if (result.failed.length > 0) {
      logger.warn(
        `OpenAI embeddings: ${result.failed.length}/${texts.length} failed, using zero vectors`
      );
      for (let i = 0; i < result.failed.length; i++) {
        allEmbeddings.push(new Array(this.dimension).fill(0));
      }
    }

    return allEmbeddings;
  }

  private async generateBatchInternal(texts: string[]): Promise<number[][]> {
    return withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          API_TIMEOUTS.openai
        );

        try {
          const response = await fetch(
            "https://api.openai.com/v1/embeddings",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
              },
              body: JSON.stringify({
                model: this.model,
                input: texts,
                dimensions: this.dimension,
              }),
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              `OpenAI API error ${response.status}: ${errorData.error?.message || response.statusText}`
            );
          }

          const data = await response.json();

          if (!data.data || !Array.isArray(data.data)) {
            throw new Error("Invalid response from OpenAI API");
          }

          return data.data
            .sort((a: any, b: any) => a.index - b.index)
            .map((item: any) => item.embedding as number[]);
        } catch (error: any) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      {
        provider: "openai",
        maxRetries: 3,
      }
    );
  }

  async generateChunked(
    text: string,
    collectionType: CollectionType
  ): Promise<Array<{ chunk: string; embedding: number[] }>> {
    const strategy = getEmbeddingStrategy(collectionType);

    if (!strategy.requiresEmbedding) {
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
      provider: "openai" as const,
      model: this.model,
      dimension: this.dimension,
      isLocal: false,
    };
  }
}

/**
 * Create embedding service with automatic provider selection and caching.
 *
 * Priority:
 * 1. Ollama (local, free, native dimensions)
 * 2. OpenAI (cloud, paid, 1536 dim)
 *
 * @returns EmbeddingService instance wrapped with a caching layer.
 */
export async function createEmbeddingService(): Promise<EmbeddingService> {
  let underlyingService: EmbeddingService;

  // 1. Try Transformers.js (CPU-based, local)
  try {
    logger.debug("Attempting to initialize Transformers.js embedding service...");
    underlyingService = new TransformersEmbeddingService();
    // Test by generating a small embedding
    await underlyingService.generate("test", "fazai_kb");
    logger.info("✓ Using Transformers.js for local embeddings (Xenova/multilingual-e5-base, 768 dim)");
    return new CachedEmbeddingService(underlyingService, embeddingCache);
  } catch (error: any) {
    logger.debug(`Transformers.js initialization failed: ${error.message}. Falling back...`);
  }

  // 2. Try Ollama (local daemon)
  const ollamaBaseUrl =
    getConfigValue("OLLAMA_BASE_URL") || "http://192.168.0.101:11434";

  try {
    logger.debug(`Testing Ollama connection at ${ollamaBaseUrl}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (response && response.ok) {
      const data = await response.json();
      const models = data.models || [];
      const modelNames = models.map(
        (m: any) => m.name?.split(":")[0] || m.name
      );

      const hasEmbeddingModel =
        modelNames.includes("mxbai-embed-large") ||
        modelNames.includes("nomic-embed-text");

      if (hasEmbeddingModel) {
        logger.info(
          `✓ Using Ollama for embeddings (models: ${modelNames.filter((n: string) => n.includes("embed")).join(", ")})`
        );
        underlyingService = new OllamaEmbeddingService(ollamaBaseUrl);
        return new CachedEmbeddingService(underlyingService, embeddingCache);
      }

      logger.debug(
        `Ollama available but no embedding models found. Available: ${modelNames.join(", ")}`
      );
    }
  } catch (error: any) {
    logger.debug(`Ollama not available: ${error.message}`);
  }

  // 3. Fallback to OpenAI
  const openaiApiKey = getConfigValue("OPENAI_API_KEY");

  if (openaiApiKey) {
    logger.info(
      "✓ Using OpenAI for embeddings (text-embedding-3-small, 1536 dim)"
    );
    logger.warn("⚠️  OpenAI embeddings are paid ($0.02/1M tokens)");
    underlyingService = new OpenAIEmbeddingService(
      openaiApiKey,
      "text-embedding-3-small",
      1536
    );
    return new CachedEmbeddingService(underlyingService, embeddingCache);
  }

  throw new Error(
    "No embedding provider available. Configure OLLAMA_BASE_URL or OPENAI_API_KEY."
  );
}

/**
 * Get embedding dimension for collection type
 *
 * Returns native dimension (no padding).
 *
 * @param collectionType Collection type
 * @returns Embedding dimension
 */
export async function getEmbeddingDimension(
  collectionType: CollectionType
): Promise<number> {
  const strategy = getEmbeddingStrategy(collectionType);

  if (!strategy.requiresEmbedding) {
    return 0;
  }

  return strategy.dimension;
}
