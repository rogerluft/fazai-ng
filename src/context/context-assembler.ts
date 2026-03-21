/**
 * Context Assembler — Intelligent Pre-LLM Context Assembly
 *
 * Phase 2: Automatically builds rich context before every LLM call.
 * Searches personality, safety rules, RAG, memory, and current task
 * to provide the most relevant context to the AI.
 *
 * Uses existing QdrantClient, EmbeddingService, and SemanticCache.
 *
 * Config:
 *   ragThreshold = 0.65
 *   recentLimit  = 12
 *   maxContextTokensEstimate = 180000
 *
 * @module context/context-assembler
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { logger } from "../logger.js";
import { getQdrantClient } from "../database/qdrant-pool.js";
import { createEmbeddingService, type EmbeddingService } from "../services/embeddings.js";
import { SemanticCache } from "../services/semantic-cache.js";

// ─── Qdrant Collection names ───────────────────────────────────────────
const C = {
  personality:    "fazai_personality",
  memory:         "fazai_memory",
  learning:       "fazai_learning",
  kb:             "fazai_kb",
  inference:      "fazai_inference",
  semantic_cache: "fazai_semantic_cache",
} as const;

// ─── Config ────────────────────────────────────────────────────────────
const RAG_THRESHOLD           = 0.65;
const RECENT_HISTORY_LIMIT    = 12;
const RECENT_HISTORY_THRESHOLD = 0.55;
const MAX_CONTEXT_TOKENS      = 180_000;
const CONTEXT_CACHE_TTL_MS    = 30 * 60 * 1000; // 30 minutes
const CHARS_PER_TOKEN         = 4; // rough estimation

/**
 * Result of context assembly
 */
export interface AssembledContext {
  /** Full assembled context string with ## headers */
  text: string;
  /** Personality context extracted */
  personality: string;
  /** Safety/inference rules extracted */
  safetyRules: string;
  /** RAG results (top-5 combined from multiple collections) */
  ragContext: string;
  /** Recent conversation history */
  recentHistory: string;
  /** Current task description */
  currentTask: string;
  /** Whether context was truncated due to token limit */
  truncated: boolean;
  /** Estimated token count */
  tokenEstimate: number;
  /** Whether result came from cache */
  fromCache: boolean;
  /** Number of RAG items found */
  ragItemCount: number;
  /** Number of history items found */
  historyItemCount: number;
}

/**
 * Result of a single Qdrant search
 */
interface SearchResult {
  id: string | number;
  content: string;
  score: number;
  collection: string;
  timestamp?: string;
  role?: string;
}

/**
 * ContextAssembler — builds rich context before every LLM call
 *
 * Queries:
 * 1. SemanticCache (fast path — 30 min TTL)
 * 2. fazai_personality (top-1, always include complete)
 * 3. fazai_inference (top-3, threshold 0.65 — safety rules)
 * 4. Combined RAG: fazai_kb + fazai_learning + fazai_semantic_cache + fazai_memory
 *    → merge, sort by score, deduplicate by ID, take top-5
 * 5. Recent history: fazai_memory top-12, threshold 0.55
 * 6. Current task at the end
 *
 * Output: formatted string with ## section headers
 */
export class ContextAssembler {
  private client: QdrantClient | null = null;
  private embedService: EmbeddingService | null = null;
  private initialized = false;

  /**
   * Lazy init — ensures Qdrant and embedding service are ready
   */
  private async ensureInit(): Promise<void> {
    if (this.initialized) return;

    try {
      this.client = await getQdrantClient();
      this.embedService = await createEmbeddingService();
      this.initialized = true;
    } catch (error: any) {
      logger.warn(`[ContextAssembler] Init failed: ${error.message}`);
      // Graceful degradation — will return empty sections
    }
  }

  /**
   * Build rich context for an LLM call
   *
   * @param task The current task/query description
   * @param sessionId Session ID for cache keying
   * @returns Assembled context with all sections
   */
  async build(task: string, sessionId: string): Promise<AssembledContext> {
    await this.ensureInit();

    // ── 1. Try semantic cache ─────────────────────────────────────────
    const cacheKey = `ctx:${sessionId}:${task}`;
    try {
      const cache = await SemanticCache.getInstance();
      const cached = await cache.lookup(cacheKey, "context-assembler", "local", {
        similarityThreshold: 0.95,
        maxAge: CONTEXT_CACHE_TTL_MS,
        skipNormalization: true,
      });

      if (cached) {
        logger.debug("[ContextAssembler] Cache HIT");
        return {
          text: cached,
          personality: "",
          safetyRules: "",
          ragContext: "",
          recentHistory: "",
          currentTask: task,
          truncated: false,
          tokenEstimate: this.estimateTokens(cached),
          fromCache: true,
          ragItemCount: 0,
          historyItemCount: 0,
        };
      }
    } catch (error: any) {
      logger.debug(`[ContextAssembler] Cache lookup failed: ${error.message}`);
    }

    // ── 2. Embed the task ─────────────────────────────────────────────
    let embedding: number[] = [];
    if (this.embedService) {
      try {
        embedding = await this.embedService.generate(task);
      } catch (error: any) {
        logger.warn(`[ContextAssembler] Embedding failed: ${error.message}`);
      }
    }

    // ── 3-6. Parallel searches ────────────────────────────────────────
    const [personality, safety, ragResults, history] = await Promise.all([
      this.searchPersonality(embedding),
      this.searchSafety(embedding),
      this.searchCombinedRAG(embedding),
      this.searchRecentHistory(embedding),
    ]);

    // ── 7. Current task ───────────────────────────────────────────────
    const currentTask = task;

    // ── 8. Assemble with ## headers ───────────────────────────────────
    const sections: string[] = [];

    if (personality) {
      sections.push(`## Personalidade\n\n${personality}`);
    }

    if (safety) {
      sections.push(`## Regras de Segurança\n\n${safety}`);
    }

    if (ragResults.text) {
      sections.push(`## Contexto Relevante (RAG)\n\n${ragResults.text}`);
    }

    if (history.text) {
      sections.push(`## Histórico Recente\n\n${history.text}`);
    }

    sections.push(`## Tarefa Atual\n\n${currentTask}`);

    let fullText = sections.join("\n\n---\n\n");
    let truncated = false;

    // ── 9. Token limit check ──────────────────────────────────────────
    const tokenEstimate = this.estimateTokens(fullText);
    if (tokenEstimate > MAX_CONTEXT_TOKENS) {
      const maxChars = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;
      fullText = fullText.substring(0, maxChars) + "\n\n[CONTEXT SUMMARIZED BY TOKEN LIMIT]";
      truncated = true;
      logger.info(
        `[ContextAssembler] Truncated: ${tokenEstimate} → ${MAX_CONTEXT_TOKENS} tokens`
      );
    }

    // ── 10. Save to semantic cache (30 min TTL) ───────────────────────
    try {
      const cache = await SemanticCache.getInstance();
      await cache.store(cacheKey, fullText, "context-assembler", "local", {
        ttl: CONTEXT_CACHE_TTL_MS,
        skipNormalization: true,
      });
    } catch (error: any) {
      logger.debug(`[ContextAssembler] Cache store failed: ${error.message}`);
    }

    const result: AssembledContext = {
      text: fullText,
      personality,
      safetyRules: safety,
      ragContext: ragResults.text,
      recentHistory: history.text,
      currentTask,
      truncated,
      tokenEstimate: this.estimateTokens(fullText),
      fromCache: false,
      ragItemCount: ragResults.count,
      historyItemCount: history.count,
    };

    logger.info(
      `[ContextAssembler] Built: ${result.tokenEstimate} tokens, ` +
      `${result.ragItemCount} RAG items, ${result.historyItemCount} history items` +
      `${result.truncated ? " (TRUNCATED)" : ""}`
    );

    return result;
  }

  /**
   * Search fazai_personality — top-1, always include complete
   */
  private async searchPersonality(embedding: number[]): Promise<string> {
    if (!this.client || embedding.length === 0) return "";

    try {
      const results = await this.searchCollection(
        C.personality,
        embedding,
        1,      // top-1
        0.0     // no threshold — always include personality
      );

      if (results.length > 0) {
        return results[0].content;
      }
    } catch (error: any) {
      logger.debug(`[ContextAssembler] Personality search failed: ${error.message}`);
    }

    return "";
  }

  /**
   * Search fazai_inference — top-3, threshold 0.65 (safety rules)
   */
  private async searchSafety(embedding: number[]): Promise<string> {
    if (!this.client || embedding.length === 0) return "";

    try {
      const results = await this.searchCollection(
        C.inference,
        embedding,
        3,              // top-3
        RAG_THRESHOLD   // 0.65
      );

      if (results.length > 0) {
        return results
          .map((r, i) => `${i + 1}. ${r.content}`)
          .join("\n\n");
      }
    } catch (error: any) {
      logger.debug(`[ContextAssembler] Safety search failed: ${error.message}`);
    }

    return "";
  }

  /**
   * Combined RAG: search top-5 in fazai_kb + fazai_learning +
   * fazai_semantic_cache + fazai_memory → combine, sort by score,
   * deduplicate by ID, take top-5
   */
  private async searchCombinedRAG(
    embedding: number[]
  ): Promise<{ text: string; count: number }> {
    if (!this.client || embedding.length === 0) return { text: "", count: 0 };

    try {
      const ragCollections = [C.kb, C.learning, C.semantic_cache, C.memory];

      const searchPromises = ragCollections.map((collection) =>
        this.searchCollection(collection, embedding, 5, RAG_THRESHOLD)
      );

      const allResults = await Promise.all(searchPromises);
      const flatResults = allResults.flat();

      // Sort by score descending
      flatResults.sort((a, b) => b.score - a.score);

      // Deduplicate by ID
      const seen = new Set<string | number>();
      const unique: SearchResult[] = [];
      for (const r of flatResults) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          unique.push(r);
        }
      }

      // Take top-5
      const top5 = unique.slice(0, 5);

      if (top5.length === 0) return { text: "", count: 0 };

      const text = top5
        .map(
          (r, i) =>
            `**[${i + 1}]** (${r.collection}, score: ${r.score.toFixed(3)})\n${r.content}`
        )
        .join("\n\n");

      return { text, count: top5.length };
    } catch (error: any) {
      logger.debug(`[ContextAssembler] Combined RAG failed: ${error.message}`);
      return { text: "", count: 0 };
    }
  }

  /**
   * Recent history: top-12 of fazai_memory with threshold 0.55
   * Formatted as [timestamp] role: content
   */
  private async searchRecentHistory(
    embedding: number[]
  ): Promise<{ text: string; count: number }> {
    if (!this.client || embedding.length === 0) return { text: "", count: 0 };

    try {
      const results = await this.searchCollection(
        C.memory,
        embedding,
        RECENT_HISTORY_LIMIT,      // 12
        RECENT_HISTORY_THRESHOLD   // 0.55
      );

      if (results.length === 0) return { text: "", count: 0 };

      // Sort by timestamp ascending (chronological order)
      results.sort((a, b) => {
        const tA = a.timestamp || "";
        const tB = b.timestamp || "";
        return tA.localeCompare(tB);
      });

      const text = results
        .map((r) => {
          const ts = r.timestamp ? `[${r.timestamp}]` : "[?]";
          const role = r.role || "system";
          return `${ts} ${role}: ${r.content}`;
        })
        .join("\n");

      return { text, count: results.length };
    } catch (error: any) {
      logger.debug(`[ContextAssembler] History search failed: ${error.message}`);
      return { text: "", count: 0 };
    }
  }

  /**
   * Generic Qdrant collection search with graceful degradation
   */
  private async searchCollection(
    collection: string,
    embedding: number[],
    limit: number,
    scoreThreshold: number
  ): Promise<SearchResult[]> {
    if (!this.client) return [];

    try {
      // Check collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c) => c.name === collection);
      if (!exists) {
        logger.debug(`[ContextAssembler] Collection not found: ${collection}`);
        return [];
      }

      const results = await this.client.search(collection, {
        vector: embedding,
        limit,
        score_threshold: scoreThreshold > 0 ? scoreThreshold : undefined,
        with_payload: true,
      });

      return results.map((r) => {
        const payload = r.payload as Record<string, unknown>;
        return {
          id: r.id,
          content:
            (payload?.content as string) ||
            (payload?.text as string) ||
            (payload?.description as string) ||
            JSON.stringify(payload),
          score: r.score,
          collection,
          timestamp: payload?.timestamp as string | undefined,
          role: payload?.role as string | undefined,
        };
      });
    } catch (error: any) {
      logger.debug(
        `[ContextAssembler] Search ${collection} failed: ${error.message}`
      );
      return [];
    }
  }

  /**
   * Estimate tokens from text length (4 chars ≈ 1 token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }
}
