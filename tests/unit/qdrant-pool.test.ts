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

  it('deve tentar reconectar 3 vezes e depois falhar', async () => {
    const connectionError = new Error('Connection refused');
    getCollectionsMock.mockRejectedValue(connectionError);

    await expect(qdrantPool.getClient()).rejects.toThrow('Qdrant connection failed after all retries: Qdrant health check failed: Connection refused');

    // Vitest's `vi.fn().mock.calls.length` counts the calls.
    // withRetry calls the function once, then retries N times. So 1 (initial) + 3 (retries) = 4 calls.
    // My implementation calls withRetry with maxRetries = 3. Let's check the code.
    // The `withRetry` utility tries `maxRetries` times *after* the first failure. Total attempts = 1 + maxRetries.
    // My code has `maxRetries: 3`. So it should be 4 calls total.
    expect(getCollectionsMock).toHaveBeenCalledTimes(4);
    expect(qdrantPool.getMetrics().state).toBe('error');
  });

  it('deve entrar em estado de cooldown (circuit breaker) após falha final', async () => {
    const connectionError = new Error('Connection refused');
    getCollectionsMock.mockRejectedValue(connectionError);

    // First call fails after retries
    await expect(qdrantPool.getClient()).rejects.toThrow();
    expect(getCollectionsMock).toHaveBeenCalledTimes(4);

    // Subsequent call within the cooldown period should fail immediately
    await expect(qdrantPool.getClient()).rejects.toThrow('Qdrant connection in cooldown state');

    // Should not have tried to connect again
    expect(getCollectionsMock).toHaveBeenCalledTimes(4);
  });
});
