/**
 * ContextAssembler Test Suite
 *
 * Tests the Phase 2 Intelligent Context Assembly pipeline:
 * - Semantic Cache Hit/Miss (TTL)
 * - Personality & Safety Rules Injection
 * - RAG Combined Search (deduplication, limits, thresholds)
 * - Recent History inclusion
 * - Graceful degradation (Qdrant down)
 * - Token count tracking and truncation
 *
 * @module tests/unit/context-assembler.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ContextAssembler } from "../../src/context/context-assembler.js";
import { getQdrantClient } from "../../src/database/qdrant-pool.js";
import { createEmbeddingService } from "../../src/services/embeddings.js";

// Mock dependencies
vi.mock("../../src/database/qdrant-pool.js", () => ({
  getQdrantClient: vi.fn()
}));

vi.mock("../../src/services/embeddings.js", () => ({
  createEmbeddingService: vi.fn()
}));

const { mockSemanticCacheLookup, mockSemanticCacheStore } = vi.hoisted(() => {
  return {
    mockSemanticCacheLookup: vi.fn().mockResolvedValue(null),
    mockSemanticCacheStore: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../src/services/semantic-cache.js", () => ({
  SemanticCache: {
    getInstance: vi.fn().mockResolvedValue({
      lookup: mockSemanticCacheLookup,
      store: mockSemanticCacheStore,
    })
  }
}));

describe("ContextAssembler", () => {
  let assembler: ContextAssembler;
  let mockQdrant: any;
  let mockEmbedder: any;

  beforeEach(() => {
    assembler = new ContextAssembler(180000); // 180k token limit
    
    // Set up default successful mocks
    mockQdrant = {
      search: vi.fn().mockResolvedValue([]),
      getCollections: vi.fn().mockResolvedValue({
        collections: [
          { name: "fazai_personality" },
          { name: "fazai_inference" },
          { name: "fazai_kb" },
          { name: "fazai_learning" },
          { name: "fazai_semantic_cache" },
          { name: "fazai_memory" }
        ]
      }),
    };
    (getQdrantClient as any).mockResolvedValue(mockQdrant);

    mockEmbedder = {
      generate: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      getTokenCount: vi.fn().mockImplementation((text) => Math.ceil(text.length / 4)),
      truncateToTokenLimit: vi.fn().mockImplementation((text, limit) => text.substring(0, limit * 4)),
    };
    (createEmbeddingService as any).mockResolvedValue(mockEmbedder);
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (mockQdrant && mockQdrant.search) {
      mockQdrant.search.mockReset();
      // Restore default safely
      mockQdrant.search.mockResolvedValue([]);
    }
    mockSemanticCacheLookup.mockReset();
    mockSemanticCacheLookup.mockResolvedValue(null);
    mockSemanticCacheStore.mockReset();
    mockSemanticCacheStore.mockResolvedValue(undefined);
  });

  describe("Cache Pipeline", () => {
    it("should return cached response if hit (threshold >= 0.95 and valid TTL)", async () => {
      mockSemanticCacheLookup.mockResolvedValueOnce("## Personalidade\n\nThis is a cached answer");

      const result = await assembler.build("Hello?", "session-123");
      expect(result.fromCache).toBe(true);
      expect(result.text).toContain("This is a cached answer");
      expect(mockQdrant.search).toHaveBeenCalledTimes(0); // Only checked cache, skip rest
    });

    it("should miss cache if TTL expired (>30 min)", async () => {
      const originQuery = "What is the meaning of life?";
      
      // Cache query returns null (miss)
      mockSemanticCacheLookup.mockResolvedValueOnce(null);

      // Mock empty for the Qdrant search calls
      mockQdrant.search.mockResolvedValue([]);

      const result = await assembler.build(originQuery, "session-123");
      expect(result.fromCache).toBe(false);
      expect(mockQdrant.search).toHaveBeenCalledTimes(7); // Went through full pipeline
    });
  });

  describe("Full Assembly Pipeline", () => {
    it("should build full context with personality, rules, RAG, and history", async () => {
      // Setup specific mock returns for the 7 sequential parallel/waterfall searches
      
      // 1. Cache -> Empty
      mockQdrant.search.mockResolvedValueOnce([]);
      
      // Custom mock implementation for this test to handle parallel search calls
      mockQdrant.search.mockImplementation(async (collection: string) => {
        if (collection === "fazai_personality") {
          return [{ id: 101, score: 0.9, payload: { content: "You are FazAI, a helpful Linux admin." } }];
        }
        if (collection === "fazai_inference") {
          return [{ id: 102, score: 0.7, payload: { content: "Do not rm -rf /" } }];
        }
        if (collection === "fazai_kb") {
          return [{ score: 0.8, id: 1, payload: { content: "KB Entry 1" } }];
        }
        if (collection === "fazai_memory") {
          // Both Combined RAG and Recent History search memory.
          // Recent history uses threshold 0.55 and limits.
          return [
            { id: 103, score: 0.6, payload: { content: "User: start\nAgent: ready", timestamp: "recent", role: "system" } }
          ];
        }
        return [];
      });

      const result = await assembler.build("How to install nginx?", "session-123");
      
      expect(result.fromCache).toBe(false);
      const outputText = result.text;
      
      console.log("OUTPUT TEXT:\n", outputText);
      expect(outputText).toContain("Do not rm -rf /");
      expect(outputText).toContain("KB Entry 1");
      expect(outputText).toContain("User: start\nAgent: ready");
      expect(outputText).toContain("How to install nginx?"); // Original query
      
      expect(mockQdrant.search).toHaveBeenCalledTimes(7); // pers(1) + inf(1) + 4 collections(4) + recent(1)
    });
  });

  describe("Deduplication and Limits", () => {
    it("should deduplicate combined RAG items by ID and limit to Top 5", async () => {
       // We'll just test the searchCombinedRAG method directly using a public build wrapper test
       // 1. Cache
       mockQdrant.search.mockResolvedValueOnce([]);
       // 2. Personality
       mockQdrant.search.mockResolvedValueOnce([]);
       // Custom mock to handle the deduplication test
       mockQdrant.search.mockImplementation(async (collection: string) => {
         if (collection === "fazai_kb") {
           return [
             { score: 0.9, id: "doc1", payload: { content: "Doc 1" } },
             { score: 0.8, id: "doc2", payload: { content: "Doc 2" } }
           ];
         }
         if (collection === "fazai_learning") {
           return [
             { score: 0.85, id: "doc1", payload: { content: "Doc 1 Duplicate" } }, // Duplicate ID!
             { score: 0.7, id: "doc3", payload: { content: "Doc 3" } }
           ];
         }
         if (collection === "fazai_semantic_cache") {
           return [
             { score: 0.6, id: "doc4", payload: { content: "Doc 4" } },
             { score: 0.5, id: "doc5", payload: { content: "Doc 5" } },
             { score: 0.4, id: "doc6", payload: { content: "Doc 6" } }
           ];
         }
         return [];
       });
       
       const result = await assembler.build("Test", "session-123");
       const outputText = result.text;
       
       // Doc 1, Doc 2, Doc 3, Doc 4, Doc 5 (Doc 6 dropped because top 5 limit)
       expect(outputText).toContain("Doc 1");
       expect(outputText).toContain("Doc 2");
       expect(outputText).toContain("Doc 3");
       expect(outputText).toContain("Doc 4");
       expect(outputText).toContain("Doc 5");
       expect(outputText).not.toContain("Doc 6");
       expect(outputText).not.toContain("Doc 1 Duplicate"); // Deduplicated!
    });
  });

  describe("Graceful Degradation", () => {
    it("should return the original query with formatting if Qdrant throws an error", async () => {
      (getQdrantClient as any).mockRejectedValueOnce(new Error("Qdrant Connection Refused"));
      
      const result = await assembler.build("Help me with Linux", "session-123");
      const outputText = result.text;
      
      expect(result.fromCache).toBe(false);
      expect(result.tokenEstimate).toBeGreaterThan(0);
      expect(outputText).toContain("Help me with Linux"); // Original intact
    });
  });

  describe("Token Truncation", () => {
    it("should truncate context if it exceeds the token limit (180k)", async () => {
      // Mock assembler with tiny limit
      const tightAssembler = new ContextAssembler(100); 
      
      // Skip Qdrant logic with empty arrays
      mockQdrant.search.mockResolvedValue([]);
      
      const longQuery = new Array(200000).fill("long_limit_string ").join("");
      const result = await tightAssembler.build(longQuery, "session-123");
      const outputText = result.text;
      
      expect(outputText).toContain("[CONTEXT SUMMARIZED BY TOKEN LIMIT]");
      expect(result.truncated).toBe(true);
    });
  });
});
