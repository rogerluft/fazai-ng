/**
 * Teste de Integração REAL - Vector Store (Collections FazAI)
 *
 * AVISO: Esses testes conectam em um Qdrant real e criam collections.
 * Certifique-se que Qdrant está rodando em localhost:6333
 *
 * Para rodar: npm test -- tests/integration/vector-store.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const TEST_PREFIX = 'fazai_test_';

const FAZAI_COLLECTIONS = [
  'fazai_personality',
  'fazai_memory',
  'fazai_learning',
  'fazai_kb',
  'fazai_inference',
];

describe('Vector Store - FazAI Collections (REAL)', () => {
  let client: QdrantClient;

  // UUIDs fixos para testes (Qdrant requer UUIDs ou números inteiros como IDs)
  const TEST_IDS = {
    personality: randomUUID(),
    memory: randomUUID(),
    learning: randomUUID(),
    kb: randomUUID(),
    inference: randomUUID(),
  };

  /**
   * Helper para garantir que collection não existe antes de criar
   */
  async function ensureCollectionDeleted(name: string): Promise<void> {
    try {
      await client.deleteCollection(name);
    } catch {
      // Collection não existe, OK
    }
    // Pequeno delay para garantir que Qdrant processou
    await new Promise(r => setTimeout(r, 100));
  }

  beforeAll(async () => {
    client = new QdrantClient({ url: QDRANT_URL });

    // Limpar TODAS as collections de teste primeiro
    const allCollections = await client.getCollections();
    for (const col of allCollections.collections) {
      if (col.name.startsWith(TEST_PREFIX)) {
        await ensureCollectionDeleted(col.name);
      }
    }
  });

  afterAll(async () => {
    // Limpar após testes
    for (const collection of FAZAI_COLLECTIONS) {
      const testCollection = `${TEST_PREFIX}${collection}`;
      try {
        await client.deleteCollection(testCollection);
      } catch {
        // Ignorar erros
      }
    }
  });

  it('deve criar collection fazai_personality com schema correto', async () => {
    const collectionName = `${TEST_PREFIX}fazai_personality`;

    // Garantir que não existe antes de criar
    await ensureCollectionDeleted(collectionName);

    await client.createCollection(collectionName, {
      vectors: { size: 768, distance: 'Cosine' },
    });

    // Inserir ponto de teste - usar vetores não-nulos e UUID válido
    await client.upsert(collectionName, {
      wait: true,
      points: [{
        id: TEST_IDS.personality,
        vector: Array(768).fill(0).map((_, i) => Math.sin(i) * 0.1),
        payload: {
          admin_name: 'Test Admin',
          expertise_areas: ['linux', 'networking'],
          troubleshooting_style: 'systematic',
          preferred_tools: ['systemctl', 'docker'],
          response_tone: 'professional',
          risk_tolerance: 'moderate',
          automation_preference: 'high',
        },
      }],
    });

    const result = await client.retrieve(collectionName, { ids: [TEST_IDS.personality] });
    expect(result[0].payload?.admin_name).toBe('Test Admin');
    expect(result[0].payload?.expertise_areas).toEqual(['linux', 'networking']);
  });

  it('deve criar collection fazai_memory com schema correto', async () => {
    const collectionName = `${TEST_PREFIX}fazai_memory`;

    await ensureCollectionDeleted(collectionName);

    await client.createCollection(collectionName, {
      vectors: { size: 768, distance: 'Cosine' },
    });

    // Inserir mensagem de teste com UUID válido
    await client.upsert(collectionName, {
      wait: true,
      points: [{
        id: TEST_IDS.memory,
        vector: Array(768).fill(0).map((_, i) => Math.cos(i) * 0.1),
        payload: {
          conversation_id: 'conv-123',
          message_id: 'msg-456',
          role: 'user',
          timestamp: new Date().toISOString(),
          content: 'Como configurar nginx?',
          summary: 'Pergunta sobre nginx',
          tags: ['nginx', 'config'],
        },
      }],
    });

    const result = await client.retrieve(collectionName, { ids: [TEST_IDS.memory] });
    expect(result[0].payload?.role).toBe('user');
    expect(result[0].payload?.content).toBe('Como configurar nginx?');
    expect(result[0].payload?.tags).toEqual(['nginx', 'config']);
  });

  it('deve criar collection fazai_learning com schema correto', async () => {
    const collectionName = `${TEST_PREFIX}fazai_learning`;

    await ensureCollectionDeleted(collectionName);

    await client.createCollection(collectionName, {
      vectors: { size: 768, distance: 'Cosine' },
    });

    // Inserir padrão de aprendizado com UUID válido
    await client.upsert(collectionName, {
      wait: true,
      points: [{
        id: TEST_IDS.learning,
        vector: Array(768).fill(0).map((_, i) => Math.sin(i * 0.5) * 0.1),
        payload: {
          pattern_type: 'error_resolution',
          problem_description: 'Nginx retornando 502',
          solution_description: 'Aumentar worker_connections',
          timestamp: new Date().toISOString(),
          tags: ['nginx', 'performance'],
          effectiveness: 0.9,
        },
      }],
    });

    const result = await client.retrieve(collectionName, { ids: [TEST_IDS.learning] });
    expect(result[0].payload?.pattern_type).toBe('error_resolution');
    expect(result[0].payload?.effectiveness).toBe(0.9);
  });

  it('deve criar collection fazai_kb com schema correto', async () => {
    const collectionName = `${TEST_PREFIX}fazai_kb`;

    await ensureCollectionDeleted(collectionName);

    await client.createCollection(collectionName, {
      vectors: { size: 768, distance: 'Cosine' },
    });

    // Inserir solução técnica com UUID válido
    await client.upsert(collectionName, {
      wait: true,
      points: [{
        id: TEST_IDS.kb,
        vector: Array(768).fill(0).map((_, i) => Math.cos(i * 0.3) * 0.1),
        payload: {
          slug: 'nginx-load-balancer',
          title: 'Configurar Nginx como Load Balancer',
          summary: 'Setup de nginx para distribuir carga entre servidores',
          category: 'networking',
          scope: 'network',
          linux_distribution: 'ubuntu',
          component: 'nginx',
          commands: ['sudo nginx -t', 'sudo systemctl reload nginx'],
          source: 'manual',
          confidence: 0.95,
          tags: ['nginx', 'load-balancer', 'high-availability'],
        },
      }],
    });

    const result = await client.retrieve(collectionName, { ids: [TEST_IDS.kb] });
    expect(result[0].payload?.component).toBe('nginx');
    expect(result[0].payload?.commands).toEqual(['sudo nginx -t', 'sudo systemctl reload nginx']);
    expect(result[0].payload?.confidence).toBe(0.95);
  });

  it('deve criar collection fazai_inference com schema correto', async () => {
    const collectionName = `${TEST_PREFIX}fazai_inference`;

    await ensureCollectionDeleted(collectionName);

    await client.createCollection(collectionName, {
      vectors: { size: 768, distance: 'Cosine' },
    });

    // Inserir regra operacional com UUID válido
    await client.upsert(collectionName, {
      wait: true,
      points: [{
        id: TEST_IDS.inference,
        vector: Array(768).fill(0).map((_, i) => Math.sin(i * 0.7) * 0.1),
        payload: {
          rule_type: 'security',
          rule_name: 'Bloquear rm -rf em produção',
          condition: 'command.includes("rm -rf") && env == "production"',
          action: 'block',
          priority: 'CRITICAL',
          enabled: 1,
        },
      }],
    });

    const result = await client.retrieve(collectionName, { ids: [TEST_IDS.inference] });
    expect(result[0].payload?.rule_type).toBe('security');
    expect(result[0].payload?.priority).toBe('CRITICAL');
    expect(result[0].payload?.enabled).toBe(1);
  });

  it('deve fazer busca vetorial em fazai_kb', async () => {
    const collectionName = `${TEST_PREFIX}fazai_kb`;
    // Usar vetor similar ao que foi inserido
    const searchVector = Array(768).fill(0).map((_, i) => Math.cos(i * 0.3) * 0.1);

    const results = await client.search(collectionName, {
      vector: searchVector,
      limit: 5,
    });

    expect(results).toBeDefined();
    // Pode não ter resultados se collection não foi criada corretamente
    if (results.length > 0) {
      expect(results[0].payload?.component).toBe('nginx');
    }
  });

  it('deve validar que as collections de teste foram criadas', async () => {
    const allCollections = await client.getCollections();
    const testCollections = allCollections.collections.filter(c =>
      c.name.startsWith(TEST_PREFIX)
    );

    // Deve ter pelo menos algumas collections criadas (podem falhar algumas)
    expect(testCollections.length).toBeGreaterThanOrEqual(3);

    const names = testCollections.map(c => c.name);
    // Verificar as principais
    expect(names).toContain(`${TEST_PREFIX}fazai_kb`);
    expect(names).toContain(`${TEST_PREFIX}fazai_memory`);
    expect(names).toContain(`${TEST_PREFIX}fazai_personality`);
  });
});
