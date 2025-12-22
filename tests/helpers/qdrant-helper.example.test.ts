/**
 * Exemplo de uso do Qdrant Helper
 *
 * Este arquivo demonstra como usar as funções helper do Qdrant
 * para criar testes que são automaticamente pulados quando o serviço está offline.
 *
 * Para executar: npm test -- tests/helpers/qdrant-helper.example.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  isQdrantAvailable,
  describeIfQdrant,
  itIfQdrant,
  getQdrantClientForTests,
  collectionExists,
  clearQdrantAvailabilityCache,
  QDRANT_URL,
} from './qdrant-helper';

describe('Qdrant Helper - Testes de Exemplo', () => {
  it('deve exportar constantes corretas', () => {
    expect(QDRANT_URL).toBeDefined();
    expect(QDRANT_URL).toContain('http');
  });

  it('deve verificar disponibilidade do Qdrant', async () => {
    // Limpa cache para forçar nova verificação
    clearQdrantAvailabilityCache();

    const available = await isQdrantAvailable();
    expect(typeof available).toBe('boolean');

    if (available) {
      console.log(`✅ Qdrant disponível em ${QDRANT_URL}`);
    } else {
      console.log(`❌ Qdrant indisponível em ${QDRANT_URL}`);
    }
  });

  it('deve verificar se collection existe', async () => {
    const available = await isQdrantAvailable();

    if (available) {
      const exists = await collectionExists('fazai_memory');
      expect(typeof exists).toBe('boolean');
      console.log(`Collection 'fazai_memory' existe: ${exists}`);
    }
  });
});

// Exemplo 1: Suite inteira que precisa do Qdrant
describeIfQdrant('Suite que precisa do Qdrant', () => {
  it('teste 1 - só roda se Qdrant online', async () => {
    const client = await getQdrantClientForTests();
    const collections = await client.getCollections();
    expect(collections).toBeDefined();
    expect(collections.collections).toBeInstanceOf(Array);
  });

  it('teste 2 - também depende do Qdrant', async () => {
    const client = await getQdrantClientForTests();
    const collections = await client.getCollections();
    expect(collections.collections).toBeDefined();
  });
});

// Exemplo 2: Testes mistos (alguns precisam, outros não)
describe('Suite com testes mistos', () => {
  it('teste que não precisa do Qdrant', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });

  itIfQdrant('teste individual que precisa do Qdrant', async () => {
    const client = await getQdrantClientForTests();
    const collections = await client.getCollections();
    expect(collections).toBeDefined();
  });

  it('outro teste que não precisa do Qdrant', () => {
    expect(true).toBe(true);
  });
});

// Exemplo 3: Teste com timeout customizado
describe('Teste com timeout', () => {
  itIfQdrant(
    'operação lenta no Qdrant',
    async () => {
      const client = await getQdrantClientForTests();
      const collections = await client.getCollections();
      expect(collections).toBeDefined();
    },
    10000 // 10 segundos de timeout
  );
});
