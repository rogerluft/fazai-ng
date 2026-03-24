/**
 * Embeddings Service Module
 *
 * Provider: ONNX BGE-base-en-v1.5 (via qdrant-universal-injection)
 * Dimension: 768d, local, sem dependência de rede/Ollama
 *
 * Todas as chamadas delegam para o StaticEmbedder singleton que usa
 * fastembed com modelo ONNX carregado em memória.
 */

import { getEmbedder } from "qdrant-universal-injection";
import { logger } from "../logger";

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
 * ONNX Embedding Service
 *
 * Uses local ONNX model (BGE-base-en-v1.5) via fastembed.
 * 768 dimensions, fully local, no API calls.
 * embed() uses queryEmbed (query-optimized), embedBatch() uses document embed.
 */
class ONNXEmbeddingService implements EmbeddingService {
  private readonly embedder = getEmbedder();
  private initPromise: Promise<void> | null = null;

  private async ensureInit(): Promise<void> {
    if (this.embedder.isReady) return;
    if (!this.initPromise) {
      // MenoPauseFix: reset promise on failure so retries are possible
      this.initPromise = this.embedder.init().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  async generate(text: string): Promise<number[]> {
    await this.ensureInit();
    try {
      return await this.embedder.embed(text);
    } catch (error: any) {
      logger.error(`ONNX embed failed: ${error.message}`);
      return new Array(768).fill(0);
    }
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    await this.ensureInit();
    try {
      return await this.embedder.embedBatch(texts);
    } catch (error: any) {
      logger.error(`ONNX embedBatch failed: ${error.message}`);
      return texts.map(() => new Array(768).fill(0));
    }
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

// Module-level singleton — created once per process
let _serviceInstance: ONNXEmbeddingService | null = null;

/**
 * Create embedding service with ONNX BGE-base-en-v1.5
 *
 * Returns a singleton that shares the same ONNX model across all callers.
 * First call triggers model loading (~11s cold start), subsequent calls are instant.
 *
 * @returns EmbeddingService instance
 *
 * @example
 * const embeddings = await createEmbeddingService();
 * const vector = await embeddings.generate("Hello world");
 */
export async function createEmbeddingService(): Promise<EmbeddingService> {
  if (!_serviceInstance) {
    _serviceInstance = new ONNXEmbeddingService();
    logger.info("✓ Using ONNX BGE-base-en-v1.5 for embeddings (768d, local)");
  }
  return _serviceInstance;
}

/**
 * Get embedding dimension (always 768 for BGE-base-en-v1.5)
 */
export async function getEmbeddingDimension(): Promise<number> {
  return 768;
}
