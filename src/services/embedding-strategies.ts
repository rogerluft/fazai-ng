/**
 * Embedding Strategies - Collection-Specific Embedding Configuration
 *
 * Defines specialized embedding strategies for each Qdrant collection,
 * eliminating zero-padding and optimizing for content type.
 *
 * Key Improvements:
 * - Native dimensions (1024 for Ollama, 1536 for OpenAI)
 * - Semantic chunking (no hard truncation)
 * - Model selection by content type
 * - Preprocessing pipelines
 *
 * @module services/embedding-strategies
 */

import { getOllamaUrl } from "../config";
import { logger } from "../logger";

/**
 * Supported embedding models (Ollama local)
 */
export type EmbeddingModel =
  | "mxbai-embed-large"  // 1024 dim - Best for long context
  | "nomic-embed-text"   // 768 dim - Best for short text
  | "text-embedding-3-small"; // 1536 dim - OpenAI fallback

/**
 * Collection types
 */
export type CollectionType =
  | "personality"
  | "memory"
  | "learning"
  | "kb"
  | "inference";

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
  /**
   * Maximum chunk size in characters (semantic boundary)
   */
  maxChunkSize: number;

  /**
   * Overlap between chunks (for context preservation)
   */
  overlap: number;

  /**
   * Separators for splitting (in priority order)
   */
  separators: string[];

  /**
   * Minimum chunk size (discard smaller chunks)
   */
  minChunkSize: number;
}

/**
 * Embedding strategy for a collection
 */
export interface EmbeddingStrategy {
  /**
   * Collection name
   */
  collection: string;

  /**
   * Preferred embedding model
   */
  model: EmbeddingModel;

  /**
   * Native dimension of the model
   */
  dimension: number;

  /**
   * Chunking configuration
   */
  chunking: ChunkingConfig;

  /**
   * Distance metric for Qdrant
   */
  distanceMetric: "Cosine" | "Dot" | "Euclid";

  /**
   * Preprocessing function (clean text before embedding)
   */
  preprocess: (text: string) => string;

  /**
   * Whether this collection needs embeddings at all
   */
  requiresEmbedding: boolean;
}

/**
 * Default chunking strategies by collection type
 */
const CHUNKING_STRATEGIES: Record<CollectionType, ChunkingConfig> = {
  personality: {
    maxChunkSize: 200,   // Short traits/styles
    overlap: 20,
    separators: ["\n\n", ". ", ", "],
    minChunkSize: 50,
  },
  memory: {
    maxChunkSize: 800,   // Long conversations
    overlap: 100,
    separators: ["\n\n", "\n", ". "],
    minChunkSize: 200,
  },
  kb: {
    maxChunkSize: 600,   // Technical docs
    overlap: 100,
    separators: ["\n\n", "\n", ". ", " "],
    minChunkSize: 300,
  },
  learning: {
    maxChunkSize: 400,   // Commands + context
    overlap: 50,
    separators: ["\n\n", "\n", ";", " "],
    minChunkSize: 100,
  },
  inference: {
    maxChunkSize: 0,     // No chunking (rules are atomic)
    overlap: 0,
    separators: [],
    minChunkSize: 0,
  },
};

/**
 * Preprocessing functions by collection type
 */
const PREPROCESSING_FUNCTIONS: Record<
  CollectionType,
  (text: string) => string
> = {
  personality: (text) => {
    // Clean markup, normalize whitespace
    return text
      .replace(/[*_~`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },
  memory: (text) => {
    // Preserve structure, remove excessive newlines
    return text
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  },
  kb: (text) => {
    // Clean code blocks, normalize formatting
    return text
      .replace(/```[\s\S]*?```/g, (match) => {
        // Keep code blocks but remove language tags
        return match.replace(/```\w+\n/, "```\n");
      })
      .replace(/\s+/g, " ")
      .trim();
  },
  learning: (text) => {
    // Preserve command structure, normalize whitespace
    return text
      .replace(/\s+/g, " ")
      .replace(/\s*;\s*/g, "; ")
      .trim();
  },
  inference: (text) => {
    // Minimal preprocessing (rules are literal)
    return text.trim();
  },
};

/**
 * Embedding strategies by collection
 *
 * Each collection has optimized model, dimension, chunking, and preprocessing
 */
export const EMBEDDING_STRATEGIES: Record<CollectionType, EmbeddingStrategy> = {
  personality: {
    collection: "fazai_personality",
    model: "nomic-embed-text",
    dimension: 768,
    chunking: CHUNKING_STRATEGIES.personality,
    distanceMetric: "Dot", // Better for sparse trait vectors
    preprocess: PREPROCESSING_FUNCTIONS.personality,
    requiresEmbedding: true,
  },
  memory: {
    collection: "fazai_memory",
    model: "mxbai-embed-large",
    dimension: 1024,
    chunking: CHUNKING_STRATEGIES.memory,
    distanceMetric: "Cosine", // Good for conversational similarity
    preprocess: PREPROCESSING_FUNCTIONS.memory,
    requiresEmbedding: true,
  },
  learning: {
    collection: "fazai_learning",
    model: "mxbai-embed-large",
    dimension: 1024,
    chunking: CHUNKING_STRATEGIES.learning,
    distanceMetric: "Dot", // Commands are more literal (magnitude matters)
    preprocess: PREPROCESSING_FUNCTIONS.learning,
    requiresEmbedding: true,
    // NOTE: Should use Hybrid Search (BM25 + Vector) when available
  },
  kb: {
    collection: "fazai_kb",
    model: "mxbai-embed-large",
    dimension: 1024,
    chunking: CHUNKING_STRATEGIES.kb,
    distanceMetric: "Cosine", // Dense technical docs need direction match
    preprocess: PREPROCESSING_FUNCTIONS.kb,
    requiresEmbedding: true,
  },
  inference: {
    collection: "fazai_inference",
    model: "mxbai-embed-large", // Unused but required for interface
    dimension: 0, // No embeddings needed
    chunking: CHUNKING_STRATEGIES.inference,
    distanceMetric: "Dot", // Unused
    preprocess: PREPROCESSING_FUNCTIONS.inference,
    requiresEmbedding: false,
    // NOTE: Should migrate to payload-only collection or PostgreSQL
  },
};

/**
 * Get embedding strategy for a collection
 *
 * @param collectionType Collection type
 * @returns Embedding strategy configuration
 *
 * @example
 * ```typescript
 * const strategy = getEmbeddingStrategy("kb");
 * console.log(strategy.model); // "mxbai-embed-large"
 * console.log(strategy.dimension); // 1024
 * ```
 */
export function getEmbeddingStrategy(
  collectionType: CollectionType
): EmbeddingStrategy {
  return EMBEDDING_STRATEGIES[collectionType];
}

/**
 * Semantic text chunking with overlap
 *
 * Splits text into chunks using semantic separators (paragraphs, sentences)
 * instead of hard character limits.
 *
 * @param text Input text to chunk
 * @param config Chunking configuration
 * @returns Array of text chunks
 *
 * @example
 * ```typescript
 * const chunks = semanticChunk(longText, {
 *   maxChunkSize: 600,
 *   overlap: 100,
 *   separators: ["\n\n", "\n", ". "],
 *   minChunkSize: 300
 * });
 * ```
 */
export function semanticChunk(
  text: string,
  config: ChunkingConfig
): string[] {
  if (text.length <= config.maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  const { maxChunkSize, overlap, separators, minChunkSize } = config;

  // Recursive splitting by separator priority
  function split(
    current: string,
    separatorIndex: number = 0
  ): string[] {
    if (current.length <= maxChunkSize) {
      return [current];
    }

    if (separatorIndex >= separators.length) {
      // Fallback: hard split by characters
      const parts: string[] = [];
      for (let i = 0; i < current.length; i += maxChunkSize - overlap) {
        parts.push(current.slice(i, i + maxChunkSize));
      }
      return parts;
    }

    const separator = separators[separatorIndex];
    const parts = current.split(separator);

    const result: string[] = [];
    let currentChunk = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] + (i < parts.length - 1 ? separator : "");

      if ((currentChunk + part).length <= maxChunkSize) {
        currentChunk += part;
      } else {
        if (currentChunk.length >= minChunkSize) {
          result.push(currentChunk);
        }

        // Add overlap from previous chunk
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + part;
      }
    }

    if (currentChunk.length >= minChunkSize) {
      result.push(currentChunk);
    }

    // If we couldn't split effectively, try next separator
    if (result.length === 1 && result[0].length > maxChunkSize) {
      return split(current, separatorIndex + 1);
    }

    return result;
  }

  const initialChunks = split(text);

  // Post-process: merge very small chunks
  for (let i = 0; i < initialChunks.length; i++) {
    const chunk = initialChunks[i];

    if (chunk.length < minChunkSize && i > 0) {
      // Merge with previous chunk
      chunks[chunks.length - 1] += " " + chunk;
    } else {
      chunks.push(chunk);
    }
  }

  logger.debug(
    `Chunked text: ${text.length} chars → ${chunks.length} chunks (${chunks.map((c) => c.length).join(", ")} chars)`
  );

  return chunks;
}

/**
 * Preprocess text for embedding
 *
 * Applies collection-specific preprocessing pipeline.
 *
 * @param text Input text
 * @param collectionType Collection type
 * @returns Preprocessed text
 */
export function preprocessText(
  text: string,
  collectionType: CollectionType
): string {
  const strategy = getEmbeddingStrategy(collectionType);
  return strategy.preprocess(text);
}

/**
 * Check if model is available in Ollama
 *
 * @param model Model name
 * @param ollamaBaseUrl Ollama base URL
 * @returns True if model is available
 */
export async function isModelAvailable(
  model: EmbeddingModel,
  ollamaBaseUrl: string = getOllamaUrl()
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const models = data.models || [];
    const modelNames = models.map(
      (m: any) => m.name?.split(":")[0] || m.name
    );

    return modelNames.some(
      (name: string) => name === model || name.startsWith(model)
    );
  } catch (error: any) {
    logger.debug(`Failed to check model availability: ${error.message}`);
    return false;
  }
}

/**
 * Get fallback model if preferred model is unavailable
 *
 * @param preferredModel Preferred model
 * @param ollamaBaseUrl Ollama base URL
 * @returns Available model or null
 */
export async function getFallbackModel(
  preferredModel: EmbeddingModel,
  ollamaBaseUrl: string = getOllamaUrl()
): Promise<EmbeddingModel | null> {
  // Priority order for fallbacks
  const fallbackOrder: EmbeddingModel[] = [
    "mxbai-embed-large",
    "nomic-embed-text",
  ];

  for (const model of fallbackOrder) {
    if (model === preferredModel) {
      continue;
    }

    if (await isModelAvailable(model, ollamaBaseUrl)) {
      logger.info(`Using fallback model: ${model} (preferred: ${preferredModel})`);
      return model;
    }
  }

  return null;
}
