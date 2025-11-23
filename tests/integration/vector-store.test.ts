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

  beforeAll(async () => {
    client = new QdrantClient({ url: QDRANT_URL });

    // Limpar collections de teste
    for (const collection of FAZAI_COLLECTIONS) {
      const testCollection = `${TEST_PREFIX}${collection}`;
      try {
        await client.deleteCollection(testCollection);
      } catch {
        // Collection não existe, OK
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

    await client.createCollection(collectionName, {
      vectors: { size: 1536, distance: 'Cosine' },
    });

    // Inserir ponto de teste
    await client.upsert(collectionName, {
      wait: true,
      points: [{
        id: 'pers-1',
        vector: Array(1536).fill(0),
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

    const result = await client.retrieve(collectionName, { ids: ['pers-1'] });
    expect(result[0].payload?.admin_name).toBe('Test Admin');
    expect(result[0].payload?.expertise_areas).toEqual(['linux', 'networking']);
  });

  it('deve criar collection fazai_memory com schema correto', async () => {
    const collectionName = `${TEST_PREFIX}fazai_memory`;

    await client.createCollection(collectionName, {
      vectors: { size: 1536, distance: 'Cosine' },
    });

    // Inserir mensagem de teste
    await client.upsert(collectionName, {
      wait: true,
      points: [{
        id: 'mem-1',
        vector: Array(1536).fill(0),
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

    const result = await client.retrieve(collectionName, { ids: ['mem-1'] });
    expect(result[0].payload?.role).toBe('user');
    expect(result[0].payload?.content).toBe('Como configurar nginx?');
    expect(result[0].payload?.tags).toEqual(['nginx', 'config']);
  });

  it('deve criar collection fazai_learning com schema correto', async () => {
    const collectionName = `${TEST_PREFIX}fazai_learning`;

    await client.createCollection(collectionName, {
      vectors: { size: 1536, distance: 'Cosine' },
    });

    // Inserir padrão de aprendizado
    await client.upsert(collectionName, {
      wait: true,
      points: [{
        id: 'learn-1',
        vector: Array(1536).fill(0),
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

    const result = await client.retrieve(collectionName, { ids: ['learn-1'] });
    expect(result[0].payload?.pattern_type).toBe('error_resolution');
    expect(result[0].payload?.effectiveness).toBe(0.9);
  });

  it('deve criar collection fazai_kb com schema correto', async () => {
    const collectionName = `${TEST_PREFIX}fazai_kb`;

    await client.createCollection(collectionName, {
      vectors: { size: 1536, distance: 'Cosine' },
    });

    // Inserir solução técnica
    await client.upsert(collectionName, {
      wait: true,
      points: [{
        id: 'kb-1',
        vector: Array(1536).fill(0),
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

    const result = await client.retrieve(collectionName, { ids: ['kb-1'] });
    expect(result[0].payload?.component).toBe('nginx');
    expect(result[0].payload?.commands).toEqual(['sudo nginx -t', 'sudo systemctl reload nginx']);
    expect(result[0].payload?.confidence).toBe(0.95);
  });

  it('deve criar collection fazai_inference com schema correto', async () => {
    const collectionName = `${TEST_PREFIX}fazai_inference`;

    await client.createCollection(collectionName, {
      vectors: { size: 1536, distance: 'Cosine' },
    });

    // Inserir regra operacional
    await client.upsert(collectionName, {
      wait: true,
      points: [{
        id: 'rule-1',
        vector: Array(1536).fill(0),
        payload: {
          rule_type: 'security',
          rule_name: 'Bloquear rm -rf em produção',
          condition: 'command.includes("rm -rf") && env == "production"',
          action: 'block',
          priority: 'CRITICAL',
          enabled: true,
        },
      }],
    });

    const result = await client.retrieve(collectionName, { ids: ['rule-1'] });
    expect(result[0].payload?.rule_type).toBe('security');
    expect(result[0].payload?.priority).toBe('CRITICAL');
    expect(result[0].payload?.enabled).toBe(true);
  });

  it('deve fazer busca vetorial em fazai_kb', async () => {
    const collectionName = `${TEST_PREFIX}fazai_kb`;
    const searchVector = Array(1536).fill(0);

    const results = await client.search(collectionName, {
      vector: searchVector,
      limit: 5,
    });

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].payload?.component).toBe('nginx');
  });

  it('deve validar que todas as 5 collections foram criadas', async () => {
    const allCollections = await client.getCollections();
    const testCollections = allCollections.collections.filter(c =>
      c.name.startsWith(TEST_PREFIX)
    );

    expect(testCollections.length).toBe(5);

    const names = testCollections.map(c => c.name);
    for (const collection of FAZAI_COLLECTIONS) {
      expect(names).toContain(`${TEST_PREFIX}${collection}`);
    }
  });
});
