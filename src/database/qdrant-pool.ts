/**
 * Qdrant Connection Pool Module
 *
 * Provides a singleton QdrantClient instance with:
 * - Connection pooling and retry logic
 * - Circuit breaker to prevent infinite retries (BUG-002 fix)
 * - Health checks (periodic validation)
 * - Automatic reconnection on failure
 * - Metrics tracking (connections, queries, errors)
 * - Graceful degradation when Qdrant is offline
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { getConfigValue, getQdrantUrl } from "../config";
import { logger } from "../logger";
import { CircuitBreaker, CircuitState } from "../resilience/circuit-breaker";

/**
 * Connection pool metrics
 */
interface PoolMetrics {
  totalQueries: number;
  totalErrors: number;
  lastHealthCheck: Date | null;
  reconnectionAttempts: number;
  state: "disconnected" | "connecting" | "connected" | "error";
}

/**
 * Qdrant Connection Pool
 *
 * Singleton pattern for managing a single shared QdrantClient instance.
 * Uses CircuitBreaker pattern to prevent infinite retry loops (BUG-002).
 */
class QdrantConnectionPool {
  private client: QdrantClient | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metrics: PoolMetrics = {
    totalQueries: 0,
    totalErrors: 0,
    lastHealthCheck: null,
    reconnectionAttempts: 0,
    state: "disconnected",
  };

  // Circuit Breaker para evitar loops infinitos (BUG-002)
  private circuitBreaker: CircuitBreaker;
  private isInitializing = false;

  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Configurar CircuitBreaker com limites seguros
    this.circuitBreaker = new CircuitBreaker({
      serviceName: "qdrant",
      failureThreshold: 3,        // Abre após 3 falhas
      resetTimeout: 30000,        // 30s antes de tentar novamente
      operationTimeout: 10000,    // 10s timeout por operação
    });
  }

  /**
   * Verifica se o Qdrant está disponível (circuit breaker não está aberto)
   */
  isAvailable(): boolean {
    return this.circuitBreaker.getState() !== CircuitState.OPEN;
  }

  /**
   * Retorna o estado atual do circuit breaker
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Get or create the Qdrant client instance with robust error handling.
   * Uses CircuitBreaker to fail fast when Qdrant is unavailable.
   *
   * @returns Promise<QdrantClient>
   * @throws Error if circuit is open or connection fails
   */
  async getClient(): Promise<QdrantClient> {
    // 1. Circuit Breaker: Fail fast se circuito está aberto
    if (this.circuitBreaker.getState() === CircuitState.OPEN) {
      const error = new Error('Qdrant circuit breaker is OPEN - service unavailable');
      logger.debug(error.message);
      throw error;
    }

    // 2. Se cliente já existe e está saudável, retorna
    if (this.client && this.metrics.state === "connected") {
      return this.client;
    }

    // 3. Prevenir inicializações concorrentes
    if (this.isInitializing) {
      throw new Error("Qdrant initialization already in progress");
    }

    // 4. Inicializar com proteção do CircuitBreaker
    this.isInitializing = true;
    try {
      await this.circuitBreaker.execute(async () => {
        await this._initialize();
      });

      if (!this.client) {
        throw new Error("Client is null after initialization");
      }
      return this.client;
    } catch (error: any) {
      this.metrics.state = "error";
      logger.error(`Qdrant connection failed: ${error.message}`);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Internal method to initialize the Qdrant client.
   * Called within CircuitBreaker protection.
   */
  private async _initialize(): Promise<void> {
    this.metrics.state = "connecting";
    this.metrics.reconnectionAttempts++;
    logger.debug("Attempting to initialize Qdrant connection...");

    const url = getQdrantUrl();
    const apiKey = getConfigValue("QDRANT_API_KEY");

    this.client = new QdrantClient({
      url,
      apiKey: apiKey || undefined,
      timeout: 5000, // 5s timeout (reduzido para falhar mais rápido)
    });

    // Health check: list collections
    await this.client.getCollections();

    this.metrics.state = "connected";
    this.metrics.lastHealthCheck = new Date();
    logger.info(`✓ Qdrant connected: ${url}`);

    this.startHealthCheckInterval();
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheckInterval(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.client) {
        logger.warn("Health check skipped: client not connected.");
        return;
      }
      logger.debug("Running periodic Qdrant health check...");
      try {
        await this.client.getCollections();
        this.metrics.lastHealthCheck = new Date();
        logger.debug("✓ Periodic health check passed");
      } catch (error: any) {
        logger.warn(`⚠️ Periodic health check failed: ${error.message}`);
        this.client = null; // Invalidate client to force re-initialization on next getClient call
        this.metrics.state = "disconnected";
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  // --- Public Methods for Management ---

  recordQuery(): void {
    this.metrics.totalQueries++;
  }

  recordError(): void {
    this.metrics.totalErrors++;
  }

  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.client) {
      logger.info("Closing Qdrant connection pool...");
      this.client = null;
      this.metrics.state = "disconnected";
    }
  }
}

/**
 * Singleton instance
 */
export const qdrantPool = new QdrantConnectionPool();

/**
 * Helper function to get Qdrant client
 */
export async function getQdrantClient(): Promise<QdrantClient> {
  const client = await qdrantPool.getClient();
  qdrantPool.recordQuery();
  return client;
}

/**
 * Execute a Qdrant operation with automatic error tracking
 */
export async function withQdrantClient<T>(
  fn: (client: QdrantClient) => Promise<T>
): Promise<T> {
  try {
    const client = await getQdrantClient();
    return await fn(client);
  } catch (error) {
    qdrantPool.recordError();
    throw error;
  }
}
