/**
 * Semantic Cache Module
 *
 * Advanced caching system using Qdrant for similarity-based lookups.
 * Unlike traditional caches that only match identical queries, this cache
 * matches semantically similar queries using vector embeddings.
 *
 * Features:
 * - Similarity search (finds similar queries, not just exact matches)
 * - Configurable similarity threshold (0-1 scale)
 * - TTL (Time To Live) with automatic expiration
 * - LRU (Least Recently Used) eviction
 * - Hit rate metrics and monitoring
 * - Per-provider/per-model isolation
 *
 * Architecture:
 * 1. Query → Generate embedding
 * 2. Search Qdrant by vector similarity
 * 3. If score > threshold AND not expired → Cache HIT
 * 4. Otherwise → Cache MISS, store new response
 * 5. Periodic cleanup of expired entries
 *
 * Example:
 * ```typescript
 * const cache = await SemanticCache.getInstance();
 *
 * // Try to get from cache
 * const cached = await cache.lookup("Como instalar nginx?", "qwen2.5:7b", "ollama");
 *
 * if (cached) {
 *   console.log("Cache HIT:", cached);
 * } else {
 *   // Cache MISS, call provider
 *   const response = await callProvider(...);
 *   await cache.store("Como instalar nginx?", response, "qwen2.5:7b", "ollama");
 * }
 * ```
 */

import { randomUUID } from "crypto";
import { logger } from "../logger";
import { getQdrantClient } from "../database/qdrant-pool";
import { createEmbeddingService } from "./embeddings";

/**
 * Cache entry stored in Qdrant
 */
interface CacheEntry {
  query: string;
  response: string;
  model: string;
  provider: string;
  timestamp: number;
  hits: number;
  lastHit: number;
  ttl: number; // milliseconds
}

/**
 * Cache lookup options
 */
export interface CacheLookupOptions {
  /**
   * Minimum similarity score (0-1)
   * Default: 0.95 (very similar)
   *
   * Higher = more strict (only very similar queries match)
   * Lower = more lenient (broader matches)
   */
  similarityThreshold?: number;

  /**
   * Maximum age in milliseconds
   * Default: 1 hour (3600000ms)
   *
   * Entries older than this are considered expired
   */
  maxAge?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  avgAge: number; // seconds
  totalHits: number;
  totalMisses: number;
  hitRate: number; // percentage
  oldestEntry: number; // seconds
  newestEntry: number; // seconds
}

/**
 * Semantic Cache using Qdrant for similarity search
 *
 * Singleton pattern - use getInstance() to access.
 */
export class SemanticCache {
  private static instance: SemanticCache | null = null;
  private readonly collectionName = "fazai_semantic_cache";
  private initialized = false;

  // Cache configuration
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.95; // Very similar
  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_CACHE_SIZE = 10000; // Maximum entries
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

  // Metrics
  private metrics = {
    hits: 0,
    misses: 0,
    stores: 0,
    evictions: 0,
  };

  private cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Private constructor (singleton pattern)
   */
  private constructor() {}

  /**
   * Get or create singleton instance
   */
  static async getInstance(): Promise<SemanticCache> {
    if (!SemanticCache.instance) {
      SemanticCache.instance = new SemanticCache();
      await SemanticCache.instance.initialize();
    }
    return SemanticCache.instance;
  }

  /**
   * Initialize Qdrant collection for semantic cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const client = await getQdrantClient();
      const embedService = await createEmbeddingService();
      const { dimension } = embedService.getInfo();

      logger.debug(`Initializing semantic cache with ${dimension} dimensions...`);

      // Check if collection exists
      const collections = await client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName
      );

      if (!exists) {
        logger.info(`Creating semantic cache collection: ${this.collectionName}`);
        await client.createCollection(this.collectionName, {
          vectors: {
            size: dimension,
            distance: "Cosine", // Best for semantic similarity
          },
        });

        // Create payload indexes for fast filtering
        await client.createPayloadIndex(this.collectionName, {
          field_name: "model",
          field_schema: "keyword",
        });

        await client.createPayloadIndex(this.collectionName, {
          field_name: "provider",
          field_schema: "keyword",
        });

        await client.createPayloadIndex(this.collectionName, {
          field_name: "timestamp",
          field_schema: "integer",
        });

        logger.info("✓ Semantic cache indexes created");
      }

      this.initialized = true;
      logger.info("✓ Semantic cache initialized");

      // Start periodic cleanup
      this.startCleanupTimer();
    } catch (error: any) {
      logger.error(`Failed to initialize semantic cache: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lookup query in cache by semantic similarity
   *
   * @param query User query text
   * @param model Model name (e.g., "qwen2.5:7b")
   * @param provider Provider name (e.g., "ollama")
   * @param options Optional lookup configuration
   * @returns Cached response if found, null if miss
   */
  async lookup(
    query: string,
    model: string,
    provider: string,
    options?: CacheLookupOptions
  ): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const threshold = options?.similarityThreshold || this.DEFAULT_SIMILARITY_THRESHOLD;
      const maxAge = options?.maxAge || this.DEFAULT_TTL;

      // Generate query embedding
      const embedService = await createEmbeddingService();
      const queryEmbedding = await embedService.generate(query);

      // Search by similarity
      const client = await getQdrantClient();
      const results = await client.search(this.collectionName, {
        vector: queryEmbedding,
        limit: 1,
        with_payload: true,
        filter: {
          must: [
            { key: "model", match: { value: model } },
            { key: "provider", match: { value: provider } },
          ],
        },
      });

      if (results.length === 0) {
        this.metrics.misses++;
        logger.debug(`Cache MISS: no similar queries found`);
        return null;
      }

      const best = results[0];
      const payload = best.payload as unknown as CacheEntry;

      // Check similarity threshold
      if (best.score < threshold) {
        this.metrics.misses++;
        logger.debug(
          `Cache MISS: score ${best.score.toFixed(3)} < threshold ${threshold}`
        );
        return null;
      }

      // Check TTL
      const age = Date.now() - payload.timestamp;
      if (age > maxAge) {
        this.metrics.misses++;
        logger.debug(
          `Cache MISS: entry expired (${Math.round(age / 1000)}s old, max ${Math.round(maxAge / 1000)}s)`
        );

        // Delete expired entry
        await client.delete(this.collectionName, {
          points: [best.id as string],
        });

        return null;
      }

      // Cache HIT!
      this.metrics.hits++;
      logger.info(
        `✓ Cache HIT: score=${best.score.toFixed(3)}, age=${Math.round(age / 1000)}s, query="${query.substring(0, 50)}..."`
      );

      // Update hit counter and last hit timestamp
      await client.setPayload(this.collectionName, {
        points: [best.id as string],
        payload: {
          hits: payload.hits + 1,
          lastHit: Date.now(),
        },
      });

      return payload.response;
    } catch (error: any) {
      logger.warn(`Cache lookup error: ${error.message}`);
      this.metrics.misses++;
      return null; // Treat errors as cache miss
    }
  }

  /**
   * Store response in semantic cache
   *
   * @param query User query text
   * @param response Provider response
   * @param model Model name
   * @param provider Provider name
   * @param ttl Optional TTL in milliseconds (default: 1 hour)
   */
  async store(
    query: string,
    response: string,
    model: string,
    provider: string,
    ttl?: number
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Generate query embedding
      const embedService = await createEmbeddingService();
      const queryEmbedding = await embedService.generate(query);

      const client = await getQdrantClient();

      // Create cache entry
      const entry: CacheEntry = {
        query,
        response,
        model,
        provider,
        timestamp: Date.now(),
        hits: 0,
        lastHit: Date.now(),
        ttl: ttl || this.DEFAULT_TTL,
      };

      // Generate unique ID (Qdrant requires UUID or integer)
      const id = randomUUID();

      // Store in Qdrant
      await client.upsert(this.collectionName, {
        points: [
          {
            id,
            vector: queryEmbedding,
            payload: entry,
          },
        ],
      });

      this.metrics.stores++;
      logger.debug(
        `Cached response for "${query.substring(0, 50)}..." (${provider}/${model})`
      );

      // Check if we need to evict old entries
      await this.evictIfNeeded();
    } catch (error: any) {
      logger.warn(`Failed to store in cache: ${error.message}`);
    }
  }

  /**
   * Evict old entries if cache is full (LRU)
   */
  private async evictIfNeeded(): Promise<void> {
    try {
      const client = await getQdrantClient();

      // Count total entries
      const countResult = await client.count(this.collectionName);

      if (countResult.count <= this.MAX_CACHE_SIZE) {
        return; // Still have space
      }

      logger.info(
        `Cache full (${countResult.count}/${this.MAX_CACHE_SIZE}), performing LRU eviction...`
      );

      // Find oldest entries (least recently used)
      const scrollResult = await client.scroll(this.collectionName, {
        limit: 100,
        with_payload: true,
        order_by: {
          key: "lastHit",
          direction: "asc",
        },
      });

      // Delete oldest entries
      const idsToDelete = scrollResult.points.map((p) => p.id as string);

      if (idsToDelete.length > 0) {
        await client.delete(this.collectionName, {
          points: idsToDelete,
        });

        this.metrics.evictions += idsToDelete.length;
        logger.info(`✓ Evicted ${idsToDelete.length} old cache entries`);
      }
    } catch (error: any) {
      logger.warn(`LRU eviction error: ${error.message}`);
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      await this.cleanup();
    }, this.CLEANUP_INTERVAL);

    // Add process exit handlers to prevent memory leak
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());

    logger.debug(
      `Semantic cache cleanup timer started (every ${this.CLEANUP_INTERVAL / 60000} minutes)`
    );
  }

  /**
   * Stop cleanup timer and release resources
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      logger.debug('Semantic cache cleanup timer stopped');
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<void> {
    try {
      const client = await getQdrantClient();
      const now = Date.now();

      logger.debug("Running semantic cache cleanup...");

      // Find expired entries
      const scrollResult = await client.scroll(this.collectionName, {
        limit: 1000,
        with_payload: true,
      });

      const expiredIds: string[] = [];

      for (const point of scrollResult.points) {
        const payload = point.payload as unknown as CacheEntry;
        const age = now - payload.timestamp;

        if (age > payload.ttl) {
          expiredIds.push(point.id as string);
        }
      }

      if (expiredIds.length > 0) {
        await client.delete(this.collectionName, {
          points: expiredIds,
        });

        logger.info(`✓ Cleaned up ${expiredIds.length} expired cache entries`);
      }
    } catch (error: any) {
      logger.warn(`Cache cleanup error: ${error.message}`);
    }
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    try {
      const client = await getQdrantClient();

      // Delete and recreate collection
      await client.deleteCollection(this.collectionName);
      this.initialized = false;
      await this.initialize();

      // Reset metrics
      this.metrics = {
        hits: 0,
        misses: 0,
        stores: 0,
        evictions: 0,
      };

      logger.info("✓ Semantic cache cleared");
    } catch (error: any) {
      logger.error(`Failed to clear cache: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<CacheStats> {
    try {
      const client = await getQdrantClient();

      // Count total entries
      const countResult = await client.count(this.collectionName);

      // Get sample of entries for stats
      const scrollResult = await client.scroll(this.collectionName, {
        limit: 1000,
        with_payload: true,
      });

      const now = Date.now();
      let totalAge = 0;
      let oldestAge = 0;
      let newestAge = Infinity;
      let totalHits = 0;

      for (const point of scrollResult.points) {
        const payload = point.payload as unknown as CacheEntry;
        const age = now - payload.timestamp;

        totalAge += age;
        totalHits += payload.hits;

        if (age > oldestAge) oldestAge = age;
        if (age < newestAge) newestAge = age;
      }

      const avgAge = scrollResult.points.length > 0 ? totalAge / scrollResult.points.length : 0;
      const totalRequests = this.metrics.hits + this.metrics.misses;
      const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;

      return {
        totalEntries: countResult.count,
        avgAge: Math.round(avgAge / 1000), // Convert to seconds
        totalHits,
        totalMisses: this.metrics.misses,
        hitRate,
        oldestEntry: Math.round(oldestAge / 1000),
        newestEntry: newestAge !== Infinity ? Math.round(newestAge / 1000) : 0,
      };
    } catch (error: any) {
      logger.error(`Failed to get cache stats: ${error.message}`);
      return {
        totalEntries: 0,
        avgAge: 0,
        totalHits: 0,
        totalMisses: this.metrics.misses,
        hitRate: 0,
        oldestEntry: 0,
        newestEntry: 0,
      };
    }
  }

  /**
   * Get formatted stats string for CLI display
   */
  async getStatsString(): Promise<string> {
    const stats = await this.stats();

    return `
📊 Semantic Cache Statistics:
  Total Entries: ${stats.totalEntries.toLocaleString()}
  Cache Hit Rate: ${stats.hitRate.toFixed(1)}% (${this.metrics.hits} hits, ${this.metrics.misses} misses)
  Total Hits: ${stats.totalHits.toLocaleString()}
  Total Stores: ${this.metrics.stores.toLocaleString()}
  Total Evictions: ${this.metrics.evictions.toLocaleString()}
  Average Age: ${stats.avgAge}s
  Oldest Entry: ${stats.oldestEntry}s
  Newest Entry: ${stats.newestEntry}s
    `.trim();
  }

  /**
   * Stop cleanup timer (cleanup on shutdown)
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.debug("Semantic cache cleanup timer stopped");
    }
  }
}
