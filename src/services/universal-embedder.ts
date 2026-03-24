/**
 * Universal Local Embedder
 *
 * Provider: ONNX BGE-base-en-v1.5 (via qdrant-universal-injection)
 * Dimension: 768d, local, sem dependência de Ollama
 *
 * Todas as chamadas delegam para o StaticEmbedder singleton.
 * Constructor params mantidos para backward compat mas ignorados.
 *
 * @module services/universal-embedder
 */

import { getEmbedder } from "qdrant-universal-injection";
import { logger } from "../logger";

/**
 * Pad vector to target dimension using Zero Padding
 *
 * Kept for backward compatibility (exported, used in tests).
 * With BGE-base-en-v1.5 always returning 768d, padding is rarely needed.
 */
export function padVector(vector: number[], targetDim: number = 768): number[] {
  if (vector.length === targetDim) {
    return vector;
  }

  if (vector.length < targetDim) {
    const padding = new Array(targetDim - vector.length).fill(0);
    return [...vector, ...padding];
  }

  return vector.slice(0, targetDim);
}

/**
 * Generate universal embedding using ONNX BGE-base-en-v1.5
 *
 * @param text Input text to embed
 * @returns 768-dimensional embedding vector
 */
export async function generateUniversalEmbedding(
  text: string,
  _ollamaUrl?: string
): Promise<number[]> {
  const embedder = getEmbedder();
  if (!embedder.isReady) await embedder.init();
  return embedder.embed(text);
}

/**
 * Universal Local Embedder Class
 *
 * Delegates all embedding operations to ONNX BGE-base-en-v1.5 via getEmbedder().
 * Constructor params are accepted for backward compat but ignored.
 */
export class UniversalLocalEmbedder {
  private readonly embedder = getEmbedder();
  private initPromise: Promise<void> | null = null;

  constructor(
    _ollamaUrl?: string,
    _model?: string,
    _nativeDimension?: number,
    _targetDimension?: number,
    _useCache?: boolean
  ) {
    logger.debug(
      "UniversalLocalEmbedder: using ONNX BGE-base-en-v1.5 (constructor params ignored)"
    );
  }

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

  async embed(text: string): Promise<number[]> {
    await this.ensureInit();
    try {
      return await this.embedder.embed(text);
    } catch (error: any) {
      logger.error(`UniversalLocalEmbedder.embed failed: ${error.message}`);
      return new Array(768).fill(0);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    await this.ensureInit();
    try {
      return await this.embedder.embedBatch(texts);
    } catch (error: any) {
      logger.error(
        `UniversalLocalEmbedder.embedBatch failed: ${error.message}`
      );
      return texts.map(() => new Array(768).fill(0));
    }
  }

  getInfo() {
    return {
      model: "BGE-base-en-v1.5",
      nativeDimension: 768,
      targetDimension: 768,
      ollamaUrl: "(ONNX local — no network)",
    };
  }
}
