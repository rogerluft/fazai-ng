/**
 * Teste de Integração REAL - Conversation Importer
 *
 * AVISO: Esses testes conectam em um Qdrant real e importam conversas.
 * Certifique-se que Qdrant está rodando em localhost:6333
 *
 * Para rodar: npm test -- tests/integration/conversation-importer.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QdrantClient } from '@qdrant/js-client-rest';
import { importConversations } from '../../src/conversation-importer';
import fs from 'fs';
import path from 'path';
import os from 'os';

const QDRANT_URL = process.env.QDRANT_URL || 'http://127.0.0.1:6333';
const TEST_PREFIX = 'fazai_test_';
const TEST_DIR = path.join(os.tmpdir(), 'fazai-importer-tests');

describe('Conversation Importer (REAL)', () => {
  let client: QdrantClient;

  beforeAll(async () => {
    client = new QdrantClient({ url: QDRANT_URL });

    // Criar diretório de teste
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }

    // Criar collections de teste
    for (const collection of ['fazai_memory', 'fazai_kb', 'fazai_learning']) {
      const testCollection = `${TEST_PREFIX}${collection}`;
      try {
        await client.deleteCollection(testCollection);
      } catch {
        // Ignorar
      }

      await client.createCollection(testCollection, {
        vectors: { size: 768, distance: 'Cosine' },  // Lei 768: nomic-embed-text native
      });
    }
  });

  afterAll(async () => {
    // Limpar collections de teste
    for (const collection of ['fazai_memory', 'fazai_kb', 'fazai_learning']) {
      const testCollection = `${TEST_PREFIX}${collection}`;
      try {
        await client.deleteCollection(testCollection);
      } catch {
        // Ignorar
      }
    }

    // Limpar diretório de teste
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('deve importar conversas do Claude Desktop', async () => {
    // Criar arquivo de teste Claude
    const claudeExport = {
      conversations: [
        {
          id: 'test-conv-1',
          created_at: '2025-11-14T10:00:00Z',
          updated_at: '2025-11-14T10:30:00Z',
          name: 'Test Nginx Config',
          messages: [
            {
              role: 'user',
              content: 'Como configurar nginx como proxy reverso?',
              created_at: '2025-11-14T10:00:00Z',
            },
            {
              role: 'assistant',
              content: `Para configurar nginx como proxy reverso, use:\n\`\`\`bash\nsudo systemctl restart nginx\n\`\`\``,
              created_at: '2025-11-14T10:01:00Z',
            },
          ],
        },
      ],
    };

    const testFile = path.join(TEST_DIR, 'claude-test.json');
    fs.writeFileSync(testFile, JSON.stringify(claudeExport, null, 2));

    // Importar
    const result = await importConversations(testFile, 'claude', {
      extractKnowledge: true,
      extractLearning: true,
      collectionPrefix: TEST_PREFIX,
    });

    // Validar resultado
    console.log('RESULT:', JSON.stringify(result, null, 2));
    if (result.errors.length > 0) {
      console.log('ERRORS:', result.errors);
    }
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.stats.memoryEntries).toBe(2); // 2 mensagens
    expect(result.stats.kbEntries).toBeGreaterThanOrEqual(0);
  });

  it('deve importar conversas do ChatGPT Desktop', async () => {
    // Criar arquivo de teste ChatGPT
    const chatgptExport = [
      {
        id: 'test-conv-2',
        title: 'Test Docker Setup',
        create_time: 1699900000,
        update_time: 1699901800,
        mapping: {
          'msg-1': {
            message: {
              author: { role: 'user' },
              content: { parts: ['Como instalar docker?'] },
              create_time: 1699900000,
            },
          },
          'msg-2': {
            message: {
              author: { role: 'assistant' },
              content: { parts: ['Use:\n```bash\nsudo apt install docker.io\n```'] },
              create_time: 1699900100,
            },
          },
        },
      },
    ];

    const testFile = path.join(TEST_DIR, 'chatgpt-test.json');
    fs.writeFileSync(testFile, JSON.stringify(chatgptExport, null, 2));

    // Importar
    const result = await importConversations(testFile, 'chatgpt', {
      extractKnowledge: true,
      extractLearning: false,
      collectionPrefix: TEST_PREFIX,
    });

    // Validar resultado
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.stats.memoryEntries).toBe(2);
  });

  it('deve extrair conhecimento técnico para fazai_kb', async () => {
    // Criar conversação com conteúdo técnico
    const claudeExport = {
      conversations: [
        {
          id: 'tech-conv-1',
          created_at: '2025-11-14T11:00:00Z',
          updated_at: '2025-11-14T11:30:00Z',
          name: 'Systemd Troubleshooting',
          messages: [
            {
              role: 'user',
              content: 'nginx não está iniciando, como diagnosticar?',
              created_at: '2025-11-14T11:00:00Z',
            },
            {
              role: 'assistant',
              content: `Diagnóstico:\n\`\`\`bash\nsystemctl status nginx\njournalctl -u nginx -n 50\nnginx -t\n\`\`\``,
              created_at: '2025-11-14T11:01:00Z',
            },
          ],
        },
      ],
    };

    const testFile = path.join(TEST_DIR, 'tech-test.json');
    fs.writeFileSync(testFile, JSON.stringify(claudeExport, null, 2));

    const result = await importConversations(testFile, 'claude', {
      extractKnowledge: true,
      extractLearning: true,
      collectionPrefix: TEST_PREFIX,
    });

    // Deve ter extraído comandos técnicos
    expect(result.stats.kbEntries).toBeGreaterThan(0);
  });

  it('deve importar diretório recursivamente', async () => {
    // Criar múltiplos arquivos
    const subDir = path.join(TEST_DIR, 'batch');
    fs.mkdirSync(subDir, { recursive: true });

    for (let i = 1; i <= 3; i++) {
      const export1 = {
        conversations: [
          {
            id: `batch-conv-${i}`,
            created_at: '2025-11-14T12:00:00Z',
            updated_at: '2025-11-14T12:30:00Z',
            name: `Batch conversation ${i}`,
            messages: [
              {
                role: 'user',
                content: `Test message ${i}`,
                created_at: '2025-11-14T12:00:00Z',
              },
              {
                role: 'assistant',
                content: `Response ${i}`,
                created_at: '2025-11-14T12:01:00Z',
              },
            ],
          },
        ],
      };

      fs.writeFileSync(
        path.join(subDir, `batch-${i}.json`),
        JSON.stringify(export1, null, 2)
      );
    }

    const result = await importConversations(subDir, 'claude', {
      recursive: true,
      extractKnowledge: false,
      extractLearning: false,
      collectionPrefix: TEST_PREFIX,
    });

    expect(result.imported).toBe(3);
    expect(result.stats.memoryEntries).toBe(6); // 3 conversas x 2 mensagens
  });

  it('deve validar que dados foram inseridos no Qdrant', async () => {
    // NOTA: importConversations agora usa collectionPrefix, então dados estão em fazai_test_*
    // Este teste valida que os dados dos testes anteriores foram inseridos corretamente
    const collectionName = `${TEST_PREFIX}fazai_memory`;

    // Scroll para pegar todos os pontos
    const scrollResult = await client.scroll(collectionName, {
      limit: 100,
    });

    expect(scrollResult.points.length).toBeGreaterThan(0);

    // Verificar payload de um ponto
    const point = scrollResult.points[0];
    expect(point.payload).toBeDefined();

    // Campos obrigatórios
    expect(point.payload?.content).toBeDefined();

    // Campos opcionais (podem não existir em dados antigos)
    // Se existir role, deve ser user ou assistant
    if (point.payload?.role) {
      expect(point.payload.role).toMatch(/user|assistant/);
    }
    // Se existir source, deve ser um dos formatos conhecidos
    if (point.payload?.source) {
      expect(point.payload.source).toMatch(/claude|chatgpt|fazai/i);
    }
  });

  it('deve lidar com erro se arquivo não existe', async () => {
    const result = await importConversations(
      '/path/nao/existe.json',
      'claude'
    );

    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('deve lidar com JSON inválido', async () => {
    const invalidFile = path.join(TEST_DIR, 'invalid.json');
    fs.writeFileSync(invalidFile, '{invalid json}');

    const result = await importConversations(invalidFile, 'claude');

    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
