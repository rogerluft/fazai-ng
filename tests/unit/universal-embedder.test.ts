/**
 * Unit Tests - Universal Local Embedder
 *
 * Tests the Zero Padding implementation and UniversalLocalEmbedder class.
 *
 * Run: npm test -- tests/unit/universal-embedder.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  padVector,
  generateUniversalEmbedding,
  UniversalLocalEmbedder,
} from "../../src/services/universal-embedder";

describe("Universal Local Embedder (Unit Tests)", () => {
  describe("padVector", () => {
    it("should pad 768d vector to 1536d with zeros", () => {
      const vec768 = new Array(768).fill(0.5);
      const vec1536 = padVector(vec768, 1536);

      expect(vec1536).toHaveLength(1536);
      expect(vec1536.slice(0, 768)).toEqual(vec768);
      expect(vec1536.slice(768)).toEqual(new Array(768).fill(0));
    });

    it("should return same vector if already target dimension", () => {
      const vec1536 = new Array(1536).fill(0.5);
      const result = padVector(vec1536, 1536);

      expect(result).toHaveLength(1536);
      expect(result).toEqual(vec1536);
    });

    it("should truncate vector if larger than target", () => {
      const vec2048 = new Array(2048).fill(0.5);
      const vec1536 = padVector(vec2048, 1536);

      expect(vec1536).toHaveLength(1536);
      expect(vec1536).toEqual(vec2048.slice(0, 1536));
    });

    it("should handle empty vector", () => {
      const empty: number[] = [];
      const vec1536 = padVector(empty, 1536);

      expect(vec1536).toHaveLength(1536);
      expect(vec1536).toEqual(new Array(1536).fill(0));
    });

    it("should preserve semantic information in padding", () => {
      const original = [0.1, 0.2, 0.3, 0.4];
      const padded = padVector(original, 10);

      expect(padded).toHaveLength(10);
      expect(padded.slice(0, 4)).toEqual(original);
      expect(padded.slice(4)).toEqual([0, 0, 0, 0, 0, 0]);
    });

    it("should handle custom target dimensions", () => {
      const vec = new Array(512).fill(1.0);
      const padded = padVector(vec, 1024);

      expect(padded).toHaveLength(1024);
      expect(padded.slice(0, 512).every((v) => v === 1.0)).toBe(true);
      expect(padded.slice(512).every((v) => v === 0)).toBe(true);
    });
  });

  describe("UniversalLocalEmbedder", () => {
    let embedder: UniversalLocalEmbedder;

    beforeEach(() => {
      embedder = new UniversalLocalEmbedder(
        "http://192.168.0.101:11434",
        "nomic-embed-text",
        768,
        1536
      );
    });

    it("should initialize with correct configuration", () => {
      const info = embedder.getInfo();

      expect(info.model).toBe("nomic-embed-text");
      expect(info.nativeDimension).toBe(768);
      expect(info.targetDimension).toBe(1536);
      expect(info.ollamaUrl).toBe("http://192.168.0.101:11434");
    });

    it("should use default values when not provided", () => {
      const defaultEmbedder = new UniversalLocalEmbedder();
      const info = defaultEmbedder.getInfo();

      expect(info.model).toBe("nomic-embed-text");
      expect(info.nativeDimension).toBe(768);
      expect(info.targetDimension).toBe(1536);
      expect(info.ollamaUrl).toBe("http://192.168.0.101:11434");
    });

    it("should handle empty batch", async () => {
      const embeddings = await embedder.embedBatch([]);

      expect(embeddings).toHaveLength(0);
    });

    // Note: Actual embedding generation tests would require mocking fetch
    // or having a running Ollama instance. Those should go in integration tests.
  });

  describe("generateUniversalEmbedding", () => {
    it("should be a function", () => {
      expect(typeof generateUniversalEmbedding).toBe("function");
    });

    // Note: This function calls Ollama API, so actual tests should be in integration
  });

  describe("Zero Padding Properties", () => {
    it("should preserve cosine similarity ordering", () => {
      // Two similar vectors
      const vec1 = new Array(768).fill(0.8);
      const vec2 = new Array(768).fill(0.79);

      // One dissimilar vector
      const vec3 = new Array(768).fill(0.1);

      // Pad all to 1536
      const padded1 = padVector(vec1, 1536);
      const padded2 = padVector(vec2, 1536);
      const padded3 = padVector(vec3, 1536);

      // Cosine similarity function (simplified)
      const cosineSimilarity = (a: number[], b: number[]): number => {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
      };

      const sim12 = cosineSimilarity(padded1, padded2);
      const sim13 = cosineSimilarity(padded1, padded3);

      // Similar vectors should have higher similarity than dissimilar
      expect(sim12).toBeGreaterThan(sim13);
    });

    it("should not introduce bias in magnitude", () => {
      const vec = new Array(768).fill(0.5);
      const padded = padVector(vec, 1536);

      // Calculate magnitude (L2 norm)
      const magnitude = (v: number[]): number => {
        return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
      };

      const originalMagnitude = magnitude(vec);
      const paddedMagnitude = magnitude(padded);

      // Magnitude should not change (zeros don't contribute)
      expect(paddedMagnitude).toBeCloseTo(originalMagnitude, 10);
    });
  });
});
