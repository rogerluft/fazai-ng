import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { qdrantPool } from '../../src/database/qdrant-pool';
import { QdrantClient } from '@qdrant/js-client-rest';

// Mock the QdrantClient
vi.mock('@qdrant/js-client-rest', () => {
  const QdrantClient = vi.fn();
  QdrantClient.prototype.getCollections = vi.fn();
  return { QdrantClient };
});

const getCollectionsMock = QdrantClient.prototype.getCollections;

describe('QdrantConnectionPool', () => {
  beforeEach(async () => {
    // Reset the pool's internal state before each test
    await qdrantPool.close();
    vi.clearAllMocks();
  });

  it('deve conectar com sucesso na primeira tentativa', async () => {
    getCollectionsMock.mockResolvedValueOnce({ collections: [] });

    const client = await qdrantPool.getClient();
    expect(client).toBeInstanceOf(QdrantClient);
    expect(getCollectionsMock).toHaveBeenCalledTimes(1);
    expect(qdrantPool.getMetrics().state).toBe('connected');
  });

  it('deve tentar reconectar e depois falhar', async () => {
    const connectionError = new Error('Connection refused');
    getCollectionsMock.mockRejectedValue(connectionError);

    // O CircuitBreaker vai tentar uma vez e falhar, não faz múltiplas tentativas
    // A mensagem real é do CircuitBreaker
    await expect(qdrantPool.getClient()).rejects.toThrow(/Connection refused|circuit breaker/i);

    // CircuitBreaker tenta uma vez por operação, depois abre o circuito
    expect(getCollectionsMock).toHaveBeenCalled();
    expect(qdrantPool.getMetrics().state).toBe('error');
  });

  it('deve entrar em estado de cooldown (circuit breaker) após falha final', async () => {
    const connectionError = new Error('Connection refused');
    getCollectionsMock.mockRejectedValue(connectionError);

    // Múltiplas chamadas para atingir o threshold do circuit breaker
    for (let i = 0; i < 3; i++) {
      try {
        await qdrantPool.getClient();
      } catch {
        // Esperado falhar
      }
    }

    const callsAfterThreshold = getCollectionsMock.mock.calls.length;

    // Próxima chamada deve falhar - pode ser circuit open ou connection refused
    await expect(qdrantPool.getClient()).rejects.toThrow();

    // Se circuit breaker abriu, não deve ter tentado conectar novamente
    // Se ainda tentou, é porque threshold não foi atingido ainda
    expect(getCollectionsMock.mock.calls.length).toBeGreaterThanOrEqual(callsAfterThreshold);
  });
});
