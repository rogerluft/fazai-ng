/**
 * Embedding Cache Module
 *
 * LRU (Least Recently Used) cache for embeddings to avoid recomputation.
 * Especially useful when:
 * - Re-importing same conversations
 * - Searching with same queries
 * - Processing similar texts
 *
 * Features:
 * - In-memory LRU cache with configurable size
 * - Optional persistence to JSON file
 * - Cache key = hash(text + model)
 * - Automatic eviction of least recently used
 * - Thread-safe operations
 */

import { createHash } from "crypto";
import { promises as fs } from "fs";
import { logger } from "../logger";
import { FAZAI_PATHS, ensureFazaiDirectories } from "../utils/paths";

export interface CacheEntry {
  /**
   * Embedding vector
   */
  vector: number[];

  /**
   * When this was cached
   */
  timestamp: number;

  /**
   * Number of times this was used
   */
  hitCount: number;
}

export interface CacheStats {
  /**
   * Total number of entries in cache
   */
  size: number;

  /**
   * Maximum cache size
   */
  maxSize: number;

  /**
   * Total cache hits
   */
  hits: number;

  /**
   * Total cache misses
   */
  misses: number;

  /**
   * Hit rate (percentage)
   */
  hitRate: number;

  /**
   * Total evictions (LRU removals)
   */
  evictions: number;
}

/**
 * LRU Cache for embeddings
 */
export class EmbeddingCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize: number;
  private readonly persistPath?: string;

  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  /**
   * Create embedding cache
   *
   * @param maxSize Maximum number of embeddings to cache (default: 10000)
   * @param persistPath Optional file path to persist cache (default: /opt/fazai/data/embedding-cache.json)
   * @param autoLoad Automatically load persisted cache on creation (default: true)
   */
  constructor(
    maxSize: number = 10000,
    persistPath?: string,
    autoLoad: boolean = true
  ) {
    this.maxSize = maxSize;

    // Default persist path: /opt/fazai/data/embedding-cache.json
    if (persistPath === undefined) {
      ensureFazaiDirectories();
      this.persistPath = FAZAI_PATHS.EMBEDDING_CACHE_FILE;
    } else {
      this.persistPath = persistPath;
    }

    // Auto-load on creation
    if (autoLoad && this.persistPath) {
      this.load().catch((error) => {
        logger.debug(`Could not load embedding cache: ${error.message}`);
      });
    }
  }

  /**
   * Generate cache key from text and model
   *
   * Uses SHA-256 hash to create consistent keys
   */
  private generateKey(text: string, model: string): string {
    const input = `${model}:${text}`;
    return createHash("sha256").update(input).digest("hex");
  }

  /**
   * Get embedding from cache
   *
   * @param text Text to lookup
   * @param model Model name
   * @returns Cached embedding vector or null if not found
   */
  get(text: string, model: string): number[] | null {
    const key = this.generateKey(text, model);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Update hit statistics
    entry.hitCount++;
    this.stats.hits++;

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);

    logger.debug(`Cache HIT for ${text.substring(0, 50)}... (${model})`);
    return entry.vector;
  }

  /**
   * Put embedding into cache
   *
   * @param text Text that was embedded
   * @param model Model used
   * @param vector Embedding vector
   */
  set(text: string, model: string, vector: number[]): void {
    const key = this.generateKey(text, model);

    // Check if we need to evict (LRU)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    // Add/update entry
    this.cache.set(key, {
      vector,
      timestamp: Date.now(),
      hitCount: 0,
    });

    logger.debug(`Cached embedding for ${text.substring(0, 50)}... (${model})`);
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    // In a Map, the first entry is the least recently used
    // (since we re-insert on every get)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
      logger.debug(`Evicted LRU entry (cache full at ${this.maxSize})`);
    }
  }

  /**
   * Check if text is cached
   */
  has(text: string, model: string): boolean {
    const key = this.generateKey(text, model);
    return this.cache.has(key);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate =
      totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      evictions: this.stats.evictions,
    };
  }

  /**
   * Format cache statistics as string
   */
  getStatsString(): string {
    const stats = this.getStats();
    return `
📊 Embedding Cache Stats:
  Size: ${stats.size}/${stats.maxSize} (${Math.round((stats.size / stats.maxSize) * 100)}%)
  Hits: ${stats.hits.toLocaleString()}
  Misses: ${stats.misses.toLocaleString()}
  Hit Rate: ${stats.hitRate.toFixed(1)}%
  Evictions: ${stats.evictions.toLocaleString()}
    `.trim();
  }

  /**
   * Clear all cached embeddings
   */
  clear(): void {
    this.cache.clear();
    logger.info("Embedding cache cleared");
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
    logger.debug("Cache statistics reset");
  }

  /**
   * Persist cache to file
   *
   * Saves as JSON with metadata
   */
  async save(): Promise<void> {
    if (!this.persistPath) {
      return;
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(this.persistPath);
      await fs.mkdir(dir, { recursive: true });

      // Convert Map to array for JSON serialization
      const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        ...entry,
      }));

      const data = {
        version: 1,
        savedAt: new Date().toISOString(),
        maxSize: this.maxSize,
        entries,
        stats: this.stats,
      };

      await fs.writeFile(this.persistPath, JSON.stringify(data, null, 2), "utf-8");

      logger.info(
        `Embedding cache saved to ${this.persistPath} (${entries.length} entries)`
      );
    } catch (error: any) {
      logger.error(`Failed to save embedding cache: ${error.message}`);
    }
  }

  /**
   * Load cache from file
   *
   * Merges with existing cache (doesn't replace)
   */
  async load(): Promise<void> {
    if (!this.persistPath) {
      return;
    }

    try {
      const content = await fs.readFile(this.persistPath, "utf-8");
      const data = JSON.parse(content);

      if (!data.entries || !Array.isArray(data.entries)) {
        throw new Error("Invalid cache file format");
      }

      // Load entries into cache
      let loaded = 0;
      for (const entry of data.entries) {
        if (entry.key && entry.vector && Array.isArray(entry.vector)) {
          this.cache.set(entry.key, {
            vector: entry.vector,
            timestamp: entry.timestamp || Date.now(),
            hitCount: entry.hitCount || 0,
          });
          loaded++;

          // Stop if we hit max size
          if (this.cache.size >= this.maxSize) {
            break;
          }
        }
      }

      logger.info(
        `Loaded ${loaded} cached embeddings from ${this.persistPath}`
      );

      // Restore stats if available
      if (data.stats) {
        this.stats.hits = data.stats.hits || 0;
        this.stats.misses = data.stats.misses || 0;
        this.stats.evictions = data.stats.evictions || 0;
      }
    } catch (error: any) {
      // File might not exist yet, that's okay
      if (error.code !== "ENOENT") {
        logger.warn(`Failed to load embedding cache: ${error.message}`);
      }
    }
  }

  /**
   * Auto-save cache periodically
   *
   * @param intervalMs Save interval in milliseconds (default: 5 minutes)
   * @returns Cleanup function to stop auto-save
   */
  startAutoSave(intervalMs: number = 5 * 60 * 1000): () => void {
    const intervalId = setInterval(() => {
      this.save();
    }, intervalMs);

    logger.info(
      `Embedding cache auto-save enabled (every ${intervalMs / 1000}s)`
    );

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      logger.debug("Embedding cache auto-save stopped");
    };
  }
}

/**
 * Global embedding cache instance
 */
export const embeddingCache = new EmbeddingCache();
