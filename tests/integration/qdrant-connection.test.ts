/**
 * Teste de Integração REAL - Conexão com Qdrant
 *
 * AVISO: Esses testes conectam em um Qdrant real.
 * Certifique-se que Qdrant está rodando em localhost:6333
 *
 * Para rodar: npm test -- tests/integration/qdrant-connection.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const TEST_COLLECTION = 'fazai_test_connection';

describe('Qdrant Connection Tests (REAL)', () => {
  let client: QdrantClient;

  beforeAll(async () => {
    client = new QdrantClient({ url: QDRANT_URL });

    // Limpar collection de teste se existir
    try {
      await client.deleteCollection(TEST_COLLECTION);
    } catch {
      // Collection não existe, OK
    }
  });

  it('deve conectar no Qdrant com sucesso', async () => {
    const collections = await client.getCollections();
    expect(collections).toBeDefined();
    expect(collections.collections).toBeInstanceOf(Array);
  });

  it('deve criar collection de teste', async () => {
    await client.createCollection(TEST_COLLECTION, {
      vectors: {
        size: 1536,
        distance: 'Cosine',
      },
    });

    const info = await client.getCollection(TEST_COLLECTION);
    expect(info.status).toBe('green');
    expect(info.config?.params.vectors?.size).toBe(1536);
    expect(info.config?.params.vectors?.distance).toBe('Cosine');
  });

  it('deve inserir ponto no Qdrant', async () => {
    const testPoint = {
      id: 'test-point-1',
      vector: Array(1536).fill(0.1),
      payload: {
        test: true,
        message: 'Integration test point',
        timestamp: new Date().toISOString(),
      },
    };

    await client.upsert(TEST_COLLECTION, {
      wait: true,
      points: [testPoint],
    });

    const result = await client.retrieve(TEST_COLLECTION, {
      ids: ['test-point-1'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-point-1');
    expect(result[0].payload?.test).toBe(true);
    expect(result[0].payload?.message).toBe('Integration test point');
  });

  it('deve fazer busca vetorial', async () => {
    const searchVector = Array(1536).fill(0.1);

    const searchResult = await client.search(TEST_COLLECTION, {
      vector: searchVector,
      limit: 5,
    });

    expect(searchResult).toBeDefined();
    expect(searchResult.length).toBeGreaterThan(0);
    expect(searchResult[0].id).toBe('test-point-1');
    expect(searchResult[0].score).toBeGreaterThan(0);
  });

  it('deve deletar ponto do Qdrant', async () => {
    await client.delete(TEST_COLLECTION, {
      wait: true,
      points: ['test-point-1'],
    });

    const result = await client.retrieve(TEST_COLLECTION, {
      ids: ['test-point-1'],
    });

    expect(result).toHaveLength(0);
  });

  it('deve deletar collection de teste', async () => {
    await client.deleteCollection(TEST_COLLECTION);

    try {
      await client.getCollection(TEST_COLLECTION);
      // Se chegou aqui, collection ainda existe (erro)
      expect(true).toBe(false);
    } catch (error: any) {
      // Collection não existe (esperado)
      expect(error.message).toContain('Not found');
    }
  });
});
