import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SqliteBlockStorage } from "../../../../src/agentic/block-storage/sqlite-backend";
import { ExecutionBlock } from "../../../../src/agentic/block-storage/types";
import fs from "fs";
import path from "path";

// Mock do embedding service
vi.mock("../../../../src/services/embeddings", () => ({
  createEmbeddingService: vi.fn().mockResolvedValue({
    generate: vi.fn().mockImplementation(async (text: string) => {
      // Retorna vetor previsível baseado no texto para testar similaridade
      const vec = new Array(768).fill(0.01);
      if (text.includes("nginx")) vec[0] = 1.0;
      if (text.includes("apache")) vec[1] = 1.0;
      if (text.includes("something")) vec[2] = 1.0;
      return vec;
    }),
    getInfo: () => ({ dimension: 768 })
  })
}));

// Mock do logger para não sujar o output
vi.mock("../../../../src/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SqliteBlockStorage", () => {
  const testDbPath = path.join(process.cwd(), "data", "test-blocks.sqlite");

  beforeEach(() => {
    const dir = path.dirname(testDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        // Ignore
      }
    }
  });

  it("deve salvar e recuperar um bloco por ID", async () => {
    const storage = new SqliteBlockStorage(testDbPath);
    const block: Omit<ExecutionBlock, "block_id"> = {
      intent: "install nginx",
      steps: [{ command: "apt install nginx", description: "installing" }],
      stats: { times_used: 1, success_rate: 1.0, learned_from: [] }
    };

    const id = await storage.save(block);
    expect(id).toBeDefined();
    expect(typeof id).toBe("string");

    const retrieved = await storage.getById(id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.intent).toBe("install nginx");
    expect(retrieved?.steps[0].command).toBe("apt install nginx");
  });

  it("deve encontrar blocos similares semanticamente", async () => {
    const storage = new SqliteBlockStorage(testDbPath);

    await storage.save({
      intent: "setup nginx server",
      steps: [{ command: "nginx-setup", description: "setup" }],
      stats: { times_used: 1, success_rate: 1.0, learned_from: [] }
    });

    await storage.save({
      intent: "install apache",
      steps: [{ command: "apt install apache2", description: "apache" }],
      stats: { times_used: 1, success_rate: 1.0, learned_from: [] }
    });

    // Busca por algo relacionado a nginx
    const matches = await storage.findSimilar("nginx web server", undefined, 0.5);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].block.intent).toContain("nginx");
    expect(matches[0].similarity).toBeGreaterThan(0.9);
  });

  it("deve atualizar estatísticas de um bloco", async () => {
    const storage = new SqliteBlockStorage(testDbPath);
    const id = await storage.save({
      intent: "test stats",
      steps: [],
      stats: { times_used: 1, success_rate: 1.0, learned_from: [] }
    });

    await storage.updateStats(id, false); // Falhou

    const updated = await storage.getById(id);
    expect(updated?.stats.times_used).toBe(2);
    expect(updated?.stats.success_rate).toBeLessThan(1.0);
  });

  it("deve respeitar requisitos de contexto", async () => {
    const storage = new SqliteBlockStorage(testDbPath);

    await storage.save({
      intent: "apt install something",
      steps: [],
      context_requirements: {
        os: ["ubuntu", "debian"],
        pkg_manager: ["apt"]
      },
      stats: { times_used: 1, success_rate: 1.0, learned_from: [] }
    });

    // Busca em contexto compatível
    const matchesOk = await storage.findSimilar("apt install something", {
      os: "ubuntu",
      pkg_manager: "apt",
      is_root: true
    });
    expect(matchesOk.length).toBe(1);

    // Busca em contexto incompatível (fedora)
    const matchesFail = await storage.findSimilar("apt install something", {
      os: "fedora",
      pkg_manager: "dnf",
      is_root: true
    });
    expect(matchesFail.length).toBe(0);
  });

  it("deve limpar blocos antigos ou com baixa performance", async () => {
    const storage = new SqliteBlockStorage(testDbPath);

    // Bloco ruim
    const idBad = await storage.save({
      intent: "bad block",
      steps: [],
      stats: { times_used: 1, success_rate: 0.1, learned_from: [] }
    });

    // Bloco bom
    const idGood = await storage.save({
      intent: "good block",
      steps: [],
      stats: { times_used: 1, success_rate: 1.0, learned_from: [] }
    });

    const removed = await storage.cleanup({ minSuccessRate: 0.5 });
    expect(removed).toBe(1);

    expect(await storage.getById(idBad)).toBeNull();
    expect(await storage.getById(idGood)).toBeDefined();
  });
});
