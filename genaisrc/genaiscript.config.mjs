/**
 * GenAIScript Configuration for FazAI
 * Configura modelos, providers e defaults
 */

export default {
  // Modelo padrão - usar cloud para velocidade
  model: "anthropic:claude-3-5-sonnet-latest",

  // Aliases para modelos
  modelAliases: {
    // Modelos locais via Ollama
    "local": "ollama:phi3",
    "local-large": "ollama:llama3.2",
    "local-embed": "ollama:nomic-embed-text",

    // Modelos cloud rápidos
    "fast": "anthropic:claude-3-5-sonnet-latest",
    "smart": "anthropic:claude-3-5-sonnet-latest",
    "small": "anthropic:claude-3-haiku-20240307",

    // Modelos de fallback
    "fallback": "openai:gpt-4o-mini",
  },

  // Configuração de providers
  providers: {
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://192.168.0.101:11434",
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

    // Ollama para embeddings locais
    embeddings: {
      provider: "ollama",
      model: "nomic-embed-text",
      dimension: 1536, // Padronizado via zero-padding
    },
  },
};
