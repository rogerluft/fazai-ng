/**
 * Unit Tests - Embedding Padding and Truncation
 *
 * Tests the padding and truncation logic for embeddings in the OllamaEmbeddingService.
 * Validates that embeddings are correctly normalized to 1536 dimensions.
 *
 * Run: npm test -- tests/services/embedding-padding.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Mock implementation of the padding/truncation logic from embeddings-refactored.ts
 * This is extracted to test the logic in isolation without requiring a real Ollama server.
 */
function normalizeEmbedding(rawEmbedding: number[], targetDimension: number = 1536): number[] {
  // Pad embeddings smaller than target dimension
  if (rawEmbedding.length < targetDimension) {
    const paddingSize = targetDimension - rawEmbedding.length;
    const paddedEmbedding = [
      ...rawEmbedding,
      ...new Array(paddingSize).fill(0)
    ];
    return paddedEmbedding;
  }

  // Truncate embeddings larger than target dimension
  if (rawEmbedding.length > targetDimension) {
    return rawEmbedding.slice(0, targetDimension);
  }

  return rawEmbedding;
}

describe("Embedding Padding and Truncation Logic", () => {
  const TARGET_DIMENSION = 1536;

  describe("Padding smaller embeddings", () => {
    it("should pad 768-dimensional embedding to 1536", () => {
      const embedding768 = new Array(768).fill(0.5);
      const result = normalizeEmbedding(embedding768, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      
      // First 768 values should be original
      expect(result.slice(0, 768)).toEqual(embedding768);
      
      // Remaining values should be zeros (padding)
      expect(result.slice(768)).toEqual(new Array(768).fill(0));
    });

    it("should pad 1024-dimensional embedding to 1536", () => {
      const embedding1024 = new Array(1024).fill(0.7);
      const result = normalizeEmbedding(embedding1024, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      
      // First 1024 values should be original
      expect(result.slice(0, 1024)).toEqual(embedding1024);
      
      // Remaining values should be zeros (padding)
      expect(result.slice(1024)).toEqual(new Array(512).fill(0));
    });

    it("should pad small embedding correctly", () => {
      const smallEmbedding = [0.1, 0.2, 0.3];
      const result = normalizeEmbedding(smallEmbedding, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      expect(result.slice(0, 3)).toEqual(smallEmbedding);
      expect(result.slice(3)).toEqual(new Array(TARGET_DIMENSION - 3).fill(0));
    });

    it("should preserve original values when padding", () => {
      const embedding = new Array(768).fill(0).map((_, i) => i / 1000);
      const result = normalizeEmbedding(embedding, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      
      // Verify original values are preserved
      for (let i = 0; i < 768; i++) {
        expect(result[i]).toBe(embedding[i]);
      }
    });
  });

  describe("Truncating larger embeddings", () => {
    it("should truncate 2048-dimensional embedding to 1536", () => {
      const embedding2048 = new Array(2048).fill(0).map((_, i) => i / 2048);
      const result = normalizeEmbedding(embedding2048, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      
      // Should contain first 1536 values
      expect(result).toEqual(embedding2048.slice(0, TARGET_DIMENSION));
    });

    it("should truncate 3072-dimensional embedding to 1536", () => {
      const embedding3072 = new Array(3072).fill(0.9);
      const result = normalizeEmbedding(embedding3072, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      expect(result).toEqual(new Array(TARGET_DIMENSION).fill(0.9));
    });

    it("should preserve order when truncating", () => {
      const largeEmbedding = new Array(2000).fill(0).map((_, i) => i);
      const result = normalizeEmbedding(largeEmbedding, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      
      // Verify values are in correct order
      for (let i = 0; i < TARGET_DIMENSION; i++) {
        expect(result[i]).toBe(i);
      }
    });
  });

  describe("No modification for exact size", () => {
    it("should return embedding unchanged if already 1536 dimensions", () => {
      const embedding1536 = new Array(1536).fill(0).map((_, i) => i / 1536);
      const result = normalizeEmbedding(embedding1536, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      expect(result).toEqual(embedding1536);
    });

    it("should handle exact target dimension with different values", () => {
      const embedding = new Array(1536).fill(0.5);
      const result = normalizeEmbedding(embedding, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      expect(result).toBe(embedding); // Should be the same reference
    });
  });

  describe("Edge cases", () => {
    it("should handle empty embedding", () => {
      const emptyEmbedding: number[] = [];
      const result = normalizeEmbedding(emptyEmbedding, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      expect(result).toEqual(new Array(TARGET_DIMENSION).fill(0));
    });

    it("should handle single value embedding", () => {
      const singleValue = [0.42];
      const result = normalizeEmbedding(singleValue, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      expect(result[0]).toBe(0.42);
      expect(result.slice(1)).toEqual(new Array(TARGET_DIMENSION - 1).fill(0));
    });

    it("should not mutate original embedding when padding", () => {
      const original = new Array(768).fill(0.5);
      const originalCopy = [...original];
      
      const result = normalizeEmbedding(original, TARGET_DIMENSION);

      // Original should be unchanged
      expect(original).toEqual(originalCopy);
      expect(original.length).toBe(768);
      
      // Result should be padded
      expect(result.length).toBe(TARGET_DIMENSION);
    });

    it("should not mutate original embedding when truncating", () => {
      const original = new Array(2000).fill(0.7);
      const originalCopy = [...original];
      
      const result = normalizeEmbedding(original, TARGET_DIMENSION);

      // Original should be unchanged
      expect(original).toEqual(originalCopy);
      expect(original.length).toBe(2000);
      
      // Result should be truncated
      expect(result.length).toBe(TARGET_DIMENSION);
    });
  });

  describe("Different target dimensions", () => {
    it("should pad to custom target dimension", () => {
      const embedding = new Array(512).fill(0.3);
      const result = normalizeEmbedding(embedding, 1024);

      expect(result.length).toBe(1024);
      expect(result.slice(0, 512)).toEqual(embedding);
      expect(result.slice(512)).toEqual(new Array(512).fill(0));
    });

    it("should truncate to custom target dimension", () => {
      const embedding = new Array(1000).fill(0.8);
      const result = normalizeEmbedding(embedding, 768);

      expect(result.length).toBe(768);
      expect(result).toEqual(new Array(768).fill(0.8));
    });
  });

  describe("Validation of normalized embeddings", () => {
    it("should produce valid embedding after padding 768d", () => {
      const embedding768 = new Array(768).fill(0).map(() => Math.random());
      const result = normalizeEmbedding(embedding768, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      expect(result.every(v => typeof v === 'number')).toBe(true);
      expect(result.every(v => !isNaN(v))).toBe(true);
      expect(result.every(v => isFinite(v))).toBe(true);
    });

    it("should produce valid embedding after padding 1024d", () => {
      const embedding1024 = new Array(1024).fill(0).map(() => Math.random());
      const result = normalizeEmbedding(embedding1024, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      expect(result.every(v => typeof v === 'number')).toBe(true);
      expect(result.every(v => !isNaN(v))).toBe(true);
      expect(result.every(v => isFinite(v))).toBe(true);
    });

    it("should produce valid embedding after truncating 2048d", () => {
      const embedding2048 = new Array(2048).fill(0).map(() => Math.random());
      const result = normalizeEmbedding(embedding2048, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      expect(result.every(v => typeof v === 'number')).toBe(true);
      expect(result.every(v => !isNaN(v))).toBe(true);
      expect(result.every(v => isFinite(v))).toBe(true);
    });
  });

  describe("Real-world scenarios", () => {
    it("should correctly normalize nomic-embed-text output (768d)", () => {
      // Simulate typical nomic-embed-text output
      const nomicEmbedding = new Array(768).fill(0).map(() => 
        (Math.random() * 2 - 1) // Values typically between -1 and 1
      );
      
      const result = normalizeEmbedding(nomicEmbedding, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      
      // Original values preserved
      expect(result.slice(0, 768)).toEqual(nomicEmbedding);
      
      // Padding is zeros
      expect(result.slice(768).every(v => v === 0)).toBe(true);
    });

    it("should correctly normalize mxbai-embed-large output (1024d)", () => {
      // Simulate typical mxbai-embed-large output
      const mxbaiEmbedding = new Array(1024).fill(0).map(() => 
        (Math.random() * 2 - 1)
      );
      
      const result = normalizeEmbedding(mxbaiEmbedding, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      
      // Original values preserved
      expect(result.slice(0, 1024)).toEqual(mxbaiEmbedding);
      
      // Padding is zeros
      expect(result.slice(1024).every(v => v === 0)).toBe(true);
    });

    it("should handle OpenAI text-embedding-3-small output (1536d)", () => {
      // OpenAI outputs 1536d natively
      const openaiEmbedding = new Array(1536).fill(0).map(() => 
        (Math.random() * 2 - 1)
      );
      
      const result = normalizeEmbedding(openaiEmbedding, TARGET_DIMENSION);

      expect(result.length).toBe(TARGET_DIMENSION);
      
      // Should be unchanged
      expect(result).toEqual(openaiEmbedding);
    });
  });
});
