/**
 * Unit Tests - EmbeddingCache
 *
 * Testa funcionalidade do cache LRU de embeddings.
 * Sem dependências externas (Qdrant, API, etc.)
 *
 * Para rodar: npm test -- tests/services/embedding-cache.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmbeddingCache } from "../../src/services/embedding-cache";
import type { CacheEntry, CacheStats } from "../../src/services/embedding-cache";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Mock do logger para evitar output nos testes
vi.mock("../../src/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock do paths para evitar criar diretórios reais
vi.mock("../../src/utils/paths", () => ({
  FAZAI_PATHS: {
    EMBEDDING_CACHE_FILE: "/tmp/test-embedding-cache.json",
    DATA: "/tmp/fazai-test",
  },
  ensureFazaiDirectories: vi.fn(),
}));

describe("EmbeddingCache", () => {
  let cache: EmbeddingCache;
  let tempDir: string;
  let tempCachePath: string;

  beforeEach(async () => {
    // Criar diretório temporário único para cada teste
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "embedding-cache-test-"));
    tempCachePath = path.join(tempDir, "test-cache.json");
  });

  afterEach(async () => {
    // Limpar diretório temporário
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignorar erros de limpeza
    }
  });

  describe("constructor", () => {
    it("deve inicializar com valores padrão", () => {
      cache = new EmbeddingCache(100, tempCachePath, false);

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(100);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it("deve aceitar configurações customizadas", () => {
      cache = new EmbeddingCache(500, tempCachePath, false, 60000);

      const stats = cache.getStats();
      expect(stats.maxSize).toBe(500);
    });

    it("não deve carregar cache automaticamente quando autoLoad=false", () => {
      cache = new EmbeddingCache(100, tempCachePath, false);

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe("get/set", () => {
    beforeEach(() => {
      cache = new EmbeddingCache(100, tempCachePath, false);
    });

    it("deve retornar null para cache miss", () => {
      const result = cache.get("texto inexistente", "text-embedding-3-small");

      expect(result).toBeNull();

      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it("deve retornar embedding para cache hit", () => {
      const text = "hello world";
      const model = "text-embedding-3-small";
      const vector = Array(768).fill(0.5);

      // Set
      cache.set(text, model, vector);

      // Get
      const result = cache.get(text, model);

      expect(result).toEqual(vector);

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(1);
    });

    it("deve distinguir entre modelos diferentes", () => {
      const text = "same text";
      const vector1 = Array(768).fill(0.1);
      const vector2 = Array(768).fill(0.9);

      cache.set(text, "model-a", vector1);
      cache.set(text, "model-b", vector2);

      const result1 = cache.get(text, "model-a");
      const result2 = cache.get(text, "model-b");

      expect(result1).toEqual(vector1);
      expect(result2).toEqual(vector2);
      expect(result1).not.toEqual(result2);
    });

    it("deve distinguir entre textos diferentes", () => {
      const model = "text-embedding-3-small";
      const vector1 = Array(768).fill(0.2);
      const vector2 = Array(768).fill(0.8);

      cache.set("text one", model, vector1);
      cache.set("text two", model, vector2);

      const result1 = cache.get("text one", model);
      const result2 = cache.get("text two", model);

      expect(result1).toEqual(vector1);
      expect(result2).toEqual(vector2);
    });

    it("deve incrementar hitCount em cache hit", () => {
      const text = "test";
      const model = "model";
      const vector = [0.1, 0.2, 0.3];

      cache.set(text, model, vector);

      // Primeiro hit
      cache.get(text, model);
      expect(cache.getStats().hits).toBe(1);

      // Segundo hit
      cache.get(text, model);
      expect(cache.getStats().hits).toBe(2);

      // Terceiro hit
      cache.get(text, model);
      expect(cache.getStats().hits).toBe(3);
    });
  });

  describe("generateKey", () => {
    beforeEach(() => {
      cache = new EmbeddingCache(100, tempCachePath, false);
    });

    it("deve gerar hash consistente para mesmo texto+modelo", () => {
      const text = "consistent text";
      const model = "model-x";
      const vector = [0.1, 0.2];

      cache.set(text, model, vector);
      const result1 = cache.get(text, model);

      cache.set(text, model, vector);
      const result2 = cache.get(text, model);

      expect(result1).toEqual(result2);
    });

    it("deve gerar hashes diferentes para inputs diferentes", () => {
      const vector1 = [0.1];
      const vector2 = [0.2];

      cache.set("text1", "model", vector1);
      cache.set("text2", "model", vector2);

      const result1 = cache.get("text1", "model");
      const result2 = cache.get("text2", "model");

      expect(result1).not.toEqual(result2);
    });
  });

  describe("LRU eviction", () => {
    beforeEach(() => {
      // Cache pequeno para forçar eviction
      cache = new EmbeddingCache(3, tempCachePath, false);
    });

    it("deve evitar entradas LRU quando cache está cheio", () => {
      const vector = [0.1, 0.2];

      // Preencher cache (3 entradas)
      cache.set("text1", "model", vector);
      cache.set("text2", "model", vector);
      cache.set("text3", "model", vector);

      expect(cache.getStats().size).toBe(3);
      expect(cache.getStats().evictions).toBe(0);

      // Adicionar 4ª entrada - deve evitar text1 (LRU)
      cache.set("text4", "model", vector);

      expect(cache.getStats().size).toBe(3); // Ainda 3 entradas
      expect(cache.getStats().evictions).toBe(1); // 1 eviction

      // text1 deve ter sido removido
      expect(cache.get("text1", "model")).toBeNull();

      // text2, text3, text4 devem existir
      expect(cache.get("text2", "model")).toEqual(vector);
      expect(cache.get("text3", "model")).toEqual(vector);
      expect(cache.get("text4", "model")).toEqual(vector);
    });

    it("deve mover entry para o final ao fazer get (LRU refresh)", () => {
      const vector = [0.5];

      // Adicionar 3 entradas
      cache.set("text1", "model", vector);
      cache.set("text2", "model", vector);
      cache.set("text3", "model", vector);

      // Acessar text1 (move para o final)
      cache.get("text1", "model");

      // Adicionar text4 - deve evitar text2 (agora é o LRU)
      cache.set("text4", "model", vector);

      // text1 ainda existe (foi movido para o final)
      expect(cache.get("text1", "model")).toEqual(vector);

      // text2 foi evitado
      expect(cache.get("text2", "model")).toBeNull();
    });

    it("não deve evitar ao atualizar entry existente", () => {
      const vector1 = [0.1];
      const vector2 = [0.9];

      // Preencher cache
      cache.set("text1", "model", vector1);
      cache.set("text2", "model", vector1);
      cache.set("text3", "model", vector1);

      expect(cache.getStats().evictions).toBe(0);

      // Atualizar text1 (não deve contar como eviction)
      cache.set("text1", "model", vector2);

      expect(cache.getStats().size).toBe(3);
      expect(cache.getStats().evictions).toBe(0);
      expect(cache.get("text1", "model")).toEqual(vector2);
    });
  });

  describe("TTL expiration", () => {
    it("deve retornar null para entradas expiradas", async () => {
      // TTL de 100ms
      cache = new EmbeddingCache(100, tempCachePath, false, 100);

      const text = "expiring text";
      const model = "model";
      const vector = [0.1, 0.2];

      cache.set(text, model, vector);

      // Deve estar disponível imediatamente
      expect(cache.get(text, model)).toEqual(vector);

      // Aguardar TTL expirar
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Deve retornar null após expiração
      const result = cache.get(text, model);
      expect(result).toBeNull();

      // Deve contar como miss
      const stats = cache.getStats();
      expect(stats.misses).toBe(1); // O get após expiração
    });

    it("deve remover entry expirado do cache", async () => {
      cache = new EmbeddingCache(100, tempCachePath, false, 100);

      const vector = [0.5];
      cache.set("expiring", "model", vector);

      expect(cache.getStats().size).toBe(1);

      // Aguardar expiração
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Get remove entry expirado
      cache.get("expiring", "model");

      expect(cache.getStats().size).toBe(0);
    });

    it("não deve expirar se TTL = 0 (infinito)", async () => {
      // TTL = 0 significa sem expiração
      cache = new EmbeddingCache(100, tempCachePath, false, 0);

      const vector = [0.1];
      cache.set("no-expire", "model", vector);

      // Aguardar um tempo
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Ainda deve estar disponível
      expect(cache.get("no-expire", "model")).toEqual(vector);
    });
  });

  describe("getStats", () => {
    beforeEach(() => {
      cache = new EmbeddingCache(100, tempCachePath, false);
    });

    it("deve retornar estatísticas corretas", () => {
      const vector = [0.1, 0.2];

      // Estado inicial
      let stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(100);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.evictions).toBe(0);

      // Adicionar entradas
      cache.set("text1", "model", vector);
      cache.set("text2", "model", vector);

      stats = cache.getStats();
      expect(stats.size).toBe(2);

      // Cache hit
      cache.get("text1", "model");
      stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(100);

      // Cache miss
      cache.get("nonexistent", "model");
      stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50); // 1 hit / 2 total = 50%
    });

    it("deve calcular hit rate corretamente", () => {
      const vector = [0.5];

      cache.set("text", "model", vector);

      // 3 hits, 1 miss
      cache.get("text", "model");
      cache.get("text", "model");
      cache.get("text", "model");
      cache.get("other", "model");

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(75); // 3/4 = 75%
    });

    it("deve contar evictions corretamente", () => {
      cache = new EmbeddingCache(2, tempCachePath, false);
      const vector = [0.1];

      cache.set("text1", "model", vector);
      cache.set("text2", "model", vector);
      cache.set("text3", "model", vector); // Evita text1

      let stats = cache.getStats();
      expect(stats.evictions).toBe(1);

      cache.set("text4", "model", vector); // Evita text2

      stats = cache.getStats();
      expect(stats.evictions).toBe(2);
    });
  });

  describe("clear", () => {
    beforeEach(() => {
      cache = new EmbeddingCache(100, tempCachePath, false);
    });

    it("deve limpar todas as entradas", () => {
      const vector = [0.1];

      cache.set("text1", "model", vector);
      cache.set("text2", "model", vector);

      expect(cache.getStats().size).toBe(2);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
      expect(cache.get("text1", "model")).toBeNull();
    });

    it("deve manter estatísticas após clear", () => {
      const vector = [0.1];

      cache.set("text", "model", vector);
      cache.get("text", "model"); // 1 hit

      cache.clear();

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(1); // Estatísticas não resetadas
    });
  });

  describe("resetStats", () => {
    beforeEach(() => {
      cache = new EmbeddingCache(100, tempCachePath, false);
    });

    it("deve resetar estatísticas", () => {
      const vector = [0.1];

      cache.set("text", "model", vector);
      cache.get("text", "model");
      cache.get("other", "model");

      let stats = cache.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);

      cache.resetStats();

      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });

    it("deve manter entradas após resetStats", () => {
      const vector = [0.1];

      cache.set("text", "model", vector);
      cache.resetStats();

      expect(cache.getStats().size).toBe(1);
      expect(cache.get("text", "model")).toEqual(vector);
    });
  });

  describe("has", () => {
    beforeEach(() => {
      cache = new EmbeddingCache(100, tempCachePath, false);
    });

    it("deve retornar true para entrada existente", () => {
      const vector = [0.1];

      cache.set("text", "model", vector);

      expect(cache.has("text", "model")).toBe(true);
    });

    it("deve retornar false para entrada inexistente", () => {
      expect(cache.has("nonexistent", "model")).toBe(false);
    });
  });

  describe("save/load", () => {
    it("deve persistir e carregar cache", async () => {
      cache = new EmbeddingCache(100, tempCachePath, false);

      const vector1 = [0.1, 0.2];
      const vector2 = [0.8, 0.9];

      cache.set("text1", "model", vector1);
      cache.set("text2", "model", vector2);

      // Salvar
      await cache.save();

      // Criar novo cache e carregar
      const cache2 = new EmbeddingCache(100, tempCachePath, false);
      await cache2.load();

      // Verificar dados carregados
      expect(cache2.get("text1", "model")).toEqual(vector1);
      expect(cache2.get("text2", "model")).toEqual(vector2);
      expect(cache2.getStats().size).toBe(2);
    });

    it("deve ignorar entradas expiradas ao carregar", async () => {
      // Cache com TTL curto
      cache = new EmbeddingCache(100, tempCachePath, false, 50);

      const vector = [0.5];
      cache.set("will-expire", "model", vector);

      await cache.save();

      // Aguardar expiração
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Carregar em novo cache
      const cache2 = new EmbeddingCache(100, tempCachePath, false, 50);
      await cache2.load();

      // Entry expirado não deve ser carregado
      expect(cache2.getStats().size).toBe(0);
    });

    it("deve preservar estatísticas ao salvar/carregar", async () => {
      cache = new EmbeddingCache(100, tempCachePath, false);

      const vector = [0.1];
      cache.set("text", "model", vector);
      cache.get("text", "model"); // 1 hit

      const originalStats = cache.getStats();

      await cache.save();

      const cache2 = new EmbeddingCache(100, tempCachePath, false);
      await cache2.load();

      const loadedStats = cache2.getStats();
      expect(loadedStats.hits).toBe(originalStats.hits);
      expect(loadedStats.misses).toBe(originalStats.misses);
      expect(loadedStats.evictions).toBe(originalStats.evictions);
    });

    it("não deve falhar ao carregar arquivo inexistente", async () => {
      const nonexistentPath = path.join(tempDir, "nonexistent.json");
      cache = new EmbeddingCache(100, nonexistentPath, false);

      // Não deve lançar erro
      await expect(cache.load()).resolves.toBeUndefined();

      expect(cache.getStats().size).toBe(0);
    });

    it("deve respeitar maxSize ao carregar", async () => {
      // Criar cache com 5 entradas
      cache = new EmbeddingCache(5, tempCachePath, false);

      for (let i = 0; i < 5; i++) {
        cache.set(`text${i}`, "model", [i]);
      }

      await cache.save();

      // Carregar em cache menor (maxSize=3)
      const cache2 = new EmbeddingCache(3, tempCachePath, false);
      await cache2.load();

      // Deve carregar apenas 3 primeiras entradas
      expect(cache2.getStats().size).toBeLessThanOrEqual(3);
    });
  });

  describe("startAutoSave", () => {
    it("deve retornar função de cleanup", () => {
      cache = new EmbeddingCache(100, tempCachePath, false);

      const cleanup = cache.startAutoSave(100000);

      expect(typeof cleanup).toBe("function");

      cleanup(); // Parar auto-save
    });

    it("deve salvar periodicamente", async () => {
      cache = new EmbeddingCache(100, tempCachePath, false);

      const vector = [0.1];
      cache.set("text", "model", vector);

      // Auto-save a cada 50ms
      const cleanup = cache.startAutoSave(50);

      // Aguardar pelo menos uma execução
      await new Promise((resolve) => setTimeout(resolve, 100));

      cleanup();

      // Verificar se arquivo foi criado
      const fileExists = await fs
        .access(tempCachePath)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });
  });

  describe("getStatsString", () => {
    beforeEach(() => {
      cache = new EmbeddingCache(100, tempCachePath, false);
    });

    it("deve retornar string formatada", () => {
      const vector = [0.1];

      cache.set("text", "model", vector);
      cache.get("text", "model");

      const statsString = cache.getStatsString();

      expect(typeof statsString).toBe("string");
      expect(statsString).toContain("Embedding Cache Stats");
      expect(statsString).toContain("Size:");
      expect(statsString).toContain("Hits:");
      expect(statsString).toContain("Misses:");
      expect(statsString).toContain("Hit Rate:");
    });
  });
});
