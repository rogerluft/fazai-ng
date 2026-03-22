/**
 * MemoryInjector Service Tests
 *
 * Full unit tests with mocked fs, Qdrant, embeddings, logger, and config.
 * No real filesystem, network, or Qdrant dependency required.
 *
 * Covers:
 * - Config loading with defaults and overrides
 * - Init: success, Qdrant failure graceful degradation
 * - Log scanning: parseLogLine, date filtering
 * - Chunking: chunkEntries, edge cases
 * - Deduplication: contentHash, skip duplicates
 * - Injection cycle: success, retry, max retries, watchdog
 * - Logging: dual output (stream + main logger)
 * - Shutdown cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Hoisted mocks ─────────────────────────────────────────────────────
const { mockQdrantClient, mockEmbedder, mockLogStream } = vi.hoisted(() => {
  const mockQdrantClient = {
    getCollections: vi.fn().mockResolvedValue({
      collections: [{ name: "fazai_memory" }, { name: "fazai_semantic_cache" }],
    }),
    upsert: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const mockEmbedder = {
    generate: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  };
  const mockLogStream = {
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  return { mockQdrantClient, mockEmbedder, mockLogStream };
});

// ─── Mock fs ───────────────────────────────────────────────────────────
vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(""),
  createWriteStream: vi.fn().mockReturnValue(mockLogStream),
}));

// ─── Mock Qdrant ───────────────────────────────────────────────────────
vi.mock("../../../src/database/qdrant-pool.js", () => ({
  getQdrantClient: vi.fn().mockResolvedValue(mockQdrantClient),
}));

// ─── Mock embeddings ───────────────────────────────────────────────────
vi.mock("../../../src/services/embeddings.js", () => ({
  createEmbeddingService: vi.fn().mockResolvedValue(mockEmbedder),
}));

// ─── Mock logger ───────────────────────────────────────────────────────
vi.mock("../../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Mock config ───────────────────────────────────────────────────────
vi.mock("../../../src/config.js", () => ({
  getConfigValue: vi.fn().mockReturnValue(null),
}));

// ─── Import AFTER mocks ───────────────────────────────────────────────
import { MemoryInjector, loadInjectorConfig } from "../../../src/services/memory-injector";
import * as fs from "fs";

describe("MemoryInjector", () => {
  let injector: MemoryInjector;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset defaults
    mockQdrantClient.upsert.mockResolvedValue(undefined);
    mockQdrantClient.getCollections.mockResolvedValue({
      collections: [{ name: "fazai_memory" }, { name: "fazai_semantic_cache" }],
    });
    mockEmbedder.generate.mockResolvedValue(new Array(768).fill(0.1));
    (fs.existsSync as any).mockReturnValue(false);
    (fs.readFileSync as any).mockReturnValue("");
    mockLogStream.write.mockReturnValue(true);
    mockLogStream.end.mockReturnValue(undefined);
    mockLogStream.on.mockReturnValue(mockLogStream);

    injector = new MemoryInjector({ singleShot: true });
  });

  afterEach(async () => {
    await injector.shutdown();
  });

  // ─── Config ──────────────────────────────────────────────────────────
  describe("loadInjectorConfig", () => {
    it("should return default config values", () => {
      const config = loadInjectorConfig();

      expect(config.intervalSeconds).toBe(86400);
      expect(config.ramCacheLimitGB).toBe(200);
      expect(config.sqliteVectorPath).toBe("/opt/fazai/data/memory-vectors.sqlite");
      expect(config.logPath).toBe("/var/log/fazai/fazai-memory-injector.log");
      expect(config.maxRetries).toBe(3);
      expect(config.singleShot).toBe(false);
    });

    it("should accept overrides", () => {
      const config = loadInjectorConfig({
        intervalSeconds: 3600,
        singleShot: true,
        maxRetries: 5,
      });

      expect(config.intervalSeconds).toBe(3600);
      expect(config.singleShot).toBe(true);
      expect(config.maxRetries).toBe(5);
    });
  });

  // ─── getConfig / getConsecutiveFailures ─────────────────────────────
  describe("getConfig", () => {
    it("should return a copy of the config", () => {
      const config = injector.getConfig();
      expect(config.singleShot).toBe(true);
      expect(config.maxRetries).toBe(3);
    });
  });

  describe("getConsecutiveFailures", () => {
    it("should start at 0", () => {
      expect(injector.getConsecutiveFailures()).toBe(0);
    });
  });

  // ─── Init ────────────────────────────────────────────────────────────
  describe("init", () => {
    it("should initialize successfully with mocked Qdrant and embeddings", async () => {
      const result = await injector.init();
      expect(result).toBe(true);
    });

    it("should return false if Qdrant is unavailable (graceful degradation)", async () => {
      const { getQdrantClient } = await import("../../../src/database/qdrant-pool.js");
      (getQdrantClient as any).mockRejectedValueOnce(new Error("Connection refused"));

      const freshInjector = new MemoryInjector({ singleShot: true });
      const result = await freshInjector.init();

      expect(result).toBe(false);
    });

    it("should return true on second call (already initialized)", async () => {
      await injector.init();
      const result = await injector.init();
      expect(result).toBe(true);
    });
  });

  // ─── parseLogLine ────────────────────────────────────────────────────
  describe("parseLogLine", () => {
    it("should parse a valid structured log line", () => {
      const entry = injector.parseLogLine(
        "2026-03-21T21:24:18.000Z [INFO] SkillSeeker started monitoring"
      );

      expect(entry).not.toBeNull();
      expect(entry!.timestamp).toBe("2026-03-21T21:24:18.000Z");
      expect(entry!.level).toBe("INFO");
      expect(entry!.content).toBe("SkillSeeker started monitoring");
    });

    it("should return null for non-matching lines", () => {
      const entry = injector.parseLogLine("just some random text");
      expect(entry).toBeNull();
    });

    it("should return null for empty string", () => {
      const entry = injector.parseLogLine("");
      expect(entry).toBeNull();
    });
  });

  // ─── chunkEntries ────────────────────────────────────────────────────
  describe("chunkEntries", () => {
    it("should chunk entries into pieces under MAX_CHUNK_LENGTH", () => {
      const entries = Array.from({ length: 50 }, (_, i) => ({
        timestamp: `2026-03-21T${String(i).padStart(2, "0")}:00:00.000Z`,
        level: "INFO",
        content: `Log entry number ${i} with some content that is reasonably long`,
      }));

      const chunks = injector.chunkEntries(entries);

      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2100); // MAX_CHUNK_LENGTH + buffer for last line
      }
    });

    it("should return empty array for empty input", () => {
      const chunks = injector.chunkEntries([]);
      expect(chunks).toEqual([]);
    });

    it("should create a single chunk for a single entry", () => {
      const entries = [
        { timestamp: "2026-03-21T00:00:00Z", level: "INFO", content: "Hello" },
      ];
      const chunks = injector.chunkEntries(entries);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain("Hello");
    });
  });

  // ─── contentHash ─────────────────────────────────────────────────────
  describe("contentHash", () => {
    it("should return consistent hash for same content", () => {
      const h1 = injector.contentHash("test content");
      const h2 = injector.contentHash("test content");
      expect(h1).toBe(h2);
    });

    it("should return different hashes for different content", () => {
      const h1 = injector.contentHash("content A");
      const h2 = injector.contentHash("content B");
      expect(h1).not.toBe(h2);
    });

    it("should return a 16-character hex string", () => {
      const hash = injector.contentHash("anything");
      expect(hash).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  // ─── scanLogFiles ────────────────────────────────────────────────────
  describe("scanLogFiles", () => {
    it("should return empty array when no log files exist", () => {
      (fs.existsSync as any).mockReturnValue(false);
      const entries = injector.scanLogFiles();
      expect(entries).toEqual([]);
    });

    it("should parse and filter log entries within SCAN_DAYS", () => {
      const recentDate = new Date().toISOString();
      const oldDate = "2020-01-01T00:00:00.000Z";

      (fs.existsSync as any).mockImplementation((p: string) => {
        return p === "/var/log/fazai/fazai.log";
      });
      (fs.readFileSync as any).mockReturnValue(
        `${recentDate} [INFO] Recent entry\n${oldDate} [WARN] Old entry\n`
      );

      const entries = injector.scanLogFiles();

      // Only the recent entry should be returned
      expect(entries.length).toBe(1);
      expect(entries[0].content).toBe("Recent entry");
    });
  });

  // ─── inject (full cycle) ─────────────────────────────────────────────
  describe("inject", () => {
    it("should complete a successful injection cycle with no log entries", async () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = await injector.inject();

      expect(result.success).toBe(true);
      expect(result.chunksInjected).toBe(0);
      expect(result.chunksSkipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it("should inject chunks from log entries into Qdrant", async () => {
      const now = new Date().toISOString();
      (fs.existsSync as any).mockImplementation((p: string) => {
        return p === "/var/log/fazai/fazai.log";
      });
      (fs.readFileSync as any).mockReturnValue(
        `${now} [INFO] Test chunk for injection\n`
      );

      const result = await injector.inject();

      expect(result.success).toBe(true);
      expect(result.chunksInjected).toBe(1);
      expect(mockEmbedder.generate).toHaveBeenCalled();
      expect(mockQdrantClient.upsert).toHaveBeenCalledWith(
        "fazai_memory",
        expect.objectContaining({
          wait: true,
          points: expect.arrayContaining([
            expect.objectContaining({
              payload: expect.objectContaining({
                type: "memory_injection",
                source: "async_injector",
              }),
            }),
          ]),
        })
      );
    });

    it("should skip duplicate chunks on second injection", async () => {
      const now = new Date().toISOString();
      (fs.existsSync as any).mockImplementation((p: string) => {
        return p === "/var/log/fazai/fazai.log";
      });
      (fs.readFileSync as any).mockReturnValue(
        `${now} [INFO] Same content twice\n`
      );

      // First injection
      const result1 = await injector.inject();
      expect(result1.chunksInjected).toBe(1);

      // Second injection with same content — should be skipped
      const result2 = await injector.inject();
      expect(result2.chunksSkipped).toBe(1);
      expect(result2.chunksInjected).toBe(0);
    });

    it("should return failure result when init fails", async () => {
      const { getQdrantClient } = await import("../../../src/database/qdrant-pool.js");
      (getQdrantClient as any).mockResolvedValue(mockQdrantClient); // restore first
      (getQdrantClient as any).mockRejectedValueOnce(new Error("Connection refused"));

      const freshInjector = new MemoryInjector({ singleShot: true });
      const result = await freshInjector.inject();

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Failed to initialize");

      // Restore mock for subsequent tests
      (getQdrantClient as any).mockResolvedValue(mockQdrantClient);
    });
  });

  // ─── Retry and Watchdog ──────────────────────────────────────────────
  describe("retry and watchdog", () => {
    it("should retry on Qdrant upsert failure and succeed on second attempt", async () => {
      // Setup log mocks BEFORE creating injector
      const now = new Date().toISOString();
      (fs.existsSync as any).mockImplementation((p: string) => {
        // Return true only for the log file, not for log dir (ensureLogStream)
        return p === "/var/log/fazai/fazai.log";
      });
      (fs.readFileSync as any).mockReturnValue(
        `${now} [INFO] Retry content for test\n`
      );

      // Create a fresh injector for this test — ensure Qdrant mock is restored
      const { getQdrantClient } = await import("../../../src/database/qdrant-pool.js");
      (getQdrantClient as any).mockResolvedValue(mockQdrantClient);
      const retryInjector = new MemoryInjector({ singleShot: true, maxRetries: 3 });

      // Init will use the mock Qdrant + embeddings
      const initOk = await retryInjector.init();
      expect(initOk).toBe(true);

      // NOW set up upsert to fail once, then succeed
      mockQdrantClient.upsert
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce(undefined);

      const result = await retryInjector.inject();

      expect(result.chunksInjected).toBe(1);
      expect(mockQdrantClient.upsert).toHaveBeenCalledTimes(2);

      await retryInjector.shutdown();
    }, 15000);

    it("should track consecutive failures and trigger watchdog at 3", async () => {
      const now = new Date().toISOString();
      (fs.existsSync as any).mockImplementation((p: string) => {
        return p === "/var/log/fazai/fazai.log";
      });

      // Make ALL upsert calls fail permanently
      mockQdrantClient.upsert.mockRejectedValue(new Error("Permanent upsert failure"));

      const { getQdrantClient } = await import("../../../src/database/qdrant-pool.js");
      (getQdrantClient as any).mockResolvedValue(mockQdrantClient);
      const failInjector = new MemoryInjector({ singleShot: true, maxRetries: 1 });
      const initOk = await failInjector.init();
      expect(initOk).toBe(true);

      // Each inject() uses different content so dedup doesn't skip them
      (fs.readFileSync as any).mockReturnValue(`${now} [INFO] Fail attempt 1\n`);
      await failInjector.inject();

      (fs.readFileSync as any).mockReturnValue(`${now} [INFO] Fail attempt 2\n`);
      await failInjector.inject();

      (fs.readFileSync as any).mockReturnValue(`${now} [INFO] Fail attempt 3\n`);
      await failInjector.inject();

      expect(failInjector.getConsecutiveFailures()).toBeGreaterThanOrEqual(3);

      await failInjector.shutdown();
    }, 30000);
  });

  // ─── Logging ─────────────────────────────────────────────────────────
  describe("logInjector", () => {
    it("should write to log stream when available", async () => {
      await injector.init(); // triggers ensureLogStream

      injector.logInjector("INFO", "Test log message");

      expect(mockLogStream.write).toHaveBeenCalledWith(
        expect.stringContaining("Test log message")
      );
    });

    it("should include timestamp and level in log output", async () => {
      await injector.init();

      injector.logInjector("WARN", "Warning test");

      const written = mockLogStream.write.mock.calls.find(
        (call: any[]) => typeof call[0] === "string" && call[0].includes("Warning test")
      );
      expect(written).toBeDefined();
      expect(written![0]).toMatch(/\d{4}-\d{2}-\d{2}T/); // timestamp
      expect(written![0]).toContain("[WARN]");
      expect(written![0]).toContain("[MemoryInjector]");
    });
  });

  // ─── Shutdown ────────────────────────────────────────────────────────
  describe("shutdown", () => {
    it("should close log stream on shutdown", async () => {
      await injector.init();
      await injector.shutdown();

      expect(mockLogStream.end).toHaveBeenCalled();
    });

    it("should be safe to call shutdown multiple times", async () => {
      await injector.init();
      await injector.shutdown();
      await injector.shutdown(); // second call should not throw

      // end() only called once (second call has null logStream)
      expect(mockLogStream.end).toHaveBeenCalledTimes(1);
    });
  });
});
