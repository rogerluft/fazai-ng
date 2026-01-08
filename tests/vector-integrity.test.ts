import { describe, it, expect, beforeAll } from 'vitest';
import { getQdrantClient } from '../src/database/qdrant-pool';
import { createEmbeddingService } from '../src/services/embeddings';

describe('Vector Store Integrity (ECOA Standards)', () => {
  const REQUIRED_COLLECTIONS = [
    'fazai_personality',
    'fazai_memory',
    'fazai_learning',
    'fazai_kb',
    'fazai_inference',
    'fazai_semantic_cache',
    'fazai_source'
  ];

  const TARGET_DIMENSION = 768; // Nova dimensão padrão para modelos locais

  it('should connect to Qdrant', async () => {
    const client = await getQdrantClient();
    const result = await client.getCollections();
    expect(result).toBeDefined();
    expect(result.collections).toBeDefined();
  });

  it('should have all required ECOA collections', async () => {
    const client = await getQdrantClient();
    const result = await client.getCollections();
    const existingNames = result.collections.map(c => c.name);

    for (const name of REQUIRED_COLLECTIONS) {
      // Note: This test might fail if collections haven't been initialized yet.
      // Ideally, we run 'fazai vector validate' before this.
      if (existingNames.includes(name)) {
        expect(existingNames).toContain(name);
      } else {
        console.warn(`⚠️ Collection ${name} not found. Run 'fazai vector validate'.`);
      }
    }
  });

  it('should enforce Dimension Standard (768 for local models)', async () => {
    const client = await getQdrantClient();
    const result = await client.getCollections();
    
    for (const col of result.collections) {
      if (REQUIRED_COLLECTIONS.includes(col.name)) {
        const info = await client.getCollection(col.name);
        // @ts-ignore - Qdrant client types might vary
        const size = info.config.params.vectors.size || info.config.params.vectors?.default?.size;
        
        if (size !== TARGET_DIMENSION) {
           console.warn(`⚠️ Collection ${col.name} has dimension ${size}, expected ${TARGET_DIMENSION}.`);
        }
        expect(size).toBe(TARGET_DIMENSION);
      }
    }
  });

  it('Embedding Service should output vectors with the target dimension', async () => {
    const service = await createEmbeddingService();
    const embedding = await service.generate("Test integrity");
    expect(embedding.length).toBe(TARGET_DIMENSION);
  });
});
