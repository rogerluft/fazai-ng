
import { pipeline, env } from '@xenova/transformers';
import { logger } from '../logger';
import { EmbeddingService, CollectionType } from './embeddings-refactored';

// Configuration for Transformers.js
env.allowLocalModels = true;
env.localModelPath = 'models/';

const MODEL_NAME = 'Xenova/multilingual-e5-base';
const MODEL_DIMENSION = 768;

class TransformersEmbeddingService implements EmbeddingService {
  private extractor = null;
  private model: string;
  private dimension: number;

  constructor(model = MODEL_NAME, dimension = MODEL_DIMENSION) {
    this.model = model;
    this.dimension = dimension;
  }

  private async initialize() {
    if (this.extractor) return;
    try {
      logger.info(`Initializing Transformers.js embedding model: ${this.model}`);
      this.extractor = await pipeline('feature-extraction', this.model);
      logger.info(`Model ${this.model} initialized successfully.`);
    } catch (error) {
      logger.error('Failed to initialize Transformers.js model:', error);
      throw new Error('Could not load the embedding model.');
    }
  }

  async generate(text: string, collectionType: CollectionType): Promise<number[]> {
    const embeddings = await this.generateBatch([text], collectionType);
    return embeddings[0] || [];
  }

  async generateBatch(texts: string[], collectionType: CollectionType): Promise<number[][]> {
    await this.initialize();
    if (!this.extractor || texts.length === 0) {
      return [];
    }

    try {
      const embeddings = await this.extractor(texts, {
        pooling: 'mean',
        normalize: true,
      });
      return embeddings.tolist();
    } catch (error) {
      logger.error('Error generating embeddings with Transformers.js:', error);
      // Return zero vectors for failed batches
      return texts.map(() => new Array(this.dimension).fill(0));
    }
  }

  async generateChunked(text: string, collectionType: CollectionType): Promise<Array<{ chunk: string; embedding: number[] }>> {
    // Basic chunking, can be improved with semantic chunking later
    const chunks = text.match(/.{1,512}/g) || [];
    const embeddings = await this.generateBatch(chunks, collectionType);
    return chunks.map((chunk, i) => ({
      chunk,
      embedding: embeddings[i],
    }));
  }

  getInfo() {
    return {
      provider: 'transformers.js' as const,
      model: this.model,
      dimension: this.dimension,
      isLocal: true,
    };
  }
}

export { TransformersEmbeddingService, MODEL_DIMENSION, MODEL_NAME };
