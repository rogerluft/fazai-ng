/**
 * Embeddings Service Module
 *
 * Provides text embedding generation with multiple provider support.
 * Primary: Ollama nomic-embed-text (768 dim, 8192 context, local, free)
 * Fallback: OpenAI text-embedding-3-small (1536 dim, cloud, paid)
 *
 * Features:
 * - Automatic provider selection and fallback
 * - Batch processing for efficiency
 * - Retry logic for transient failures
 * - Dimension validation
 * - Progress tracking for large batches
 */

import { getConfigValue, getOllamaEmbedUrl, getOllamaUrl } from "../config";
import { logger } from "../logger";
import { withRetry } from "../utils/retry";
import { API_TIMEOUTS } from "../config/timeouts";
import { processBatches } from "../utils/batch-processor";

/**
 * Embedding provider types
 */
export type EmbeddingProvider = "ollama" | "openai";

/**
 * Embedding service interface
 */
export interface EmbeddingService {
  /**
   * Generate embedding for a single text
   */
  generate(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient than calling generate() multiple times
   */
  generateBatch(texts: string[]): Promise<number[][]>;

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
 * Ollama Embedding Service
 *
 * Uses local Ollama server for embedding generation.
 * Model: nomic-embed-text (768 dimensions, 8192 context)
 * Free, local, no API key required.
 */
class OllamaEmbeddingService implements EmbeddingService {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dimension: number;
  private readonly MAX_TOKENS = 8192; // nomic-embed-text context limit

  constructor(
    baseUrl: string = getOllamaEmbedUrl(),
    model: string = "nomic-embed-text",
    dimension: number = 768
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.dimension = dimension;
  }

  /**
   * Trunca texto para caber no contexto do modelo
   * nomic-embed-text: ~8192 tokens (~24000 chars com margem de segurança)
   */
  private truncateText(text: string): string {
    const maxChars = 24000; // Safe limit for nomic-embed-text (8192 tokens)
    if (text.length <= maxChars) {
      return text;
    }
    logger.debug(`Truncating text from ${text.length} to ${maxChars} chars`);
    return text.substring(0, maxChars);
  }

  async generate(text: string): Promise<number[]> {
    const embeddings = await this.generateBatch([text]);
    return embeddings[0];
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];

    // Ollama API endpoint: POST /api/embeddings
    const endpoint = `${this.baseUrl}/api/embeddings`;

    // Process one text at a time (Ollama API doesn't support batch)
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];

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
                  model: this.model,
                  prompt: this.truncateText(text),
                }),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                
                // NON-RETRYABLE ERROR: Context Length Exceeded
                if (response.status === 500 && errorText.includes("context length")) {
                   logger.warn(`⚠️  Ollama context exceeded for text ${i+1}. Using zero vector.`);
                   return new Array(1536).fill(0); // Return zero vector to break loop
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

              // ECOA Logic: Validação ESTRITA de dimensões
              // FazAI usa exclusivamente nomic-embed-text (768 dim) → Zero Pad → 1536 dim
              const EXPECTED_DIM = 768;   // nomic-embed-text native dimension
              const TARGET_DIM = 1536;    // ECOA/OpenAI standard (padded)

              // BLOQUEIO DE SEGURANÇA: Rejeitar dimensões inesperadas
              if (rawEmbedding.length !== EXPECTED_DIM) {
                throw new Error(
                  `DIMENSION MISMATCH! Expected ${EXPECTED_DIM} (nomic-embed-text), got ${rawEmbedding.length}.\n` +
                  `This indicates wrong embedding model. FazAI requires nomic-embed-text.\n` +
                  `Run: ollama pull nomic-embed-text`
                );
              }

              // Zero Padding: 768 → 1536
              logger.debug(`Zero-padding vector from ${EXPECTED_DIM} to ${TARGET_DIM}`);
              return [...rawEmbedding, ...new Array(TARGET_DIM - EXPECTED_DIM).fill(0)];
            } catch (error: any) {
              clearTimeout(timeoutId);
              // Pass through the zero vector if we caught it above (it's not an error anymore)
              if (Array.isArray(error)) return error; 
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
            `Ollama embeddings: ${i + 1}/${texts.length} (${Math.round(((i + 1) / texts.length) * 100)}%)`
          );
        }
      } catch (error: any) {
        logger.error(`Failed to generate embedding for text ${i + 1}: ${error.message}`);
        // Return zero vector as fallback
        embeddings.push(new Array(1536).fill(0));
      }
    }

    return embeddings;
  }

  getInfo() {
    return {
      provider: "ollama" as const,
      model: this.model,
      dimension: 1536, // Reporta a dimensão padronizada (com padding)
      isLocal: true,
    };
  }
}

/**
 * OpenAI Embedding Service
 *
 * Uses OpenAI API for embedding generation.
 * Model: text-embedding-3-small (1536 dimensions)
 * Paid, cloud, requires API key.
 */
class OpenAIEmbeddingService implements EmbeddingService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimension: number;

  /**
   * Maximum batch size for OpenAI API
   * OpenAI allows up to 2048 texts per request, but we use conservative limit
   */
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

  async generate(text: string): Promise<number[]> {
    const embeddings = await this.generateBatch([text]);
    return embeddings[0];
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const allEmbeddings: number[][] = [];

    // Process in chunks of MAX_BATCH_SIZE
    const result = await processBatches(
      texts,
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
      // Fill failed with zero vectors
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

          // Extract embeddings in correct order
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
 * Create embedding service with automatic provider selection
 *
 * Priority:
 * 1. Ollama (if OLLAMA_BASE_URL configured and reachable)
 * 2. OpenAI (if OPENAI_API_KEY configured)
 * 3. Error (if neither available)
 *
 * @returns EmbeddingService instance
 *
 * @example
 * const embeddings = await createEmbeddingService();
 * const vector = await embeddings.generate("Hello world");
 */
export async function createEmbeddingService(): Promise<EmbeddingService> {
  // Define provider checks as an array of Promises
  const providerChecks = [
    // Check 1: Ollama (using dedicated embed URL for better performance)
    async (): Promise<EmbeddingService | null> => {
      try {
        const ollamaEmbedUrl = getOllamaEmbedUrl();
        const preferredOllamaModel = "nomic-embed-text"; // 8192 context - preferred!
        const fallbackOllamaModel = "mxbai-embed-large"; // 512 context - fallback only

        logger.debug(`Testing Ollama embedding connection at ${ollamaEmbedUrl}...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${ollamaEmbedUrl}/api/tags`, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));

        if (response.ok) {
          const data = await response.json();
          const models = data.models || [];
          const modelNames = models.map((m: any) => m.name?.split(':')[0] || m.name);

          // Prefer nomic-embed-text (8192 context) over mxbai-embed-large (512 context)
          if (modelNames.some((name: string) => name === preferredOllamaModel || name.startsWith(preferredOllamaModel))) {
            logger.info(`✓ Using Ollama for embeddings at ${ollamaEmbedUrl} (${preferredOllamaModel}, 1536 dim [padded])`);
            return new OllamaEmbeddingService(ollamaEmbedUrl, preferredOllamaModel, 768);
          }

          // Fallback to mxbai-embed-large if nomic not available
          if (modelNames.some((name: string) => name === fallbackOllamaModel || name.startsWith(fallbackOllamaModel))) {
            logger.info(`✓ Using Ollama for embeddings at ${ollamaEmbedUrl} (${fallbackOllamaModel}, 1536 dim [padded])`);
            logger.warn(`⚠️  mxbai-embed-large has only 512 token context - consider installing nomic-embed-text`);
            return new OllamaEmbeddingService(ollamaEmbedUrl, fallbackOllamaModel, 1024);
          }

          logger.debug(`Ollama available but no embedding models found. Available: ${modelNames.join(', ')}`);
        }
      } catch (error: any) {
        logger.debug(`Ollama embedding server not available: ${error.message}`);
      }
      return null;
    },

    // Check 2: OpenAI
    async (): Promise<EmbeddingService | null> => {
      try {
        const openaiApiKey = getConfigValue("OPENAI_API_KEY");
        if (openaiApiKey) {
          logger.info("✓ Using OpenAI for embeddings (text-embedding-3-small, 1536 dim)");
          logger.warn("⚠️  OpenAI embeddings are paid ($0.02/1M tokens)");
          return new OpenAIEmbeddingService(openaiApiKey, "text-embedding-3-small", 1536);
        }
      } catch (error: any) {
         logger.debug(`OpenAI not available: ${error.message}`);
      }
      return null;
    }
  ];

  // Sequentially check for the first available provider
  for (const check of providerChecks) {
    const service = await check();
    if (service) {
      return service;
    }
  }

  // No provider available
  throw new Error(
    "No embedding provider available. Configure OLLAMA_EMBED_URL (or OLLAMA_BASE_URL) or OPENAI_API_KEY."
  );
}

/**
 * Get embedding dimension for current provider
 *
 * Useful for validating Qdrant collection dimension before inserting.
 *
 * @returns Embedding dimension (1024 for Ollama, 1536 for OpenAI)
 */
export async function getEmbeddingDimension(): Promise<number> {
  const service = await createEmbeddingService();
  const info = service.getInfo();
  return info.dimension;
}
