/**
 * Universal Local Embedder
 *
 * Provides a unified interface for local embedding generation using Ollama.
 * Implements Zero Padding to normalize vectors to 1536 dimensions (OpenAI standard).
 *
 * Features:
 * - Uses Ollama nomic-embed-text (768 dim) as primary model
 * - Automatic Zero Padding to 1536 dimensions
 * - Batch processing support
 * - Configurable Ollama endpoint
 * - Retry logic for transient failures
 *
 * Architecture:
 * - Primary: nomic-embed-text (768d) → Zero Pad → 1536d
 * - Compatible with OpenAI text-embedding-3-small dimension
 * - Enables collection migration without re-embedding
 *
 * @module services/universal-embedder
 */

import { logger } from "../logger";
import { withRetry } from "../utils/retry";
import { API_TIMEOUTS } from "../config/timeouts";

/**
 * Ollama API response for embeddings
 */
interface OllamaEmbeddingResponse {
  embedding: number[];
}

/**
 * Pad vector to target dimension using Zero Padding
 *
 * Zero Padding preserves the original semantic information while
 * extending the vector to a higher dimension. This is safer than
 * truncation and maintains cosine similarity properties.
 *
 * @param vector Input vector
 * @param targetDim Target dimension (default: 1536)
 * @returns Padded or truncated vector
 *
 * @example
 * ```typescript
 * const vec768 = new Array(768).fill(0.5);
 * const vec1536 = padVector(vec768, 1536);
 * console.log(vec1536.length); // 1536
 * ```
 */
export function padVector(vector: number[], targetDim: number = 1536): number[] {
  if (vector.length === targetDim) {
    return vector;
  }

  if (vector.length < targetDim) {
    // Zero Padding: append zeros to reach target dimension
    const padding = new Array(targetDim - vector.length).fill(0);
    logger.debug(
      `Zero Padding: ${vector.length}d → ${targetDim}d (+${padding.length} zeros)`
    );
    return [...vector, ...padding];
  }

  // Truncation: only if input is larger (should not happen with nomic-embed-text)
  logger.warn(
    `Truncating vector: ${vector.length}d → ${targetDim}d (data loss)`
  );
  return vector.slice(0, targetDim);
}

/**
 * Generate universal embedding using Ollama nomic-embed-text
 *
 * This function is a convenience wrapper around UniversalLocalEmbedder
 * for single-text embeddings.
 *
 * @param text Input text to embed
 * @param ollamaUrl Ollama server URL (default: http://192.168.0.101:11434)
 * @returns 1536-dimensional embedding vector
 *
 * @example
 * ```typescript
 * const embedding = await generateUniversalEmbedding("Hello world");
 * console.log(embedding.length); // 1536
 * ```
 */
export async function generateUniversalEmbedding(
  text: string,
  ollamaUrl: string = "http://192.168.0.101:11434"
): Promise<number[]> {
  const embedder = new UniversalLocalEmbedder(ollamaUrl);
  return embedder.embed(text);
}

/**
 * Universal Local Embedder Class
 *
 * Provides batch and single embedding generation using Ollama
 * with automatic dimension normalization.
 *
 * @example
 * ```typescript
 * const embedder = new UniversalLocalEmbedder();
 *
 * // Single embedding
 * const vec = await embedder.embed("Hello world");
 *
 * // Batch embeddings
 * const vecs = await embedder.embedBatch(["Hello", "World"]);
 * ```
 */
export class UniversalLocalEmbedder {
  private readonly ollamaUrl: string;
  private readonly model: string;
  private readonly nativeDimension: number;
  private readonly targetDimension: number;
  private readonly maxChars: number;

  /**
   * Create a new Universal Local Embedder
   *
   * @param ollamaUrl Ollama server URL (default: http://192.168.0.101:11434)
   * @param model Ollama model name (default: nomic-embed-text)
   * @param nativeDimension Native model dimension (default: 768)
   * @param targetDimension Target dimension after padding (default: 1536)
   */
  constructor(
    ollamaUrl: string = "http://192.168.0.101:11434",
    model: string = "nomic-embed-text",
    nativeDimension: number = 768,
    targetDimension: number = 1536
  ) {
    this.ollamaUrl = ollamaUrl;
    this.model = model;
    this.nativeDimension = nativeDimension;
    this.targetDimension = targetDimension;
    this.maxChars = 2048; // Conservative limit for nomic-embed-text

    logger.debug(
      `UniversalLocalEmbedder initialized: ${this.model} (${this.nativeDimension}d → ${this.targetDimension}d)`
    );
  }

  /**
   * Truncate text to fit model context window
   *
   * @param text Input text
   * @returns Truncated text
   */
  private truncateText(text: string): string {
    if (text.length <= this.maxChars) {
      return text;
    }

    logger.warn(
      `Text truncated: ${text.length} → ${this.maxChars} chars (context limit)`
    );
    return text.substring(0, this.maxChars);
  }

  /**
   * Call Ollama API to generate raw embedding
   *
   * @param text Input text
   * @returns Raw embedding vector (native dimension)
   */
  private async generateRawEmbedding(text: string): Promise<number[]> {
    const endpoint = `${this.ollamaUrl}/api/embeddings`;

    return withRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          API_TIMEOUTS.ollama || 30000
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
            const errorText = await response.text().catch(() => "Unknown error");
            throw new Error(
              `Ollama API error ${response.status}: ${errorText}`
            );
          }

          const data = (await response.json()) as OllamaEmbeddingResponse;

          if (!data.embedding || !Array.isArray(data.embedding)) {
            throw new Error("Invalid response from Ollama API");
          }

          const embedding = data.embedding;

          // Validate dimension
          if (embedding.length !== this.nativeDimension) {
            logger.warn(
              `Unexpected embedding dimension: ${embedding.length} (expected: ${this.nativeDimension})`
            );
          }

          return embedding;
        } catch (error: unknown) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      {
        provider: "ollama",
        maxRetries: 2,
      }
    );
  }

  /**
   * Generate universal embedding for a single text
   *
   * @param text Input text
   * @returns 1536-dimensional embedding vector
   *
   * @example
   * ```typescript
   * const embedder = new UniversalLocalEmbedder();
   * const vector = await embedder.embed("Hello world");
   * ```
   */
  async embed(text: string): Promise<number[]> {
    try {
      const rawEmbedding = await this.generateRawEmbedding(text);
      const paddedEmbedding = padVector(rawEmbedding, this.targetDimension);

      logger.debug(
        `Embedded text (${text.length} chars) → ${paddedEmbedding.length}d vector`
      );

      return paddedEmbedding;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Failed to generate embedding: ${errorMessage}`);

      // Return zero vector as fallback
      logger.warn(`Returning zero vector (${this.targetDimension}d) as fallback`);
      return new Array(this.targetDimension).fill(0);
    }
  }

  /**
   * Generate universal embeddings for multiple texts
   *
   * Processes texts sequentially (Ollama API doesn't support batch).
   * Includes progress logging for large batches.
   *
   * @param texts Array of input texts
   * @returns Array of 1536-dimensional embedding vectors
   *
   * @example
   * ```typescript
   * const embedder = new UniversalLocalEmbedder();
   * const vectors = await embedder.embedBatch([
   *   "Hello world",
   *   "Goodbye world"
   * ]);
   * ```
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    logger.info(
      `Generating ${texts.length} embeddings (${this.model} → ${this.targetDimension}d)`
    );

    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];

      try {
        const embedding = await this.embed(text);
        embeddings.push(embedding);

        // Log progress for large batches
        if (texts.length > 10 && (i + 1) % 10 === 0) {
          const progress = Math.round(((i + 1) / texts.length) * 100);
          logger.debug(
            `Batch progress: ${i + 1}/${texts.length} (${progress}%)`
          );
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`Failed to embed text ${i + 1}: ${errorMessage}`);

        // Use zero vector as fallback
        embeddings.push(new Array(this.targetDimension).fill(0));
      }
    }

    logger.info(
      `Batch complete: ${embeddings.length}/${texts.length} embeddings generated`
    );

    return embeddings;
  }

  /**
   * Get embedder information
   *
   * @returns Embedder configuration
   */
  getInfo(): {
    model: string;
    nativeDimension: number;
    targetDimension: number;
    ollamaUrl: string;
  } {
    return {
      model: this.model,
      nativeDimension: this.nativeDimension,
      targetDimension: this.targetDimension,
      ollamaUrl: this.ollamaUrl,
    };
  }
}
