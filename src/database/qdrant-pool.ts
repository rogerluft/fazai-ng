/**
 * Qdrant Connection Pool Module
 *
 * Provides a singleton QdrantClient instance with:
 * - Connection pooling
 * - Health checks (periodic validation)
 * - Automatic reconnection on failure
 * - Metrics tracking (connections, queries, errors)
 *
 * Best Practices:
 * - Single shared client instance (reduces overhead)
 * - Validates connection every 5 minutes
 * - Auto-reconnects on health check failure
 * - Tracks usage metrics for monitoring
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { getConfigValue } from "../config";
import { logger } from "../logger";
import { withRetry } from "../utils/retry";

/**
 * Connection pool metrics
 */
interface PoolMetrics {
  /**
   * Total number of queries executed
   */
  totalQueries: number;

  /**
   * Total number of connection errors
   */
  totalErrors: number;

  /**
   * Last successful health check timestamp
   */
  lastHealthCheck: Date | null;

  /**
   * Number of reconnection attempts
   */
  reconnectionAttempts: number;

  /**
   * Current connection state
   */
  state: "disconnected" | "connecting" | "connected" | "error";
}

/**
 * Qdrant Connection Pool
 *
 * Singleton pattern for managing a single shared QdrantClient instance.
 */
class QdrantConnectionPool {
  private client: QdrantClient | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: Date | null = null;
  private metrics: PoolMetrics = {
    totalQueries: 0,
    totalErrors: 0,
    lastHealthCheck: null,
    reconnectionAttempts: 0,
    state: "disconnected",
  };

  /**
   * Health check interval in milliseconds (5 minutes)
   */
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;

  /**
   * Get or create the Qdrant client instance
   *
   * @returns Promise<QdrantClient>
   *
   * @example
   * const client = await qdrantPool.getClient();
   * const collections = await client.getCollections();
   */
  async getClient(): Promise<QdrantClient> {
    // If client exists and is healthy, return it
    if (this.client && await this.isHealthy()) {
      return this.client;
    }

    // Otherwise, initialize new connection
    await this.initialize();
    return this.client!;
  }

  /**
   * Initialize the Qdrant client
   */
  private async initialize(): Promise<void> {
    try {
      this.metrics.state = "connecting";
      logger.debug("Initializing Qdrant connection pool...");

      const url = getConfigValue("QDRANT_URL") || "http://localhost:6333";
      const apiKey = getConfigValue("QDRANT_API_KEY");

      // Create new client
      this.client = new QdrantClient({
        url,
        apiKey: apiKey || undefined,
        timeout: 30000, // 30s timeout
      });

      // Validate connection
      await this.validateConnection();

      this.metrics.state = "connected";
      logger.info(`✓ Qdrant connection pool initialized: ${url}`);

      // Start health check interval
      this.startHealthCheckInterval();
    } catch (error: any) {
      this.metrics.state = "error";
      this.metrics.totalErrors++;
      logger.error(`Failed to initialize Qdrant connection pool: ${error.message}`);
      this.client = null;
      throw new Error(`Qdrant connection failed: ${error.message}`);
    }
  }

  /**
   * Validate that the connection is working
   */
  private async validateConnection(): Promise<void> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    try {
      // Simple health check: list collections
      await withRetry(
        () => this.client!.getCollections(),
        {
          provider: "qdrant",
          maxRetries: 2,
        }
      );

      this.lastHealthCheck = new Date();
      this.metrics.lastHealthCheck = this.lastHealthCheck;
      logger.debug("✓ Qdrant connection validated");
    } catch (error: any) {
      logger.error(`Qdrant connection validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if the connection is healthy
   *
   * Returns true if:
   * - Client exists
   * - Last health check was within HEALTH_CHECK_INTERVAL
   */
  private async isHealthy(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    // Check if health check is recent enough
    if (
      this.lastHealthCheck &&
      Date.now() - this.lastHealthCheck.getTime() < this.HEALTH_CHECK_INTERVAL
    ) {
      return true;
    }

    // Perform health check
    try {
      await this.validateConnection();
      return true;
    } catch {
      return false;
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
      logger.debug("Running periodic Qdrant health check...");

      try {
        await this.validateConnection();
        logger.debug("✓ Periodic health check passed");
      } catch (error: any) {
        logger.warn(`⚠️  Periodic health check failed: ${error.message}`);
        this.metrics.reconnectionAttempts++;

        // Attempt reconnection
        logger.info("Attempting to reconnect to Qdrant...");
        try {
          this.client = null; // Force reinitialization
          await this.initialize();
          logger.info("✓ Reconnection successful");
        } catch (reconnectError: any) {
          logger.error(`Failed to reconnect: ${reconnectError.message}`);
          this.metrics.state = "error";
        }
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Record a query execution
   */
  recordQuery(): void {
    this.metrics.totalQueries++;
  }

  /**
   * Record an error
   */
  recordError(): void {
    this.metrics.totalErrors++;
  }

  /**
   * Get connection pool metrics
   *
   * @returns PoolMetrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Get a formatted metrics summary
   *
   * @returns String with formatted metrics
   */
  getMetricsSummary(): string {
    const uptime = this.lastHealthCheck
      ? Math.floor((Date.now() - this.lastHealthCheck.getTime()) / 1000)
      : null;

    return `
📊 Qdrant Connection Pool Metrics:
  State: ${this.metrics.state}
  Total Queries: ${this.metrics.totalQueries.toLocaleString()}
  Total Errors: ${this.metrics.totalErrors}
  Last Health Check: ${this.lastHealthCheck?.toISOString() || "Never"}
  Uptime: ${uptime !== null ? `${uptime}s` : "N/A"}
  Reconnection Attempts: ${this.metrics.reconnectionAttempts}
    `.trim();
  }

  /**
   * Close the connection pool
   *
   * Stops health checks and clears the client.
   * Should be called on application shutdown.
   */
  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.client) {
      logger.info("Closing Qdrant connection pool...");
      this.client = null;
      this.metrics.state = "disconnected";
      logger.info("✓ Qdrant connection pool closed");
    }
  }

  /**
   * Force a reconnection
   *
   * Useful for testing or manual recovery.
   */
  async reconnect(): Promise<void> {
    logger.info("Forcing Qdrant reconnection...");
    this.client = null;
    this.metrics.reconnectionAttempts++;
    await this.initialize();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.totalQueries = 0;
    this.metrics.totalErrors = 0;
    this.metrics.reconnectionAttempts = 0;
    logger.debug("✓ Qdrant pool metrics reset");
  }
}

/**
 * Singleton instance
 */
export const qdrantPool = new QdrantConnectionPool();

/**
 * Helper function to get Qdrant client
 *
 * Convenience wrapper that automatically tracks queries.
 *
 * @returns Promise<QdrantClient>
 *
 * @example
 * const client = await getQdrantClient();
 * const collections = await client.getCollections();
 */
export async function getQdrantClient(): Promise<QdrantClient> {
  const client = await qdrantPool.getClient();
  qdrantPool.recordQuery();
  return client;
}

/**
 * Execute a Qdrant operation with automatic error tracking
 *
 * @param fn Function that uses QdrantClient
 * @returns Promise with function result
 *
 * @example
 * const collections = await withQdrantClient(async (client) => {
 *   return await client.getCollections();
 * });
 */
export async function withQdrantClient<T>(
  fn: (client: QdrantClient) => Promise<T>
): Promise<T> {
  try {
    const client = await getQdrantClient();
    const result = await fn(client);
    return result;
  } catch (error) {
    qdrantPool.recordError();
    throw error;
  }
}
