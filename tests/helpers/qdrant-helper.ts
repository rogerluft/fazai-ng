/**
 * Qdrant Test Helper
 *
 * Fornece utilitários para testes que dependem do Qdrant:
 * - Detecção automática de disponibilidade
 * - Skip de testes quando Qdrant está offline
 * - Wrappers para describe/it do vitest
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { describe, it } from 'vitest';

/**
 * URL do Qdrant (pode ser sobrescrita por variável de ambiente)
 */
export const QDRANT_URL = process.env.QDRANT_URL || 'http://127.0.0.1:6333';

/**
 * Timeout para verificação de disponibilidade (2 segundos)
 */
const CONNECTION_TIMEOUT = 2000;

/**
 * Cache do status de disponibilidade do Qdrant
 * Evita múltiplas verificações durante a execução dos testes
 */
let qdrantAvailabilityCache: boolean | null = null;

/**
 * Verifica se o Qdrant está disponível e respondendo
 *
 * @returns Promise<boolean> - true se disponível, false caso contrário
 *
 * @example
 * ```typescript
 * if (await isQdrantAvailable()) {
 *   // Executar teste que precisa do Qdrant
 * } else {
 *   console.log('Qdrant offline, pulando teste');
 * }
 * ```
 */
export async function isQdrantAvailable(): Promise<boolean> {
  // Retorna cache se já verificado
  if (qdrantAvailabilityCache !== null) {
    return qdrantAvailabilityCache;
  }

  try {
    const client = new QdrantClient({ url: QDRANT_URL });

    // Promise com timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT);
    });

    // Tenta obter informações do cluster (endpoint leve)
    const healthCheck = client.api('cluster').clusterStatus();

    // Race entre health check e timeout
    await Promise.race([healthCheck, timeoutPromise]);

    qdrantAvailabilityCache = true;
    return true;
  } catch (error) {
    // Qualquer erro (timeout, conexão recusada, etc) = indisponível
    qdrantAvailabilityCache = false;
    return false;
  }
}

/**
 * Limpa o cache de disponibilidade
 * Útil para forçar nova verificação
 */
export function clearQdrantAvailabilityCache(): void {
  qdrantAvailabilityCache = null;
}

/**
 * Wrapper para describe() do vitest que faz skip se Qdrant estiver offline
 *
 * Usa describe.skipIf() do vitest de forma assíncrona
 *
 * @param name - Nome da suite de testes
 * @param fn - Função com os testes
 *
 * @example
 * ```typescript
 * describeIfQdrant('Testes de embedding', () => {
 *   it('deve criar embedding', async () => {
 *     // Teste só roda se Qdrant estiver online
 *   });
 * });
 * ```
 */
export function describeIfQdrant(name: string, fn: () => void) {
  return describe.skipIf(async () => {
    const available = await isQdrantAvailable();
    if (!available) {
      console.warn(`⏭️  Skipping suite "${name}" - Qdrant not available at ${QDRANT_URL}`);
    }
    return !available;
  })(name, fn);
}

/**
 * Wrapper para it() do vitest que faz skip se Qdrant estiver offline
 *
 * Usa it.skipIf() do vitest de forma assíncrona
 *
 * @param name - Nome do teste
 * @param fn - Função do teste
 * @param timeout - Timeout opcional para o teste
 *
 * @example
 * ```typescript
 * describe('Embedding Service', () => {
 *   itIfQdrant('deve buscar embeddings similares', async () => {
 *     const results = await embeddingService.search('query');
 *     expect(results).toBeDefined();
 *   });
 * });
 * ```
 */
export function itIfQdrant(
  name: string,
  fn: () => void | Promise<void>,
  timeout?: number
) {
  return it.skipIf(async () => {
    const available = await isQdrantAvailable();
    if (!available) {
      console.warn(`⏭️  Skipping test "${name}" - Qdrant not available at ${QDRANT_URL}`);
    }
    return !available;
  })(name, fn, timeout);
}

/**
 * Cria um cliente Qdrant para uso em testes
 * Lança erro se Qdrant não estiver disponível
 *
 * @returns QdrantClient configurado
 * @throws Error se Qdrant não estiver disponível
 *
 * @example
 * ```typescript
 * const client = await getQdrantClientForTests();
 * await client.createCollection(...);
 * ```
 */
export async function getQdrantClientForTests(): Promise<QdrantClient> {
  const available = await isQdrantAvailable();

  if (!available) {
    throw new Error(`Qdrant not available at ${QDRANT_URL}. Tests requiring Qdrant will be skipped.`);
  }

  return new QdrantClient({ url: QDRANT_URL });
}

/**
 * Verifica se uma collection existe no Qdrant
 *
 * @param collectionName - Nome da collection
 * @returns Promise<boolean> - true se existe, false caso contrário
 *
 * @example
 * ```typescript
 * if (await collectionExists('fazai_memory')) {
 *   // Collection existe, pode testar
 * }
 * ```
 */
export async function collectionExists(collectionName: string): Promise<boolean> {
  try {
    const client = await getQdrantClientForTests();
    const collections = await client.getCollections();

    return collections.collections.some(
      (col: { name: string }) => col.name === collectionName
    );
  } catch (error) {
    return false;
  }
}

/**
 * Limpa uma collection para testes (apaga todos os pontos)
 * CUIDADO: Não usar em produção!
 *
 * @param collectionName - Nome da collection
 *
 * @example
 * ```typescript
 * beforeEach(async () => {
 *   await cleanCollectionForTests('test_collection');
 * });
 * ```
 */
export async function cleanCollectionForTests(collectionName: string): Promise<void> {
  try {
    const client = await getQdrantClientForTests();

    // Deleta a collection se existir
    if (await collectionExists(collectionName)) {
      await client.deleteCollection(collectionName);
    }
  } catch (error) {
    console.warn(`Failed to clean collection ${collectionName}:`, error);
  }
}
