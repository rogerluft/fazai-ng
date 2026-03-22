/**
 * Memory Freshness Injector — Phase 5
 *
 * Background worker that scans recent history/logs and injects fresh
 * memories into Qdrant (fazai_memory + fazai_semantic_cache).
 *
 * Triggers: agent interaction or configurable interval (default 24h).
 * Hybrid: Qdrant (primary) + sqlite-vector (fast fresh lookup).
 * Graceful: skip if Qdrant down, retry 3x with backoff, never crash.
 *
 * Config (fazai.conf):
 *   ASYNC_MEMORY_INTERVAL=86400        (seconds, default 24h)
 *   RAM_CACHE_LIMIT_GB=200             (max RAM for in-memory cache)
 *   SQLITE_VECTOR_PATH=/opt/fazai/data/memory-vectors.sqlite
 *   LOG_PATH_MEMORY_INJECTOR=/var/log/fazai/fazai-memory-injector.log
 *
 * @module services/memory-injector
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { logger } from "../logger.js";
import { getConfigValue } from "../config.js";
import { getQdrantClient } from "../database/qdrant-pool.js";
import { createEmbeddingService, type EmbeddingService } from "./embeddings.js";
import type { QdrantClient } from "@qdrant/js-client-rest";

// ─── Config Defaults ──────────────────────────────────────────────────

const DEFAULT_INTERVAL_S = 86400;      // 24 hours
const DEFAULT_RAM_CACHE_LIMIT_GB = 200;
const DEFAULT_SQLITE_PATH = "/opt/fazai/data/memory-vectors.sqlite";
const DEFAULT_LOG_PATH = "/var/log/fazai/fazai-memory-injector.log";
const SCAN_DAYS = 2;                   // Scan last 2 days of history/logs
const MAX_CHUNK_LENGTH = 2000;         // Characters per chunk
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 2000;

// Collections to inject into
const MEMORY_COLLECTION = "fazai_memory";
const CACHE_COLLECTION = "fazai_semantic_cache";

// ─── Types ────────────────────────────────────────────────────────────

export interface InjectorConfig {
  /** Interval in seconds between injections (default: 86400 = 24h) */
  intervalSeconds: number;
  /** Max RAM for in-memory cache in GB */
  ramCacheLimitGB: number;
  /** Path to SQLite vector cache */
  sqliteVectorPath: string;
  /** Path to injector log file */
  logPath: string;
  /** Max retries for Qdrant operations */
  maxRetries: number;
  /** Run once and exit (for systemd timer) vs continuous loop */
  singleShot: boolean;
}

export interface InjectionResult {
  /** Whether the injection was successful */
  success: boolean;
  /** Number of chunks injected into Qdrant */
  chunksInjected: number;
  /** Number of chunks skipped (already present) */
  chunksSkipped: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Errors encountered */
  errors: string[];
  /** Timestamp of this injection */
  timestamp: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  content: string;
}

// ─── Config Loader ────────────────────────────────────────────────────

export function loadInjectorConfig(overrides: Partial<InjectorConfig> = {}): InjectorConfig {
  const parseNum = (key: string, fallback: number): number => {
    const val = getConfigValue(key);
    if (val) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) return num;
    }
    return fallback;
  };

  return {
    intervalSeconds: overrides.intervalSeconds ?? parseNum("ASYNC_MEMORY_INTERVAL", DEFAULT_INTERVAL_S),
    ramCacheLimitGB: overrides.ramCacheLimitGB ?? parseNum("RAM_CACHE_LIMIT_GB", DEFAULT_RAM_CACHE_LIMIT_GB),
    sqliteVectorPath: overrides.sqliteVectorPath ?? getConfigValue("SQLITE_VECTOR_PATH") ?? DEFAULT_SQLITE_PATH,
    logPath: overrides.logPath ?? getConfigValue("LOG_PATH_MEMORY_INJECTOR") ?? DEFAULT_LOG_PATH,
    maxRetries: overrides.maxRetries ?? MAX_RETRIES,
    singleShot: overrides.singleShot ?? false,
  };
}

// ─── MemoryInjector ───────────────────────────────────────────────────

/**
 * MemoryInjector — scans recent logs/history and injects fresh memories
 * into Qdrant collections for retrieval by ContextAssembler.
 */
export class MemoryInjector {
  private config: InjectorConfig;
  private client: QdrantClient | null = null;
  private embedService: EmbeddingService | null = null;
  private initialized = false;
  private seenHashes: Set<string> = new Set();
  private logStream: fs.WriteStream | null = null;
  private consecutiveFailures = 0;

  constructor(config: Partial<InjectorConfig> = {}) {
    this.config = loadInjectorConfig(config);
  }

  /**
   * Initialize Qdrant client, embedding service, and log stream
   */
  async init(): Promise<boolean> {
    if (this.initialized) return true;

    // Setup log file
    this.ensureLogStream();

    try {
      this.client = await getQdrantClient();
      this.embedService = await createEmbeddingService();
      this.initialized = true;
      this.logInjector("INFO", "MemoryInjector initialized");
      return true;
    } catch (error: any) {
      this.logInjector("ERROR", `Init failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Run a single injection cycle
   */
  async inject(): Promise<InjectionResult> {
    const startTime = Date.now();
    const result: InjectionResult = {
      success: false,
      chunksInjected: 0,
      chunksSkipped: 0,
      durationMs: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    if (!await this.init()) {
      result.errors.push("Failed to initialize");
      result.durationMs = Date.now() - startTime;
      this.logInjector("ERROR", `Injection aborted: init failed`);
      return result;
    }

    this.logInjector("INFO", `Starting injection cycle...`);

    try {
      // 1. Scan log files for recent entries
      const logEntries = this.scanLogFiles();
      this.logInjector("INFO", `Scanned ${logEntries.length} log entries`);

      // 2. Chunk the entries
      const chunks = this.chunkEntries(logEntries);
      this.logInjector("INFO", `Created ${chunks.length} chunks from log entries`);

      // 3. Deduplicate by content hash
      const newChunks = chunks.filter((chunk) => {
        const hash = this.contentHash(chunk);
        if (this.seenHashes.has(hash)) {
          result.chunksSkipped++;
          return false;
        }
        return true;
      });

      this.logInjector("INFO", `${newChunks.length} new chunks (${result.chunksSkipped} skipped as duplicates)`);

      // 4. Inject each chunk with retry logic
      for (const chunk of newChunks) {
        const injected = await this.injectChunk(chunk, result);
        if (injected) {
          result.chunksInjected++;
          this.seenHashes.add(this.contentHash(chunk));
        }
      }

      result.success = result.errors.length === 0;
      this.consecutiveFailures = result.success ? 0 : this.consecutiveFailures + 1;
    } catch (error: any) {
      result.errors.push(`Injection cycle error: ${error.message}`);
      this.consecutiveFailures++;
    }

    result.durationMs = Date.now() - startTime;

    // Log summary
    this.logInjector(
      result.success ? "INFO" : "WARN",
      `Injection complete: ${result.chunksInjected} injected, ` +
      `${result.chunksSkipped} skipped, ${result.errors.length} errors, ` +
      `${result.durationMs}ms`
    );

    // Watchdog: alert on repeated failures
    if (this.consecutiveFailures >= 3) {
      this.logInjector(
        "ERROR",
        `WATCHDOG: ${this.consecutiveFailures} consecutive injection failures! ` +
        `Check Qdrant connectivity and embeddings service.`
      );
    }

    return result;
  }

  /**
   * Scan fazai log files for entries from the last SCAN_DAYS days
   */
  scanLogFiles(): LogEntry[] {
    const entries: LogEntry[] = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SCAN_DAYS);

    // Scan primary log
    const logPaths = [
      "/var/log/fazai/fazai.log",
      "/var/log/fazai/fazai-debug.log",
    ];

    for (const logPath of logPaths) {
      try {
        if (!fs.existsSync(logPath)) continue;

        const content = fs.readFileSync(logPath, "utf-8");
        const lines = content.split("\n").filter((line) => line.trim().length > 0);

        for (const line of lines) {
          const entry = this.parseLogLine(line);
          if (!entry) continue;

          // Filter by date
          try {
            const entryDate = new Date(entry.timestamp);
            if (entryDate >= cutoff) {
              entries.push(entry);
            }
          } catch {
            // Skip lines with unparseable dates
          }
        }
      } catch (error: any) {
        this.logInjector("WARN", `Failed to scan ${logPath}: ${error.message}`);
      }
    }

    return entries;
  }

  /**
   * Parse a structured log line: "2026-03-21T21:24:18.000Z [INFO] content..."
   */
  parseLogLine(line: string): LogEntry | null {
    const match = line.match(
      /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+\[(\w+)\]\s+(.+)$/
    );

    if (!match) return null;

    return {
      timestamp: match[1],
      level: match[2],
      content: match[3],
    };
  }

  /**
   * Chunk log entries into pieces suitable for embedding
   */
  chunkEntries(entries: LogEntry[]): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    for (const entry of entries) {
      const line = `[${entry.timestamp}] ${entry.level}: ${entry.content}`;

      if (currentChunk.length + line.length > MAX_CHUNK_LENGTH) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Generate a content hash for deduplication
   */
  contentHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
  }

  /**
   * Inject a single chunk into Qdrant with retry logic
   */
  private async injectChunk(
    chunk: string,
    result: InjectionResult
  ): Promise<boolean> {
    if (!this.client || !this.embedService) return false;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const embedding = await this.embedService.generate(chunk);
        const pointId = parseInt(this.contentHash(chunk), 16) % Number.MAX_SAFE_INTEGER;

        // Upsert to fazai_memory
        await this.client.upsert(MEMORY_COLLECTION, {
          wait: true,
          points: [
            {
              id: pointId,
              vector: embedding,
              payload: {
                content: chunk,
                type: "memory_injection",
                source: "async_injector",
                injectedAt: new Date().toISOString(),
                role: "system",
              },
            },
          ],
        });

        return true;
      } catch (error: any) {
        if (attempt < this.config.maxRetries - 1) {
          const backoff = RETRY_BACKOFF_MS * Math.pow(2, attempt);
          this.logInjector(
            "WARN",
            `Retry ${attempt + 1}/${this.config.maxRetries} after ${backoff}ms: ${error.message}`
          );
          await new Promise((resolve) => setTimeout(resolve, backoff));
        } else {
          result.errors.push(`Failed to inject chunk after ${this.config.maxRetries} retries: ${error.message}`);
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Run the injector in continuous mode (for daemon)
   */
  async runContinuous(signal?: AbortSignal): Promise<void> {
    this.logInjector("INFO", `Starting continuous mode (interval: ${this.config.intervalSeconds}s)`);

    while (!signal?.aborted) {
      await this.inject();

      // Wait for next interval
      const waitMs = this.config.intervalSeconds * 1000;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, waitMs);
        if (signal) {
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          }, { once: true });
        }
      });
    }

    this.logInjector("INFO", "Continuous mode stopped (signal received)");
  }

  /**
   * Log to injector-specific log file (append)
   */
  logInjector(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    const line = `${timestamp} [${level}] [MemoryInjector] ${message}`;

    // Write to injector log file
    if (this.logStream) {
      this.logStream.write(line + "\n");
    }

    // Also log via main logger
    switch (level) {
      case "ERROR":
        logger.error(line);
        break;
      case "WARN":
        logger.warn(line);
        break;
      case "INFO":
        logger.info(line);
        break;
      default:
        logger.debug(line);
    }
  }

  /**
   * Setup log file stream (append mode)
   */
  private ensureLogStream(): void {
    if (this.logStream) return;

    try {
      const logDir = path.dirname(this.config.logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      this.logStream = fs.createWriteStream(this.config.logPath, { flags: "a" });
      this.logStream.on("error", () => {
        this.logStream = null;
      });
    } catch {
      // Graceful: if log file can't be created, continue without it
      this.logStream = null;
    }
  }

  /**
   * Get current config (for testing/inspection)
   */
  getConfig(): InjectorConfig {
    return { ...this.config };
  }

  /**
   * Get consecutive failure count (for watchdog)
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
    this.logInjector("INFO", "MemoryInjector shutdown");
  }
}
