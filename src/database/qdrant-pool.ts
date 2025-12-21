/**
 * Qdrant Connection Pool Module
 *
 * Provides a singleton QdrantClient instance with:
 * - Connection pooling and retry logic
 * - Circuit breaker to prevent infinite retries
 * - Health checks (periodic validation)
 * - Automatic reconnection on failure
 * - Metrics tracking (connections, queries, errors)
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { getConfigValue } from "../config";
import { logger } from "../logger";
import { withRetry } from "../utils/retry";

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
 * Implements a circuit breaker to avoid memory exhaustion on repeated failures.
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

  // State for retry and circuit breaker logic
  private isInitializing = false;
  private lastErrorTimestamp: number | null = null;

  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly COOL_DOWN_PERIOD = 30 * 1000; // 30 seconds circuit breaker

  /**
   * Get or create the Qdrant client instance with robust error handling.
   *
   * @returns Promise<QdrantClient>
   */
  async getClient(): Promise<QdrantClient> {
    // 1. Circuit Breaker: If in error state, fail fast during cooldown
    if (this.metrics.state === "error" && this.lastErrorTimestamp && Date.now() - this.lastErrorTimestamp < this.COOL_DOWN_PERIOD) {
      throw new Error(`Qdrant connection in cooldown state. Last error at ${new Date(this.lastErrorTimestamp).toISOString()}`);
    }

    // 2. If client exists and is healthy, return it
    if (this.client) {
      return this.client;
    }

    // 3. Prevent concurrent initialization attempts (race condition)
    if (this.isInitializing) {
      logger.warn("Blocked concurrent Qdrant initialization attempt.");
      throw new Error("Qdrant initialization is already in progress.");
    }

    // 4. Initialize new connection with retry logic
    this.isInitializing = true;
    try {
      await withRetry(() => this._initialize(), {
        provider: "qdrant",
        maxRetries: 3, // Max 3 retries as per BUG-001
        initialDelay: 500,
        onRetry: (attempt, error) => logger.warn(`Qdrant connection retry #${attempt} failed: ${error.message}`),
      });
      if (!this.client) {
        throw new Error("Client is null after successful initialization attempt. This should not happen.");
      }
      return this.client;
    } catch (error: any) {
      // Set circuit breaker state on final failure
      this.lastErrorTimestamp = Date.now();
      logger.error(`Qdrant connection failed after all retries: ${error.message}`);
      throw error; // Re-throw the final error to the caller
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Internal method to initialize the Qdrant client. Designed to be retried by getClient.
   */
  private async _initialize(): Promise<void> {
    this.metrics.state = "connecting";
    logger.debug("Attempting to initialize Qdrant connection...");

    const url = getConfigValue("QDRANT_URL") || "http://localhost:6333";
    const apiKey = getConfigValue("QDRANT_API_KEY");

    this.client = new QdrantClient({
      url,
      apiKey: apiKey || undefined,
      timeout: 10000, // 10s timeout for each attempt
    });

    try {
      // Simple health check: list collections
      await this.client.getCollections();
      
      this.metrics.state = "connected";
      this.lastErrorTimestamp = null; // Clear circuit breaker on success
      this.metrics.lastHealthCheck = new Date();
      logger.info(`✓ Qdrant connection pool initialized: ${url}`);

      this.startHealthCheckInterval();
    } catch (error: any) {
      this.metrics.state = "error";
      this.metrics.totalErrors++;
      this.client = null; // Ensure client is null on failure
      // Re-throw to signal failure to the withRetry wrapper
      throw new Error(`Qdrant health check failed: ${error.message}`);
    }
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
