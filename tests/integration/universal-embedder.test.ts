/**
 * Integration Tests - Universal Local Embedder
 *
 * Tests real Ollama API integration with nomic-embed-text model.
 * Requires Ollama embedding server running with nomic-embed-text model.
 *
 * Run: npm test -- tests/integration/universal-embedder.test.ts
 *
 * Prerequisites:
 * 1. Ollama embedding server running (http://localhost:11434)
 *    - Configurado em /etc/fazai/fazai.conf como OLLAMA_EMBED_URL
 *    - Separado do servidor de chat (OLLAMA_BASE_URL)
 * 2. Model pulled: ollama pull nomic-embed-text
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  generateUniversalEmbedding,
  UniversalLocalEmbedder,
  padVector,
} from "../../src/services/universal-embedder";

// Embedding server URL (local para melhor performance)
const OLLAMA_EMBED_URL = "http://localhost:11434";

// Check if Ollama embedding server is available
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_EMBED_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

describe("Universal Local Embedder (Integration Tests)", () => {
  let ollamaAvailable: boolean;

  beforeAll(async () => {
    ollamaAvailable = await isOllamaAvailable();
    if (!ollamaAvailable) {
      console.warn(
        `⚠️  Ollama embedding server not available at ${OLLAMA_EMBED_URL} - skipping integration tests`
      );
    }
  });

  describe("generateUniversalEmbedding", () => {
    it("should generate 1536d embedding for simple text", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const embedding = await generateUniversalEmbedding("Hello world");

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
      expect(embedding.every((v) => typeof v === "number")).toBe(true);
    });

    it("should generate different embeddings for different texts", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const embedding1 = await generateUniversalEmbedding("Machine learning");
      const embedding2 = await generateUniversalEmbedding("Natural language");

      expect(embedding1).not.toEqual(embedding2);
      expect(embedding1.length).toBe(1536);
      expect(embedding2.length).toBe(1536);
    });

    it("should generate similar embeddings for similar texts", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const embedding1 = await generateUniversalEmbedding("cat");
      const embedding2 = await generateUniversalEmbedding("kitten");
      const embedding3 = await generateUniversalEmbedding("airplane");

      // Calculate cosine similarity
      const cosineSim = (a: number[], b: number[]): number => {
        const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dot / (magA * magB);
      };

      const sim12 = cosineSim(embedding1, embedding2);
      const sim13 = cosineSim(embedding1, embedding3);

      // "cat" should be more similar to "kitten" than "airplane"
      expect(sim12).toBeGreaterThan(sim13);
      expect(sim12).toBeGreaterThan(0.5); // Reasonable similarity threshold
    });

    it("should handle long text with truncation", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const longText = "Lorem ipsum dolor sit amet. ".repeat(200); // ~5600 chars
      const embedding = await generateUniversalEmbedding(longText);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
    });
  });

  describe("UniversalLocalEmbedder", () => {
    let embedder: UniversalLocalEmbedder;

    beforeAll(() => {
      embedder = new UniversalLocalEmbedder();
    });

    it("should embed single text", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const embedding = await embedder.embed("Test text");

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
    });

    it("should embed batch of texts", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const texts = [
        "First document about machine learning",
        "Second document about natural language processing",
        "Third document about computer vision",
      ];

      const embeddings = await embedder.embedBatch(texts);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(3);
      expect(embeddings.every((emb) => emb.length === 1536)).toBe(true);

      // Each embedding should be different
      expect(embeddings[0]).not.toEqual(embeddings[1]);
      expect(embeddings[1]).not.toEqual(embeddings[2]);
    });

    it("should handle empty batch", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const embeddings = await embedder.embedBatch([]);

      expect(embeddings).toEqual([]);
    });

    it("should return embedder info", () => {
      const info = embedder.getInfo();

      expect(info.model).toBe("nomic-embed-text");
      expect(info.nativeDimension).toBe(768);
      expect(info.targetDimension).toBe(1536);
      // Embeddings usam servidor local (OLLAMA_EMBED_URL)
      expect(info.ollamaUrl).toBe("http://localhost:11434");
    });

    it("should handle special characters", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const specialText = "Hello! @#$%^&*() 你好 привет 🚀";
      const embedding = await embedder.embed(specialText);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
    });

    it("should handle code snippets", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const codeText = `
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
      `;
      const embedding = await embedder.embed(codeText);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(1536);
    });
  });

  describe("Zero Padding Verification", () => {
    it("should verify zero padding preserves cosine similarity", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      // Generate two similar embeddings
      const emb1 = await generateUniversalEmbedding("artificial intelligence");
      const emb2 = await generateUniversalEmbedding("machine learning");

      // Verify they have zeros in the padded region
      const paddedRegion1 = emb1.slice(768);
      const paddedRegion2 = emb2.slice(768);

      // Should have many zeros (allowing for some rounding errors)
      const countZeros = (arr: number[]) =>
        arr.filter((v) => Math.abs(v) < 0.0001).length;

      expect(countZeros(paddedRegion1)).toBeGreaterThan(700); // Most should be zero
      expect(countZeros(paddedRegion2)).toBeGreaterThan(700);
    });
  });

  describe("Performance Tests", () => {
    it("should embed text in reasonable time", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const start = Date.now();
      await generateUniversalEmbedding("Performance test");
      const duration = Date.now() - start;

      // Should complete within 5 seconds (generous limit)
      expect(duration).toBeLessThan(5000);
    });

    it("should process batch efficiently", async () => {
      if (!ollamaAvailable) {
        console.log("Skipping test: Ollama not available");
        return;
      }

      const texts = Array.from({ length: 5 }, (_, i) => `Test text ${i}`);

      const start = Date.now();
      const embedder = new UniversalLocalEmbedder();
      await embedder.embedBatch(texts);
      const duration = Date.now() - start;

      // Should complete within 15 seconds for 5 texts
      expect(duration).toBeLessThan(15000);
    });
  });
});
