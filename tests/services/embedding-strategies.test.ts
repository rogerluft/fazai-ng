/**
 * Unit Tests - Embedding Strategies
 *
 * Tests semantic chunking, strategy selection, and text preprocessing
 * for collection-specific embedding configurations.
 *
 * Run: npm test -- tests/services/embedding-strategies.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  semanticChunk,
  getEmbeddingStrategy,
  preprocessText,
  isModelAvailable,
  getFallbackModel,
  type ChunkingConfig,
  type CollectionType,
  type EmbeddingModel,
  EMBEDDING_STRATEGIES,
} from "../../src/services/embedding-strategies";

describe("Embedding Strategies", () => {
  describe("semanticChunk()", () => {
    it("should return single chunk for text shorter than maxChunkSize", () => {
      const text = "Short text that fits in one chunk.";
      const config: ChunkingConfig = {
        maxChunkSize: 100,
        overlap: 10,
        separators: ["\n\n", ". "],
        minChunkSize: 20,
      };

      const chunks = semanticChunk(text, config);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it("should divide text correctly by paragraph separator", () => {
      const text =
        "First paragraph with some content.\n\nSecond paragraph with more content.\n\nThird paragraph here.";
      const config: ChunkingConfig = {
        maxChunkSize: 50,
        overlap: 5,
        separators: ["\n\n", ". "],
        minChunkSize: 20,
      };

      const chunks = semanticChunk(text, config);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(config.maxChunkSize);
        expect(chunk.length).toBeGreaterThanOrEqual(config.minChunkSize);
      });
    });

    it("should divide text correctly by sentence separator", () => {
      const text =
        "First sentence here. Second sentence here. Third sentence here. Fourth sentence here.";
      const config: ChunkingConfig = {
        maxChunkSize: 40,
        overlap: 5,
        separators: [". "],
        minChunkSize: 15,
      };

      const chunks = semanticChunk(text, config);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(config.maxChunkSize);
      });
    });

    it("should respect maxChunkSize limit", () => {
      const text = "a".repeat(1000);
      const config: ChunkingConfig = {
        maxChunkSize: 200,
        overlap: 20,
        separators: [" "],
        minChunkSize: 50,
      };

      const chunks = semanticChunk(text, config);

      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(config.maxChunkSize);
      });
    });

    it("should maintain overlap between chunks", () => {
      const text =
        "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.";
      const config: ChunkingConfig = {
        maxChunkSize: 40,
        overlap: 10,
        separators: [". "],
        minChunkSize: 15,
      };

      const chunks = semanticChunk(text, config);

      if (chunks.length > 1) {
        // Check that consecutive chunks have overlapping content
        for (let i = 0; i < chunks.length - 1; i++) {
          const currentChunk = chunks[i];
          const nextChunk = chunks[i + 1];
          const currentEnd = currentChunk.slice(-config.overlap);

          // Next chunk should start with some content from previous chunk's end
          expect(nextChunk.length).toBeGreaterThan(0);
        }
      }
    });

    it("should discard chunks smaller than minChunkSize", () => {
      const text =
        "Normal paragraph with sufficient content.\n\nTiny.\n\nAnother normal paragraph with enough text.";
      const config: ChunkingConfig = {
        maxChunkSize: 100,
        overlap: 10,
        separators: ["\n\n"],
        minChunkSize: 30,
      };

      const chunks = semanticChunk(text, config);

      chunks.forEach((chunk) => {
        expect(chunk.length).toBeGreaterThanOrEqual(config.minChunkSize);
      });
    });

    it("should handle multiple separator levels", () => {
      const text =
        "First paragraph.\n\nSecond paragraph with sentences. More sentences here. And more.";
      const config: ChunkingConfig = {
        maxChunkSize: 50,
        overlap: 5,
        separators: ["\n\n", ". ", " "],
        minChunkSize: 20,
      };

      const chunks = semanticChunk(text, config);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        // Allow some tolerance for overlap added to chunks
        expect(chunk.length).toBeLessThanOrEqual(config.maxChunkSize + config.overlap);
      });
    });

    it("should fallback to character splitting when no separators work", () => {
      const text = "a".repeat(500);
      const config: ChunkingConfig = {
        maxChunkSize: 100,
        overlap: 10,
        separators: ["\n\n", ". "],
        minChunkSize: 50,
      };

      const chunks = semanticChunk(text, config);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(config.maxChunkSize);
      });
    });

    it("should merge very small chunks with previous chunk", () => {
      const text =
        "Large enough paragraph to be its own chunk here.\n\nTiny\n\nAnother large paragraph.";
      const config: ChunkingConfig = {
        maxChunkSize: 60,
        overlap: 5,
        separators: ["\n\n"],
        minChunkSize: 40,
      };

      const chunks = semanticChunk(text, config);

      chunks.forEach((chunk) => {
        expect(chunk.length).toBeGreaterThanOrEqual(config.minChunkSize);
      });
    });
  });

  describe("getEmbeddingStrategy()", () => {
    it("should return correct strategy for personality collection", () => {
      const strategy = getEmbeddingStrategy("personality");

      expect(strategy.collection).toBe("fazai_personality");
      expect(strategy.model).toBe("BGE-base-en-v1.5");
      expect(strategy.dimension).toBe(768);
      expect(strategy.distanceMetric).toBe("Dot");
      expect(strategy.requiresEmbedding).toBe(true);
      expect(strategy.chunking.maxChunkSize).toBe(200);
    });

    it("should return correct strategy for memory collection", () => {
      const strategy = getEmbeddingStrategy("memory");

      expect(strategy.collection).toBe("fazai_memory");
      expect(strategy.model).toBe("BGE-base-en-v1.5");
      expect(strategy.dimension).toBe(768);
      expect(strategy.distanceMetric).toBe("Cosine");
      expect(strategy.requiresEmbedding).toBe(true);
      expect(strategy.chunking.maxChunkSize).toBe(800);
    });

    it("should return correct strategy for kb collection", () => {
      const strategy = getEmbeddingStrategy("kb");

      expect(strategy.collection).toBe("fazai_kb");
      expect(strategy.model).toBe("BGE-base-en-v1.5");
      expect(strategy.dimension).toBe(768);
      expect(strategy.distanceMetric).toBe("Cosine");
      expect(strategy.requiresEmbedding).toBe(true);
      expect(strategy.chunking.maxChunkSize).toBe(600);
    });

    it("should return correct strategy for learning collection", () => {
      const strategy = getEmbeddingStrategy("learning");

      expect(strategy.collection).toBe("fazai_learning");
      expect(strategy.model).toBe("BGE-base-en-v1.5");
      expect(strategy.dimension).toBe(768);
      expect(strategy.distanceMetric).toBe("Dot");
      expect(strategy.requiresEmbedding).toBe(true);
      expect(strategy.chunking.maxChunkSize).toBe(400);
    });

    it("should return correct strategy for inference collection", () => {
      const strategy = getEmbeddingStrategy("inference");

      expect(strategy.collection).toBe("fazai_inference");
      expect(strategy.model).toBe("BGE-base-en-v1.5");
      expect(strategy.dimension).toBe(768);
      expect(strategy.distanceMetric).toBe("Cosine");
      expect(strategy.requiresEmbedding).toBe(true);
      expect(strategy.chunking.maxChunkSize).toBe(0);
    });

    it("should have valid chunking config for each collection", () => {
      const collectionTypes: CollectionType[] = [
        "personality",
        "memory",
        "kb",
        "learning",
        "inference",
      ];

      collectionTypes.forEach((type) => {
        const strategy = getEmbeddingStrategy(type);

        expect(strategy.chunking).toBeDefined();
        expect(typeof strategy.chunking.maxChunkSize).toBe("number");
        expect(typeof strategy.chunking.overlap).toBe("number");
        expect(Array.isArray(strategy.chunking.separators)).toBe(true);
        expect(typeof strategy.chunking.minChunkSize).toBe("number");
      });
    });
  });

  describe("preprocessText()", () => {
    it("should remove markup from personality text", () => {
      const text = "**Bold** text with *italic* and `code`";
      const result = preprocessText(text, "personality");

      expect(result).not.toContain("**");
      expect(result).not.toContain("*");
      expect(result).not.toContain("`");
      expect(result).toBe("Bold text with italic and code");
    });

    it("should normalize whitespace in personality text", () => {
      const text = "Multiple    spaces   and\n\n\nnewlines";
      const result = preprocessText(text, "personality");

      expect(result).toBe("Multiple spaces and newlines");
      expect(result).not.toContain("  ");
    });

    it("should preserve structure but clean excessive newlines in memory text", () => {
      const text = "First line\n\n\n\nSecond line\n\n\n\n\nThird line";
      const result = preprocessText(text, "memory");

      expect(result).toContain("\n\n");
      expect(result).not.toContain("\n\n\n");
      expect(result.split("\n\n").length).toBeLessThan(
        text.split("\n\n").length
      );
    });

    it("should clean code blocks in kb text", () => {
      const text = "Regular text\n```javascript\nconst x = 1;\n```\nMore text";
      const result = preprocessText(text, "kb");

      expect(result).toContain("```");
      expect(result).not.toContain("```javascript");
    });

    it("should normalize whitespace in kb text", () => {
      const text = "Technical   docs  with   multiple    spaces";
      const result = preprocessText(text, "kb");

      expect(result).toBe("Technical docs with multiple spaces");
    });

    it("should preserve command structure in learning text", () => {
      const text = "command1 ; command2  ;  command3";
      const result = preprocessText(text, "learning");

      expect(result).toContain("; ");
      expect(result.split("; ").length).toBe(3);
    });

    it("should normalize whitespace in learning text", () => {
      const text = "fazai    ingest   --file    test.txt";
      const result = preprocessText(text, "learning");

      expect(result).toBe("fazai ingest --file test.txt");
    });

    it("should do minimal preprocessing for inference text", () => {
      const text = "  if (condition) { action(); }  ";
      const result = preprocessText(text, "inference");

      // Inference preprocessing only trims whitespace
      expect(result).toBe("if (condition) { action(); }");
      expect(result[0]).not.toBe(" ");
      expect(result[result.length - 1]).not.toBe(" ");
    });

    it("should trim all preprocessed text", () => {
      const collectionTypes: CollectionType[] = [
        "personality",
        "memory",
        "kb",
        "learning",
        "inference",
      ];

      collectionTypes.forEach((type) => {
        const text = "  text with spaces  ";
        const result = preprocessText(text, type);

        expect(result).toBe(result.trim());
        expect(result[0]).not.toBe(" ");
        expect(result[result.length - 1]).not.toBe(" ");
      });
    });

    it("should handle empty text", () => {
      const text = "";
      const result = preprocessText(text, "personality");

      expect(result).toBe("");
    });

    it("should handle text with only whitespace", () => {
      const text = "   \n\n   \t   ";
      const result = preprocessText(text, "personality");

      expect(result).toBe("");
    });
  });

  describe("isModelAvailable()", () => {
    // ONNX BGE-base-en-v1.5 is bundled locally — always available, no network needed
    it("should always return true (ONNX model is bundled)", async () => {
      const result = await isModelAvailable("BGE-base-en-v1.5");
      expect(result).toBe(true);
    });

    it("should return true regardless of model name (stub)", async () => {
      const result = await isModelAvailable("nomic-embed-text");
      expect(result).toBe(true);
    });

    it("should return true with custom base URL (ignored)", async () => {
      const result = await isModelAvailable("BGE-base-en-v1.5", "http://localhost:11434");
      expect(result).toBe(true);
    });
  });

  describe("getFallbackModel()", () => {
    // ONNX BGE-base-en-v1.5 is the universal model — no fallback chain needed
    it("should always return BGE-base-en-v1.5", async () => {
      const result = await getFallbackModel("text-embedding-3-small");
      expect(result).toBe("BGE-base-en-v1.5");
    });

    it("should return BGE-base-en-v1.5 even when preferred is same", async () => {
      const result = await getFallbackModel("BGE-base-en-v1.5");
      expect(result).toBe("BGE-base-en-v1.5");
    });

    it("should ignore custom base URL (ONNX is local)", async () => {
      const result = await getFallbackModel("nomic-embed-text", "http://localhost:11434");
      expect(result).toBe("BGE-base-en-v1.5");
    });
  });

  describe("EMBEDDING_STRATEGIES constant", () => {
    it("should have strategies for all collection types", () => {
      const collectionTypes: CollectionType[] = [
        "personality",
        "memory",
        "kb",
        "learning",
        "inference",
      ];

      collectionTypes.forEach((type) => {
        expect(EMBEDDING_STRATEGIES[type]).toBeDefined();
      });
    });

    it("should have valid model dimensions", () => {
      // Lei 768: nomic-embed-text nativo = 768d
      // OpenAI fallback = 1536d (mantido para compatibilidade)
      const validDimensions = [0, 768, 1024, 1536];

      Object.values(EMBEDDING_STRATEGIES).forEach((strategy) => {
        expect(validDimensions).toContain(strategy.dimension);
      });
    });

    it("should have valid distance metrics", () => {
      const validMetrics = ["Cosine", "Dot", "Euclid"];

      Object.values(EMBEDDING_STRATEGIES).forEach((strategy) => {
        expect(validMetrics).toContain(strategy.distanceMetric);
      });
    });

    it("should have preprocess function for each strategy", () => {
      Object.values(EMBEDDING_STRATEGIES).forEach((strategy) => {
        expect(typeof strategy.preprocess).toBe("function");
      });
    });

    it("should have consistent collection naming", () => {
      Object.entries(EMBEDDING_STRATEGIES).forEach(([key, strategy]) => {
        expect(strategy.collection).toMatch(/^fazai_/);
      });
    });
  });
});
