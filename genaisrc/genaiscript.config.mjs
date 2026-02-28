/**
 * GenAIScript Configuration for FazAI
 * Configura modelos, providers e defaults
 */

export default {
  // Modelo padrão - Sonnet 4.5 (balanceado, rápido)
  // Opus 4.5 disponível via alias "opus" para tarefas complexas
  model: "anthropic:claude-sonnet-4-5-20250929",

  // Aliases para modelos
  // Hierarquia: local → cloud-balanced → cloud-premium
  modelAliases: {
    // Modelos locais via Ollama (PRIORIDADE para economia)
    "local": "ollama:phi3",
    "local-large": "ollama:llama3.2",
    // "local-embed" não mais usado — embeddings via ONNX BGE-base-en-v1.5 (qdrant-universal-injection)

    // Premium cloud - máxima capacidade (usar com parcimônia)
    "opus": "anthropic:claude-opus-4-5-20251101",
    "premium": "anthropic:claude-opus-4-5-20251101",

    // Balanced cloud - rápido + capaz (default para cloud)
    "sonnet": "anthropic:claude-sonnet-4-5-20250929",
    "fast": "anthropic:claude-sonnet-4-5-20250929",
    "smart": "anthropic:claude-sonnet-4-5-20250929",

    // Efficient cloud - custo otimizado
    "small": "anthropic:claude-3-5-haiku-latest",
    "haiku": "anthropic:claude-3-5-haiku-latest",

    // Gemini alternatives
    "gemini": "google:gemini-2.5-pro",
    "gemini-fast": "google:gemini-2.5-flash",

    // Modelos de fallback
    "fallback": "openai:gpt-4o-mini",
  },

  // Configuração de providers
  providers: {
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    },
    anthropic: {
      // Usa ANTHROPIC_API_KEY do ambiente
    },
    openai: {
      // Usa OPENAI_API_KEY do ambiente
    },
  },

  // Configurações de execução
  run: {
    // Timeout padrão em ms
    timeout: 120000,

    // Retry automático
    retry: {
      maxAttempts: 3,
      delay: 1000,
    },

    // Cache de respostas
    cache: {
      enabled: true,
      ttl: 3600000, // 1 hora
    },
  },

  // Configurações de segurança
  safety: {
    // Habilita prompts de Responsible AI
    responsibleAI: true,

    // Bloqueia conteúdo sensível
    contentFilter: true,
  },

  // Diretórios de scripts
  scripts: {
    // Diretório principal
    root: "./genaisrc",

    // Diretório de tools
    tools: "./genaisrc/tools",
  },

  // Integrações
  integrations: {
    // Qdrant para memória vetorial
    qdrant: {
      url: process.env.QDRANT_URL || "http://localhost:6333",
      collections: {
        personality: "fazai_personality",
        memory: "fazai_memory",
        learning: "fazai_learning",
        kb: "fazai_kb",
        inference: "fazai_inference",
        semantic_cache: "fazai_semantic_cache",
        source: "fazai_source",
      },
    },

    // ONNX embeddings locais via qdrant-universal-injection
    embeddings: {
      provider: "onnx",
      model: "BGE-base-en-v1.5",
      dimension: 768,
      source: "qdrant-universal-injection",
      isLocal: true,
    },
  },
};
