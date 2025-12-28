/**
 * Semantic Cache Module (Simplified Hybrid Version)
 *
 * In-memory cache for LLM responses with query normalization.
 * Works in conjunction with GenAIScript which handles heavy query processing.
 *
 * Architecture (Hybrid - Option C):
 * - GenAIScript (fazai-core.genai.mjs) does heavy normalization (reformulation, pt→en)
 * - This cache receives already-processed queries from agentic loop
 * - For direct queries (fazai ask), applies MEDIUM normalization
 * - Uses cosine similarity on embeddings for semantic matching (threshold: 0.90)
 *
 * Features:
 * - In-memory Map storage (no Qdrant dependency)
 * - Query normalization via utils/normalize.ts
 * - Cosine similarity matching with configurable threshold
 * - TTL expiration (default: 1 hour)
 * - LRU eviction when cache is full
 * - Hit/miss metrics tracking
 *
 * @module services/semantic-cache
 */

import { logger } from "../logger";
import { normalizeQuery, generateCacheKey } from "../utils/normalize";
import { createEmbeddingService } from "./embeddings";

/**
 * Cached response entry
 */
interface CachedResponse {
  /** Original query (before normalization) */
  originalQuery: string;
  /** Normalized query */
  normalizedQuery: string;
  /** Query embedding vector */
  embedding: number[];
  /** LLM response */
  response: string;
  /** Model used */
  model: string;
  /** Provider used */
  provider: string;
  /** Timestamp of cache entry */
  timestamp: number;
  /** Number of cache hits */
  hits: number;
  /** Last hit timestamp */
  lastHit: number;
  /** TTL in milliseconds */
  ttl: number;
}

/**
 * Cache lookup options
 */
export interface CacheLookupOptions {
  /**
   * Minimum cosine similarity score (0-1)
   * Default: 0.90 (high similarity required)
   */
  similarityThreshold?: number;

  /**
   * Maximum age in milliseconds
   * Default: 1 hour (3600000ms)
   */
  maxAge?: number;

  /**
   * Skip normalization (query already normalized by GenAIScript)
   * Default: false
   */
  skipNormalization?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgAge: number;
  memoryUsage: number;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    logger.warn(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Semantic Cache - Simplified In-Memory Implementation
 *
 * Singleton pattern for global cache access.
 */
export class SemanticCache {
  private static instance: SemanticCache | null = null;

  // Cache storage
  private cache: Map<string, CachedResponse> = new Map();

  // Configuration
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.90;
  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_CACHE_SIZE = 500; // Max entries
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

  // Metrics
  private metrics = {
    hits: 0,
    misses: 0,
    stores: 0,
    evictions: 0,
  };

  private cleanupTimer: NodeJS.Timeout | null = null;
  private initialized = false;

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
   * Initialize cache and start cleanup timer
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    this.startCleanupTimer();
    this.initialized = true;

    logger.info("✓ Semantic cache initialized (in-memory mode, threshold: 0.90)");
  }

  /**
   * Lookup query in cache
   *
   * @param query - User query
   * @param model - Model name
   * @param provider - Provider name
   * @param options - Lookup options
   * @returns Cached response or null
   */
  async lookup(
    query: string,
    model: string,
    provider: string,
    options?: CacheLookupOptions
  ): Promise<string | null> {
    if (!this.initialized) await this.initialize();

    const threshold = options?.similarityThreshold ?? this.DEFAULT_SIMILARITY_THRESHOLD;
    const maxAge = options?.maxAge ?? this.DEFAULT_TTL;
    const skipNorm = options?.skipNormalization ?? false;

    // Normalize query (skip if already normalized by GenAIScript)
    const normalizedQuery = skipNorm ? query : normalizeQuery(query);

    if (!normalizedQuery) {
      this.metrics.misses++;
      logger.debug("Cache MISS: empty query after normalization");
      return null;
    }

    // Try exact match first (fast path)
    const exactKey = generateCacheKey(normalizedQuery, model, provider);
    const exactMatch = this.cache.get(exactKey);

    if (exactMatch) {
      const age = Date.now() - exactMatch.timestamp;
      if (age <= maxAge) {
        this.metrics.hits++;
        exactMatch.hits++;
        exactMatch.lastHit = Date.now();

        logger.info(
          `✓ Cache HIT (exact): "${normalizedQuery.substring(0, 40)}..." ` +
          `[${model}] age=${Math.round(age / 1000)}s hits=${exactMatch.hits}`
        );
        return exactMatch.response;
      } else {
        // Expired, remove it
        this.cache.delete(exactKey);
      }
    }

    // Semantic search (slower path) - compare embeddings
    try {
      const embedService = await createEmbeddingService();
      const queryEmbedding = await embedService.generate(normalizedQuery);

      let bestMatch: CachedResponse | null = null;
      let bestScore = 0;

      for (const [key, entry] of this.cache.entries()) {
        // Skip different model/provider
        if (entry.model !== model || entry.provider !== provider) continue;

        // Check TTL
        const age = Date.now() - entry.timestamp;
        if (age > maxAge) {
          this.cache.delete(key);
          continue;
        }

        // Calculate similarity
        const score = cosineSimilarity(queryEmbedding, entry.embedding);

        if (score >= threshold && score > bestScore) {
          bestScore = score;
          bestMatch = entry;
        }
      }

      if (bestMatch) {
        this.metrics.hits++;
        bestMatch.hits++;
        bestMatch.lastHit = Date.now();

        logger.info(
          `✓ Cache HIT (semantic): score=${bestScore.toFixed(3)} ` +
          `"${normalizedQuery.substring(0, 30)}..." → "${bestMatch.normalizedQuery.substring(0, 30)}..." ` +
          `[${model}]`
        );
        return bestMatch.response;
      }
    } catch (error: any) {
      logger.debug(`Semantic search error: ${error.message}`);
    }

    this.metrics.misses++;
    logger.debug(
      `Cache MISS: "${normalizedQuery.substring(0, 40)}..." [${model}]`
    );
    return null;
  }

  /**
   * Store response in cache
   *
   * @param query - User query
   * @param response - LLM response
   * @param model - Model name
   * @param provider - Provider name
   * @param options - Store options
   */
  async store(
    query: string,
    response: string,
    model: string,
    provider: string,
    options?: { ttl?: number; skipNormalization?: boolean }
  ): Promise<void> {
    if (!this.initialized) await this.initialize();

    const skipNorm = options?.skipNormalization ?? false;
    const normalizedQuery = skipNorm ? query : normalizeQuery(query);

    if (!normalizedQuery || !response) {
      logger.debug("Cache STORE skipped: empty query or response");
      return;
    }

    try {
      // Generate embedding for semantic matching
      const embedService = await createEmbeddingService();
      const embedding = await embedService.generate(normalizedQuery);

      const entry: CachedResponse = {
        originalQuery: query,
        normalizedQuery,
        embedding,
        response,
        model,
        provider,
        timestamp: Date.now(),
        hits: 0,
        lastHit: Date.now(),
        ttl: options?.ttl ?? this.DEFAULT_TTL,
      };

      const key = generateCacheKey(normalizedQuery, model, provider);

      // Evict if necessary
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        this.evictLRU();
      }

      this.cache.set(key, entry);
      this.metrics.stores++;

      logger.debug(
        `Cache STORE: "${normalizedQuery.substring(0, 40)}..." [${model}] ` +
        `(${this.cache.size}/${this.MAX_CACHE_SIZE} entries)`
      );
    } catch (error: any) {
      logger.warn(`Cache store error: ${error.message}`);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastHit < oldestTime) {
        oldestTime = entry.lastHit;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
      logger.debug(`Cache LRU eviction: removed oldest entry`);
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);

    // Prevent timer from keeping process alive
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`Cache cleanup: removed ${removed} expired entries`);
    }
  }

  /**
   * Stop cache (cleanup timer)
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    logger.debug("Semantic cache stopped");
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.metrics = { hits: 0, misses: 0, stores: 0, evictions: 0 };
    logger.info("Semantic cache cleared");
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;

    let totalAge = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      totalAge += now - entry.timestamp;
    }

    const avgAge = this.cache.size > 0 ? totalAge / this.cache.size / 1000 : 0;

    // Rough memory estimate (bytes)
    let memoryUsage = 0;
    for (const entry of this.cache.values()) {
      memoryUsage += entry.response.length * 2; // UTF-16
      memoryUsage += entry.embedding.length * 8; // Float64
      memoryUsage += 200; // Overhead
    }

    return {
      totalEntries: this.cache.size,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate,
      avgAge,
      memoryUsage,
    };
  }

  /**
   * Get formatted stats string for CLI display
   */
  getStatsString(): string {
    const s = this.stats();
    const memMB = (s.memoryUsage / 1024 / 1024).toFixed(2);

    return `
📊 Semantic Cache Statistics:
  Entries: ${s.totalEntries}/${this.MAX_CACHE_SIZE}
  Hit Rate: ${s.hitRate.toFixed(1)}% (${s.hits} hits, ${s.misses} misses)
  Stores: ${this.metrics.stores}
  Evictions: ${this.metrics.evictions}
  Avg Age: ${s.avgAge.toFixed(0)}s
  Memory: ~${memMB} MB
  Mode: in-memory (threshold: ${this.DEFAULT_SIMILARITY_THRESHOLD})
    `.trim();
  }
}
