/**
 * FazAI Qdrant Adapter — GenAIScript agêntico
 *
 * Encapsula qdrant-universal-injection como defTools para uso no loop agêntico.
 * Substitui embeddings quebrados (import hash, mock Math.sin, MiniLM-384d)
 * por ONNX BGE-base-en-v1.5 (768d real, normalizado, com cache LRU).
 *
 * Tools: adapter_embed, adapter_inject, adapter_cache_lookup,
 *        adapter_cache_store, adapter_index, adapter_personality
 */

script({
  title: "FazAI Qdrant Adapter",
  description:
    "Adapter para qdrant-universal-injection com ECOA scoring, semantic cache e ONNX embeddings",
  model: "ollama:phi3",
  temperature: 0.3,
  maxTokens: 4096,
});

// ─── Tool: Embedding ONNX (BGE-base-en-v1.5, 768d) ──────

defTool(
  "adapter_embed",
  "Gera embedding ONNX local (BGE-base-en-v1.5, 768d). CPU only, zero custo, cache LRU integrado.",
  {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Texto para gerar embedding",
      },
    },
    required: ["text"],
  },
  async ({ text }) => {
    try {
      const { embed, getEmbedderInfo } = await import(
        "./tools/adapter-bridge.mjs"
      );

      const vector = await embed(text);
      const info = getEmbedderInfo();

      return JSON.stringify({
        success: true,
        provider: info.provider,
        model: info.model,
        dimension: vector.length,
        isLocal: info.isLocal,
        preview: vector.slice(0, 5).map((v) => v.toFixed(6)),
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: error.message });
    }
  }
);

// ─── Tool: Batch Embedding ───────────────────────────────

defTool(
  "adapter_embed_batch",
  "Gera embeddings em batch via ONNX (mais eficiente para múltiplos textos)",
  {
    type: "object",
    properties: {
      texts: {
        type: "array",
        items: { type: "string" },
        description: "Array de textos para embedding",
      },
    },
    required: ["texts"],
  },
  async ({ texts }) => {
    try {
      const { embedBatch, getEmbedderInfo } = await import(
        "./tools/adapter-bridge.mjs"
      );

      const vectors = await embedBatch(texts);
      const info = getEmbedderInfo();

      return JSON.stringify({
        success: true,
        provider: info.provider,
        count: vectors.length,
        dimension: vectors[0]?.length || 0,
        isLocal: info.isLocal,
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: error.message });
    }
  }
);

// ─── Tool: Multi-Collection Injection (ECOA) ────────────

defTool(
  "adapter_inject",
  "Busca multi-collection com ECOA fusion scoring. Retorna personality + memory + learning + kb + inference ranqueados.",
  {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Query para busca semântica multi-collection",
      },
      collections: {
        type: "array",
        items: { type: "string" },
        description:
          "Collections para buscar (default: todas). Opções: personality, memory, learning, kb, inference, source",
      },
      topK: {
        type: "number",
        description: "Número de resultados por collection (default: 5)",
        default: 5,
      },
      includeSource: {
        type: "boolean",
        description: "Incluir collection source (default: false)",
        default: false,
      },
    },
    required: ["query"],
  },
  async ({ query, collections, topK = 5, includeSource = false }) => {
    try {
      const { inject } = await import("./tools/adapter-bridge.mjs");

      const result = await inject(query, {
        personalityAlways: true,
        collections,
        topK,
        includeSource,
      });

      const summary = {
        personality: result.personality.length,
        memory: result.memory.length,
        learning: result.learning.length,
        kb: result.kb.length,
        inference: result.inference.length,
        source: result.source.length,
      };

      const allChunks = [
        ...result.personality,
        ...result.memory,
        ...result.learning,
        ...result.kb,
        ...result.inference,
        ...result.source,
      ].sort((a, b) => b.fusedScore - a.fusedScore);

      return JSON.stringify({
        success: true,
        totalChunks: result.totalChunks,
        queryTimeMs: result.queryTimeMs,
        collections: summary,
        topResults: allChunks.slice(0, 5).map((c) => ({
          collection: c.collection,
          score: c.fusedScore.toFixed(4),
          content:
            c.payload?.content?.substring(0, 200) ||
            JSON.stringify(c.payload).substring(0, 200),
        })),
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: error.message });
    }
  }
);

// ─── Tool: Semantic Cache Lookup ─────────────────────────

defTool(
  "adapter_cache_lookup",
  "Busca resposta no cache semântico (evita re-inferência para queries similares)",
  {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Query para buscar no cache",
      },
      model: {
        type: "string",
        description: "Modelo usado (ex: phi3, claude-sonnet)",
        default: "phi3",
      },
      provider: {
        type: "string",
        description: "Provider (ex: ollama, anthropic)",
        default: "ollama",
      },
    },
    required: ["query"],
  },
  async ({ query, model = "phi3", provider = "ollama" }) => {
    try {
      const { cacheLookup } = await import("./tools/adapter-bridge.mjs");

      const cached = await cacheLookup(query, model, provider);

      if (cached) {
        return JSON.stringify({
          success: true,
          hit: true,
          hitCount: cached.hitCount,
          response: cached.response,
        });
      }

      return JSON.stringify({
        success: true,
        hit: false,
        message: "Cache miss - gere resposta normalmente",
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: error.message });
    }
  }
);

// ─── Tool: Semantic Cache Store ──────────────────────────

defTool(
  "adapter_cache_store",
  "Armazena resposta no cache semântico para reutilização futura",
  {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Query original",
      },
      response: {
        type: "string",
        description: "Resposta gerada para cachear",
      },
      model: {
        type: "string",
        description: "Modelo que gerou a resposta",
        default: "phi3",
      },
      provider: {
        type: "string",
        description: "Provider do modelo",
        default: "ollama",
      },
    },
    required: ["query", "response"],
  },
  async ({ query, response, model = "phi3", provider = "ollama" }) => {
    try {
      const { cacheStore } = await import("./tools/adapter-bridge.mjs");

      await cacheStore(query, response, model, provider);

      return JSON.stringify({
        success: true,
        message: "Resposta cacheada para queries similares futuras",
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: error.message });
    }
  }
);

// ─── Tool: Indexação com Chunking + Dedup ────────────────

defTool(
  "adapter_index",
  "Indexa texto no Qdrant com chunking automático e deduplicação",
  {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Texto para indexar",
      },
      collection: {
        type: "string",
        description: "Collection destino (ex: fazai_kb, fazai_learning)",
      },
      metadata: {
        type: "object",
        description: "Metadados adicionais para o payload",
      },
      chunkSize: {
        type: "number",
        description: "Tamanho do chunk em caracteres (default: 500)",
        default: 500,
      },
    },
    required: ["text", "collection"],
  },
  async ({ text, collection, metadata = {}, chunkSize = 500 }) => {
    try {
      const { indexText } = await import("./tools/adapter-bridge.mjs");

      const result = await indexText(text, {
        collection,
        metadata,
        chunkSize,
        dedup: true,
      });

      return JSON.stringify({
        success: true,
        ...result,
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: error.message });
    }
  }
);

// ─── Tool: Personalidade ─────────────────────────────────

defTool(
  "adapter_personality",
  "Carrega e retorna a personalidade do FazAI do Qdrant (cache 1h)",
  {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["traits", "prompt"],
        description: "Formato: traits (JSON) ou prompt (texto formatado)",
        default: "prompt",
      },
    },
  },
  async ({ format = "prompt" }) => {
    try {
      const { getPersonalityTraits, getPersonalityPrompt } = await import(
        "./tools/adapter-bridge.mjs"
      );

      if (format === "traits") {
        const traits = await getPersonalityTraits();
        return JSON.stringify({
          success: true,
          format: "traits",
          totalLoaded: traits.totalLoaded,
          style: traits.style,
          expertise: traits.expertise,
          values: traits.values,
        });
      }

      const prompt = await getPersonalityPrompt();
      return JSON.stringify({
        success: true,
        format: "prompt",
        promptLength: prompt.length,
        prompt: prompt.substring(0, 500) + (prompt.length > 500 ? "..." : ""),
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: error.message });
    }
  }
);

// ─── Agente Qdrant Adapter ───────────────────────────────

defAgent(
  "qdrant_adapter",
  "Agente que orquestra busca semântica, cache e injeção via qdrant-universal-injection",
  `Você é o agente Qdrant Adapter do FazAI. Orquestra todas as operações de busca semântica e injeção de contexto.

SUAS FERRAMENTAS:
1. adapter_inject — Busca multi-collection com ECOA fusion scoring (USE PRIMEIRO)
2. adapter_embed — Embedding ONNX local (BGE-base-en-v1.5, 768d)
3. adapter_cache_lookup — Verifica cache semântico antes de inferir
4. adapter_cache_store — Salva resposta no cache após inferir
5. adapter_index — Indexa novo conhecimento com chunking + dedup
6. adapter_personality — Carrega personalidade do FazAI

WORKFLOW RECOMENDADO:
1. adapter_cache_lookup(query) — Verifica cache primeiro
2. Se cache miss: adapter_inject(query) — Busca contexto multi-collection
3. Gera resposta com contexto injetado
4. adapter_cache_store(query, response) — Salva no cache

DIRETRIZES:
- SEMPRE verifique o cache antes de buscar
- Use adapter_inject para queries complexas (multi-collection + ECOA scoring)
- Use adapter_embed quando precisar apenas do vetor (sem busca)
- Salve respostas boas no cache para economizar inferência futura`,
  {
    tools: [
      "adapter_inject",
      "adapter_embed",
      "adapter_embed_batch",
      "adapter_cache_lookup",
      "adapter_cache_store",
      "adapter_index",
      "adapter_personality",
    ],
  }
);

// ─── Prompt Principal ────────────────────────────────────

const userQuery = env.vars.query || "Teste de conexão com adapter";

$`
Você é o agente Qdrant Adapter do FazAI.

QUERY: ${userQuery}

EXECUTE:
1. Verifique o cache: adapter_cache_lookup("${userQuery}")
2. Se cache miss, busque contexto: adapter_inject("${userQuery}")
3. Com base no contexto encontrado, responda à query
4. Salve a resposta no cache: adapter_cache_store("${userQuery}", sua_resposta)

Responda em português brasileiro com base no contexto do Qdrant.
`;
