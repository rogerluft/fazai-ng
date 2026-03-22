/**
 * SkillSeeker Service Tests
 *
 * Full unit tests with mocked chokidar, fs, Qdrant, and embeddings.
 * No real filesystem or network dependency required.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Hoisted mocks (ALL mock objects used inside vi.mock factories) ────
const { mockWatcher, mockDiscover, mockQdrantClient, mockEmbedder } = vi.hoisted(() => {
  const mockWatcher = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
    removeAllListeners: vi.fn().mockReturnThis(),
  };
  const mockDiscover = vi.fn().mockResolvedValue(undefined);
  const mockQdrantClient = {
    getCollections: vi.fn().mockResolvedValue({
      collections: [{ name: "fazai_kb" }],
    }),
    createCollection: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const mockEmbedder = {
    generate: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
  };
  return { mockWatcher, mockDiscover, mockQdrantClient, mockEmbedder };
});

// ─── Mock chokidar ─────────────────────────────────────────────────────
vi.mock("chokidar", () => ({
  default: {
    watch: vi.fn().mockReturnValue(mockWatcher),
  },
}));

// ─── Mock fs (sync) ────────────────────────────────────────────────────
vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue("{}"),
}));

// ─── Mock fs/promises ──────────────────────────────────────────────────
vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue(Buffer.from("test content")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 100 }),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock Qdrant ───────────────────────────────────────────────────────
vi.mock("../../../src/database/qdrant-pool.js", () => ({
  getQdrantClient: vi.fn().mockResolvedValue(mockQdrantClient),
}));

// ─── Mock embeddings ───────────────────────────────────────────────────
vi.mock("../../../src/services/embeddings.js", () => ({
  createEmbeddingService: vi.fn().mockResolvedValue(mockEmbedder),
}));

// ─── Mock pdf-parse ────────────────────────────────────────────────────
vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({ text: "PDF text content" }),
}));

// ─── Mock logger ───────────────────────────────────────────────────────
vi.mock("../../../src/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Mock config ───────────────────────────────────────────────────────
vi.mock("../../../src/config", () => ({
  getConfigValue: vi.fn().mockReturnValue(""),
}));

// ─── Mock skill registry ──────────────────────────────────────────────
vi.mock("../../../src/skills/registry.js", () => ({
  getSkillRegistry: vi.fn(() => ({
    discover: mockDiscover,
  })),
}));

// ─── Import AFTER mocks ───────────────────────────────────────────────
import { SkillSeekerService, getSkillSeeker } from "../../../src/services/skill-seeker";

describe("SkillSeekerService", () => {
  let service: SkillSeekerService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset hoisted mock defaults
    mockWatcher.on.mockReturnThis();
    mockWatcher.close.mockResolvedValue(undefined);
    mockQdrantClient.getCollections.mockResolvedValue({
      collections: [{ name: "fazai_kb" }],
    });
    service = new SkillSeekerService();
  });

  afterEach(async () => {
    try {
      await service.stop();
    } catch {
      // ignore
    }
  });

  // ─── getStats ──────────────────────────────────────────────────────
  describe("getStats", () => {
    it("should return initial stats with isRunning=false", () => {
      const stats = service.getStats();

      expect(stats).toBeDefined();
      expect(stats.isRunning).toBe(false);
      expect(stats.filesProcessed).toBe(0);
      expect(stats.chunksIndexed).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.lastProcessedFile).toBeNull();
      expect(stats.lastProcessedAt).toBeNull();
      expect(stats.watchedDirectory).toBe("/etc/fazai/ingest");
    });
  });

  // ─── Singleton ─────────────────────────────────────────────────────
  describe("getSkillSeeker", () => {
    it("should return singleton instance", () => {
      const instance1 = getSkillSeeker();
      const instance2 = getSkillSeeker();
      expect(instance1).toBe(instance2);
    });
  });

  // ─── start / stop ─────────────────────────────────────────────────
  describe("start and stop", () => {
    it("should start successfully with mocked dependencies", async () => {
      expect(service.getStats().isRunning).toBe(false);

      await service.start();

      const stats = service.getStats();
      expect(stats.isRunning).toBe(true);

      // Verify chokidar was called
      const chokidar = await import("chokidar");
      expect(chokidar.default.watch).toHaveBeenCalledWith(
        "/etc/fazai/ingest",
        expect.objectContaining({ persistent: true, ignoreInitial: true })
      );

      // Verify watcher listeners were attached
      expect(mockWatcher.on).toHaveBeenCalledWith("add", expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith("change", expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith("unlink", expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should stop successfully after start", async () => {
      await service.start();
      expect(service.getStats().isRunning).toBe(true);

      await service.stop();
      expect(service.getStats().isRunning).toBe(false);
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it("should warn if start() is called when already running", async () => {
      const { logger } = await import("../../../src/logger");

      await service.start();
      await service.start(); // second call

      expect(logger.warn).toHaveBeenCalledWith("SkillSeeker is already running");
    });

    it("should warn if stop() is called when not running", async () => {
      const { logger } = await import("../../../src/logger");

      await service.stop();

      expect(logger.warn).toHaveBeenCalledWith("SkillSeeker is not running");
    });

    it("should not throw if start() fails (Qdrant down) — graceful degradation", async () => {
      mockQdrantClient.getCollections.mockRejectedValueOnce(new Error("Connection refused"));

      await service.start(); // should NOT throw

      // isRunning should remain false
      expect(service.getStats().isRunning).toBe(false);
    });
  });

  // ─── Watcher error handler ────────────────────────────────────────
  describe("watcher error handler", () => {
    it("should handle Error objects in watcher error callback", async () => {
      await service.start();

      const errorCall = mockWatcher.on.mock.calls.find(
        (call: any[]) => call[0] === "error"
      );
      expect(errorCall).toBeDefined();

      const errorHandler = errorCall![1] as (err: unknown) => void;
      const { logger } = await import("../../../src/logger");

      errorHandler(new Error("ENOSPC: no space"));

      expect(logger.error).toHaveBeenCalledWith(
        "SkillSeeker watcher error: ENOSPC: no space"
      );
      expect(service.getStats().errors).toBe(1);
    });

    it("should handle non-Error values in watcher error callback", async () => {
      await service.start();

      const errorCall = mockWatcher.on.mock.calls.find(
        (call: any[]) => call[0] === "error"
      );
      const errorHandler = errorCall![1] as (err: unknown) => void;
      const { logger } = await import("../../../src/logger");

      errorHandler("some string error");

      expect(logger.error).toHaveBeenCalledWith(
        "SkillSeeker watcher error: some string error"
      );
      expect(service.getStats().errors).toBe(1);
    });
  });

  // ─── notifySkillRegistry ──────────────────────────────────────────
  describe("notifySkillRegistry", () => {
    beforeEach(() => {
      mockDiscover.mockClear();
    });

    it("should call registry.discover() successfully", async () => {
      await service.start();
      mockDiscover.mockResolvedValueOnce(undefined);

      await service.notifySkillRegistry();

      expect(mockDiscover).toHaveBeenCalled();
    });

    it("should handle errors gracefully without throwing", async () => {
      await service.start();
      mockDiscover.mockRejectedValueOnce(new Error("Registry error"));

      await expect(service.notifySkillRegistry()).resolves.not.toThrow();
    });

    it("should auto-start if not running when notifySkillRegistry is called", async () => {
      const { logger } = await import("../../../src/logger");
      expect(service.getStats().isRunning).toBe(false);

      await service.notifySkillRegistry();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("auto-starting")
      );
      expect(service.getStats().isRunning).toBe(true);
      expect(mockDiscover).toHaveBeenCalled();
    });
  });
});
