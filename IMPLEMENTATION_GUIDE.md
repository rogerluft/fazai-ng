# FazAI Memory Persistence - Implementation Guide

## Quick Start: Fix Memory Persistence in 4 Steps

This guide provides code examples for implementing the missing integration points identified in the diagnosis.

---

## Step 1: Create Personality Loader Service

**File**: `/home/rluft/fazai-ng/src/services/personality-loader.ts` (NEW)

```typescript
/**
 * Personality Loader Service
 *
 * Loads and caches personality traits from Qdrant fazai_personality collection.
 * Builds system prompts that inject personality context into LLM calls.
 */

import { getQdrantClient } from "../database/qdrant-pool";
import { logger } from "../logger";
import { withRetry } from "../utils/retry";

export interface PersonalityTrait {
  trait_name: string;
  category: string;
  value: string;
  intensity: number;
  context?: string;
  tags?: string[];
}

export interface PersonalityTraits {
  traits: PersonalityTrait[];
  expertise: string[];
  style: string[];
  loadedAt: Date;
}

// Singleton cache for personality (rarely changes)
let cachedPersonality: PersonalityTraits | null = null;
let cacheTimestamp: Date | null = null;
const CACHE_TTL = 3600000; // 1 hour

/**
 * Load personality traits from Qdrant
 *
 * Caches results for 1 hour to avoid repeated queries.
 * Call clearPersonalityCache() to force refresh.
 */
export async function loadPersonalityFromQdrant(): Promise<PersonalityTraits> {
  // Check cache
  if (cachedPersonality && cacheTimestamp) {
    const age = Date.now() - cacheTimestamp.getTime();
    if (age < CACHE_TTL) {
      logger.debug("✓ Using cached personality traits");
      return cachedPersonality;
    }
  }

  try {
    logger.debug("🧠 Loading personality from Qdrant...");

    const client = await getQdrantClient();

    // Query fazai_personality collection
    const response = await withRetry(
      () => client.scroll("fazai_personality", {
        limit: 100,
        with_payload: true,
        with_vector: false,
      }),
      { provider: "qdrant", maxRetries: 2 }
    );

    const points = response.points || [];

    if (points.length === 0) {
      logger.warn("⚠️ No personality traits found in Qdrant");
      return getDefaultPersonality();
    }

    // Format traits
    const traits: PersonalityTrait[] = points.map((point: any) => ({
      trait_name: point.payload?.trait_name || "Unknown",
      category: point.payload?.category || "general",
      value: point.payload?.value || "",
      intensity: point.payload?.intensity || 0.5,
      context: point.payload?.context,
      tags: point.payload?.tags || [],
    }));

    // Extract expertise and style
    const expertise = extractExpertise(traits);
    const style = extractStyle(traits);

    const personality: PersonalityTraits = {
      traits,
      expertise,
      style,
      loadedAt: new Date(),
    };

    // Cache it
    cachedPersonality = personality;
    cacheTimestamp = new Date();

    logger.info(`✅ Personality loaded: ${traits.length} traits, ${expertise.length} expertise areas`);
    return personality;

  } catch (error: any) {
    logger.error(`Failed to load personality from Qdrant: ${error.message}`);
    return getDefaultPersonality();
  }
}

/**
 * Extract expertise areas from traits
 */
function extractExpertise(traits: PersonalityTrait[]): string[] {
  const expertise = new Set<string>();

  for (const trait of traits) {
    if (trait.category === "expertise" || trait.category === "domain") {
      expertise.add(trait.value.toLowerCase());
    }
    if (trait.tags) {
      for (const tag of trait.tags) {
        if (["linux", "networking", "docker", "security", "monitoring"].includes(tag.toLowerCase())) {
          expertise.add(tag.toLowerCase());
        }
      }
    }
  }

  return Array.from(expertise);
}

/**
 * Extract communication style from traits
 */
function extractStyle(traits: PersonalityTrait[]): string[] {
  const style = new Set<string>();

  for (const trait of traits) {
    if (trait.category === "style" || trait.category === "communication") {
      style.add(trait.value.toLowerCase());
    }
  }

  return Array.from(style);
}

/**
 * Build system prompt with personality context
 */
export function buildPersonalitySystemPrompt(personality: PersonalityTraits): string {
  const { traits, expertise, style } = personality;

  // Build expertise section
  const expertiseStr = expertise.length > 0
    ? `You are an expert in: ${expertise.join(", ")}.`
    : "";

  // Build style section
  const styleStr = style.length > 0
    ? `Your communication style is: ${style.join(", ")}.`
    : "";

  // Build traits section (top 5 by intensity)
  const topTraits = traits
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 5);

  const traitsStr = topTraits.length > 0
    ? `Your key traits:\n${topTraits.map(t => `- ${t.trait_name}: ${t.value} (${t.context || ""})`).join("\n")}`
    : "";

  return `
You are a highly specialized AI assistant with the following personality:

${expertiseStr}
${styleStr}

${traitsStr}

Always respond according to your personality traits and expertise. Be consistent with your defined style.
`.trim();
}

/**
 * Clear personality cache (force reload)
 */
export function clearPersonalityCache(): void {
  cachedPersonality = null;
  cacheTimestamp = null;
  logger.debug("✓ Personality cache cleared");
}

/**
 * Get default personality (fallback)
 */
function getDefaultPersonality(): PersonalityTraits {
  return {
    traits: [
      {
        trait_name: "Helpful",
        category: "general",
        value: "High",
        intensity: 0.8,
        context: "Always try to help the user",
      },
    ],
    expertise: ["general"],
    style: ["friendly"],
    loadedAt: new Date(),
  };
}
```

---

## Step 2: Create Memory Loader Service

**File**: `/home/rluft/fazai-ng/src/services/memory-loader.ts` (NEW)

```typescript
/**
 * Memory Loader Service
 *
 * Loads relevant memories from Qdrant fazai_memory collection using semantic search.
 * Stores new memories with embeddings for future retrieval.
 */

import { getQdrantClient } from "../database/qdrant-pool";
import { createEmbeddingService } from "./embeddings";
import { logger } from "../logger";
import { withRetry } from "../utils/retry";

export interface Memory {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  score?: number;
}

/**
 * Load relevant memories using semantic search
 *
 * @param query User's current query
 * @param limit Number of memories to retrieve (default: 5)
 * @returns Array of relevant memories sorted by relevance
 */
export async function loadRelevantMemories(
  query: string,
  limit: number = 5
): Promise<Memory[]> {
  try {
    logger.debug(`🔍 Searching for relevant memories: "${query.substring(0, 50)}..."`);

    const client = await getQdrantClient();
    const embeddingService = await createEmbeddingService();

    // Generate embedding for query
    const embedding = await embeddingService.generate(query);

    // Semantic search in fazai_memory
    const response = await withRetry(
      () => client.search("fazai_memory", {
        vector: embedding,
        limit,
        with_payload: true,
        score_threshold: 0.5, // Only return relevant matches
      }),
      { provider: "qdrant", maxRetries: 2 }
    );

    const memories: Memory[] = response.map((result: any) => ({
      id: result.id,
      role: result.payload?.role || "user",
      content: result.payload?.content || "",
      timestamp: new Date(result.payload?.timestamp || Date.now()),
      score: result.score,
    }));

    logger.debug(`✓ Found ${memories.length} relevant memories`);
    return memories;

  } catch (error: any) {
    logger.debug(`Memory search failed: ${error.message}`);
    return [];
  }
}

/**
 * Store memory in Qdrant with embedding
 *
 * @param memory Memory to store
 */
export async function storeMemoryInQdrant(memory: {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}): Promise<void> {
  try {
    logger.debug("💾 Storing memory in Qdrant...");

    const client = await getQdrantClient();
    const embeddingService = await createEmbeddingService();

    // Generate embedding
    const embedding = await embeddingService.generate(memory.content);

    // Generate ID (timestamp-based)
    const id = Date.now();

    // Upsert to Qdrant
    await withRetry(
      () => client.upsert("fazai_memory", {
        points: [
          {
            id,
            vector: embedding,
            payload: {
              role: memory.role,
              content: memory.content,
              timestamp: memory.timestamp.toISOString(),
              created_at: new Date().toISOString(),
            },
          },
        ],
      }),
      { provider: "qdrant", maxRetries: 2 }
    );

    logger.debug(`✅ Memory stored: ID ${id}`);

  } catch (error: any) {
    logger.debug(`Failed to store memory: ${error.message}`);
    // Fail gracefully - don't block conversation
  }
}

/**
 * Format memories for context injection
 *
 * @param memories Array of memories
 * @returns Formatted string for system prompt
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) {
    return "";
  }

  const formattedMemories = memories
    .map((m, i) => {
      const timeAgo = getTimeAgo(m.timestamp);
      const role = m.role === "user" ? "User" : "Assistant";
      const score = m.score ? ` (relevance: ${m.score.toFixed(2)})` : "";
      return `${i + 1}. [${timeAgo}] ${role}${score}: ${m.content.substring(0, 200)}...`;
    })
    .join("\n");

  return `
--- RELEVANT PAST CONVERSATIONS ---
${formattedMemories}
--- END OF PAST CONVERSATIONS ---
`.trim();
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(timestamp: Date): string {
  const now = Date.now();
  const diff = now - timestamp.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
```

---

## Step 3: Modify CLI Mode to Load Personality

**File**: `/home/rluft/fazai-ng/src/cli-mode.ts` (MODIFY)

**Add imports** at the top:
```typescript
import { loadPersonalityFromQdrant, buildPersonalitySystemPrompt } from "./services/personality-loader";
import { storeMemoryInQdrant } from "./services/memory-loader";
```

**Modify `runCliMode()` function** (around line 246):

```typescript
export async function runCliMode(): Promise<void> {
  const defaultModel = models[0];

  // Exibe logo visual
  console.clear();
  showLogo();

  logger.info(chalk.gray("Digite mensagens livres para conversar ou use comandos especiais começando com '/'"));
  logger.info(chalk.gray("💡 Busca na web: 'pesquise sobre <tema>', 'busque informações sobre <assunto>'"));
  logger.info(
    chalk.gray(
      "Comandos: /help, /exec, /api, /dashboard, /cloudflare, /spamexperts, /opnsense\n"
    )
  );

  if (!checkAPIKey(defaultModel.provider)) {
    await getAndSetAPIKey(defaultModel.provider);
  }
  logger.info(chalk.green(`✅ API key configurada (${defaultModel.provider})`));

  // ✅ NEW: Load personality from Qdrant
  logger.info(chalk.cyan("🧠 Loading personality from Qdrant..."));
  const personality = await loadPersonalityFromQdrant();
  const personalityPrompt = buildPersonalitySystemPrompt(personality);
  logger.info(chalk.green(`✅ Personality loaded: ${personality.traits.length} traits`));

  const storedConversation = loadConversationHistory();
  const conversationHistory: ConversationTurn[] = storedConversation.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));
  const historyBuffer: string[] = loadCommandHistory();

  // ... rest of function unchanged ...

  const handleChat = async (message: string) => {
    conversationHistory.push({ role: "user", content: message });
    appendConversationEntry({
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    });

    // ✅ NEW: Store user message in Qdrant
    await storeMemoryInQdrant({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    let fullReply = "";
    try {
      // ✅ MODIFIED: Pass personality to askAI (see Step 4)
      const stream = askAI("", message, defaultModel.name, defaultModel.provider, true);

      for await (const chunk of stream) {
        fullReply += chunk;
        process.stdout.write(chunk);
      }
      console.log();
    } catch (error: any) {
      logger.error(`Erro ao processar resposta: ${error.message}`);
    }

    conversationHistory.push({ role: "assistant", content: fullReply });
    appendConversationEntry({
      role: "assistant",
      content: fullReply,
      timestamp: new Date().toISOString(),
    });

    // ✅ NEW: Store assistant response in Qdrant
    await storeMemoryInQdrant({
      role: "assistant",
      content: fullReply,
      timestamp: new Date(),
    });
  };

  // ... rest of function unchanged ...
}
```

---

## Step 4: Modify askAI to Inject Personality

**File**: `/home/rluft/fazai-ng/src/askAI.ts` (MODIFY)

**Add imports** at the top:
```typescript
import { loadPersonalityFromQdrant, buildPersonalitySystemPrompt } from "./services/personality-loader";
import { loadRelevantMemories, formatMemoriesForPrompt } from "./services/memory-loader";
import { neuralQuery } from "./rag/neural-flow";
import { createEmbeddingService } from "./services/embeddings";
```

**Modify `askAI()` function** to enrich context:

```typescript
export async function* askAI(
  fileContent: string,
  question: string,
  model: string,
  provider: (typeof models)[number]["provider"],
  isGeneralQuestion: boolean = false
): AsyncGenerator<string, void, undefined> {
  const prompt = isGeneralQuestion ? generalAskPrompt(question) : askPrompt(question);

  // Try semantic cache first
  try {
    const cache = await SemanticCache.getInstance();
    const cachedResponse = await cache.lookup(prompt, model, provider);

    if (cachedResponse) {
      logger.info("🎯 Using cached response (semantic match)");
      yield cachedResponse;
      return;
    }
  } catch (error: any) {
    logger.debug(`Cache lookup failed: ${error.message}`);
  }

  // ✅ NEW: Load personality and memories for context enrichment
  let personalityContext = "";
  let memoriesContext = "";
  let ragContext = "";

  try {
    if (isGeneralQuestion) {
      // Load personality
      const personality = await loadPersonalityFromQdrant();
      personalityContext = buildPersonalitySystemPrompt(personality);

      // Load relevant memories (semantic search)
      const memories = await loadRelevantMemories(question, 5);
      memoriesContext = formatMemoriesForPrompt(memories);

      // RAG enrichment (KB + Learning)
      const embeddingService = await createEmbeddingService();
      const embedding = await embeddingService.generate(question);
      const ragResult = await neuralQuery(question, embedding, {
        topK: 5,
        minScore: 0.5,
        collections: ["fazai_kb", "fazai_learning"],
        weights: {
          kb: 0.6,
          learning: 0.4,
          personality: 0,
          memory: 0,
          inference: 0,
        },
      });

      if (ragResult.fusedResults.length > 0) {
        ragContext = "\n--- RELEVANT KNOWLEDGE (RAG) ---\n";
        for (const result of ragResult.fusedResults.slice(0, 3)) {
          ragContext += `• [Score: ${result.score.toFixed(2)}] ${result.content.substring(0, 200)}...\n`;
        }
        ragContext += "--- END OF RAG CONTEXT ---\n";
      }

      logger.info(`✨ Context enriched: ${memories.length} memories, ${ragResult.fusedResults.length} RAG results`);
    }
  } catch (error: any) {
    logger.debug(`Context enrichment failed: ${error.message}`);
    // Continue without enrichment
  }

  // Cache miss - call provider with enriched context
  let fullResponse = "";

  if (provider === "anthropic") {
    const anthropic = new Anthropic({
      timeout: API_TIMEOUTS.anthropic,
    });

    // ✅ MODIFIED: Build system message with personality and context
    const systemMessage = isGeneralQuestion
      ? `${personalityContext}\n\n${memoriesContext}\n\n${ragContext}\n\nYou are an intelligent and well-informed assistant. Answer questions clearly and helpfully.`
      : `CODE:\n${fileContent}\n`;

    const stream = await withRetry(
      () => anthropic.messages.create({
        messages: [{ role: "user", content: prompt }],
        model: model,
        max_tokens: 4096,
        stream: true,
        system: systemMessage,
      }),
      { provider: "anthropic" }
    );

    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta?.type === "text_delta"
      ) {
        fullResponse += chunk.delta.text;
        yield chunk.delta.text;
      }
    }
  } else if (provider === "openai") {
    const openai = new OpenAI({
      timeout: API_TIMEOUTS.openai,
    });

    // ✅ MODIFIED: Build system message with personality and context
    const systemMessage = isGeneralQuestion
      ? `${personalityContext}\n\n${memoriesContext}\n\n${ragContext}\n\nYou are an intelligent and well-informed assistant. Answer questions clearly and helpfully.`
      : `CODE:\n${fileContent}\n`;

    const stream = await withRetry(
      () => openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
      { provider: "openai" }
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullResponse += content;
      yield content;
    }
  }

  // ... (repeat for other providers: openrouter, ollama, google, perplexity) ...

  // Store response in cache
  try {
    const cache = await SemanticCache.getInstance();
    await cache.store(prompt, model, provider, fullResponse);
  } catch (error: any) {
    logger.debug(`Cache storage failed: ${error.message}`);
  }
}
```

---

## Step 5: Fix Web API Personality Route

**File**: `/home/rluft/fazai-ng/web/app/api/personality/route.ts` (MODIFY)

Replace mock data with real Qdrant query:

```typescript
import { NextResponse } from "next/server";
import { qdrant } from "@/lib/qdrant";
import type { Personality } from "@/types/fazai";

export async function GET() {
  try {
    // Query fazai_personality collection
    const response = await qdrant.scroll("fazai_personality", {
      limit: 100,
      with_payload: true,
      with_vector: false,
    });

    const points = response.points || [];

    if (points.length === 0) {
      return NextResponse.json(
        { error: "No personality traits found" },
        { status: 404 }
      );
    }

    // Format traits
    const traits = points.map((point: any) => ({
      trait_name: point.payload?.trait_name || "Unknown",
      category: point.payload?.category || "general",
      value: point.payload?.value || "",
      intensity: point.payload?.intensity || 0.5,
      context: point.payload?.context,
      tags: point.payload?.tags || [],
    }));

    const personality: Personality = {
      id: "personality_001",
      traits,
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(personality);
  } catch (error: any) {
    console.error("Failed to fetch personality:", error);
    return NextResponse.json(
      { error: "Failed to fetch personality", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Update personality traits in Qdrant
    // (Implementation depends on update strategy)

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update personality", details: error.message },
      { status: 500 }
    );
  }
}
```

---

## Testing the Implementation

### Test 1: Verify Personality Loading

```bash
fazai --cli

# Expected output:
# 🧠 Loading personality from Qdrant...
# ✅ Personality loaded: 13 traits
```

### Test 2: Verify Personality in Responses

```bash
fazai --cli
> What are your expertise areas?

# Expected: Agent should mention linux, nginx, docker, security, etc.
```

### Test 3: Verify Memory Persistence

```bash
# Session 1
fazai --cli
> My favorite color is blue
> [Exit]

# Session 2
fazai --cli
> What's my favorite color?

# Expected: Agent should remember "blue"
```

### Test 4: Verify RAG Enrichment

```bash
fazai --cli
> How do I configure nginx?

# Expected: Agent should use knowledge from fazai_kb and fazai_learning
# Look for "RELEVANT KNOWLEDGE (RAG)" in debug logs (fazai --cli --debug)
```

---

## Debugging Checklist

If personality is not loading:

1. ✅ Verify Qdrant is running: `curl http://localhost:6333/health`
2. ✅ Verify collections exist: `fazai vector validate`
3. ✅ Check personality points:
   ```bash
   curl http://localhost:6333/collections/fazai_personality/points/scroll \
     -X POST -H "Content-Type: application/json" \
     -d '{"limit": 10, "with_payload": true}'
   ```
4. ✅ Enable debug logging: `fazai --cli --debug`
5. ✅ Check logs: `tail -f /var/log/fazai/fazai.log`

---

## Performance Optimization

### Lazy Loading

```typescript
let globalPersonality: PersonalityTraits | null = null;

export async function getPersonality(): Promise<PersonalityTraits> {
  if (!globalPersonality) {
    globalPersonality = await loadPersonalityFromQdrant();
  }
  return globalPersonality;
}
```

### Embedding Cache

```typescript
import LRUCache from "lru-cache";

const embeddingCache = new LRUCache<string, number[]>({
  max: 1000,
  ttl: 3600000, // 1 hour
});

export async function getCachedEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) return cached;

  const embedding = await generateEmbedding(text);
  embeddingCache.set(text, embedding);
  return embedding;
}
```

### Parallel Execution

```typescript
const [personality, memories, ragContext] = await Promise.all([
  loadPersonalityFromQdrant(),
  loadRelevantMemories(query),
  enrichContextWithRAG(query),
]);
```

---

## Next Steps

1. ✅ Implement Step 1-5 above
2. ✅ Test each step independently
3. ✅ Run full integration test
4. ✅ Monitor performance (should be <500ms overhead)
5. ✅ Document in CHANGELOG.md
6. ✅ Update bash completion if needed
7. ✅ Update help text if needed

**Estimated Time**: 4-6 hours for core implementation + 2-3 hours for testing and optimization.
