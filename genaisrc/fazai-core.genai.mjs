/**
 * FazAI Core - Loop Agêntico Principal COMPLETO
 * Coração agêntico com reflexão, multi-collection search e auto-evolução
 *
 * LOOP: query → multi_search → reflect → generate insight → upsert → repeat (max 5x)
 */

// Configuração: Ollama local prioritário, cloud como fallback
script({
  title: "FazAI Agentic Core",
  description: "Loop agêntico com reflexão, memória Qdrant multi-collection e auto-evolução",
  model: "ollama:phi3", // Local prioritário para DL380
  // model: "anthropic:claude-3-5-sonnet-latest", // Fallback cloud
  temperature: 0.7,
  maxTokens: 4096,
});

// === ESTADO DO LOOP ===
let loopState = {
  iteration: 0,
  maxIterations: 5,
  insights: [],
  reflections: [],
  contextGathered: [],
};

// === DEFINIÇÃO DE FERRAMENTAS ===

// Tool: Busca multi-collection com fusion scoring
defTool(
  "qdrant_multi_search",
  "Busca em múltiplas collections do Qdrant com fusion scoring (memory, learning, kb, inference)",
  {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Termo ou conceito para buscar",
      },
      collections: {
        type: "array",
        items: { type: "string" },
        description: "Collections para buscar (default: memory, learning, kb)",
        default: ["memory", "learning", "kb"],
      },
      limit: {
        type: "number",
        description: "Limite de resultados por collection",
        default: 3,
      },
    },
    required: ["query"],
  },
  async ({ query, collections = ["memory", "learning", "kb"], limit = 3 }) => {
    try {
      // Importa serviço de embeddings do FazAI
      const { createEmbeddingService } = await import("../dist/services/embeddings.js");
      const embeddingService = createEmbeddingService();
      await embeddingService.init();

      const embedding = await embeddingService.embed(query);

      // Importa tools do Qdrant
      const { qdrantFusionSearch } = await import("./tools/qdrant-tools.mjs");

      // Pesos por collection (Neural Flow style)
      const weights = {
        memory: 0.20,
        learning: 0.40,
        kb: 0.30,
        inference: 0.10,
      };

      const results = await qdrantFusionSearch(embedding, weights);

      // Adiciona ao contexto
      loopState.contextGathered.push(...results.slice(0, 5));

      return JSON.stringify({
        success: true,
        results_count: results.length,
        top_results: results.slice(0, 5).map(r => ({
          source: r.source,
          score: r.fusedScore.toFixed(4),
          content: r.payload?.content?.substring(0, 200) || JSON.stringify(r.payload).substring(0, 200),
        })),
      }, null, 2);
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  }
);

// Tool: Upsert de insight com embedding automático
defTool(
  "qdrant_upsert_insight",
  "Salva um novo insight na collection learning com embedding automático",
  {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "Conteúdo do insight",
      },
      category: {
        type: "string",
        enum: ["error_fix", "pattern", "optimization", "insight", "reflection"],
        description: "Categoria do insight",
      },
      source: {
        type: "string",
        description: "Origem do insight",
        default: "agentic_loop",
      },
    },
    required: ["content", "category"],
  },
  async ({ content, category, source = "agentic_loop" }) => {
    try {
      const { createEmbeddingService } = await import("../dist/services/embeddings.js");
      const { qdrantUpsertInsight } = await import("./tools/qdrant-tools.mjs");

      const embeddingService = createEmbeddingService();
      await embeddingService.init();
      const embedding = await embeddingService.embed(content);

      const result = await qdrantUpsertInsight(content, embedding, category, source);

      loopState.insights.push({ content, category });

      return JSON.stringify({
        success: true,
        category,
        content_preview: content.substring(0, 100),
        iteration: loopState.iteration,
      });
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  }
);

// Tool: Reflexão sobre ações com meta-cognição
defTool(
  "reflect",
  "Reflete sobre ações e contexto para gerar insights",
  {
    type: "object",
    properties: {
      context: {
        type: "string",
        description: "Contexto da reflexão (o que foi feito/encontrado)",
      },
      outcome: {
        type: "string",
        description: "Resultado obtido",
      },
    },
    required: ["context"],
  },
  async ({ context, outcome = "análise em andamento" }) => {
    loopState.iteration++;

    // Meta-cognição: usa o próprio LLM para reflexão profunda
    const reflection = await runPrompt(
      `Você é o sistema de reflexão agêntico do FazAI. Analise:

ITERAÇÃO: ${loopState.iteration}/${loopState.maxIterations}
CONTEXTO: ${context}
RESULTADO: ${outcome}
CONTEXTO ACUMULADO: ${loopState.contextGathered.length} itens
INSIGHTS GERADOS: ${loopState.insights.length}

Responda em JSON:
{
  "was_productive": boolean,
  "key_insight": "insight principal desta iteração",
  "should_continue": boolean,
  "next_action": "próxima ação recomendada",
  "confidence": 0.0-1.0
}`,
      {
        model: "small", // Usa modelo menor para reflexão rápida
        responseType: "json",
      }
    );

    let parsed;
    try {
      parsed = JSON.parse(reflection.text);
    } catch {
      parsed = {
        was_productive: true,
        key_insight: reflection.text,
        should_continue: loopState.iteration < loopState.maxIterations,
        next_action: "continuar análise",
        confidence: 0.5,
      };
    }

    loopState.reflections.push(parsed);

    return JSON.stringify({
      iteration: loopState.iteration,
      ...parsed,
    }, null, 2);
  }
);

// Tool: Verifica se deve continuar o loop
defTool(
  "check_loop_status",
  "Verifica o status do loop agêntico e se deve continuar",
  {
    type: "object",
    properties: {},
  },
  async () => {
    const shouldContinue = loopState.iteration < loopState.maxIterations;
    const hasEnoughContext = loopState.contextGathered.length >= 3;
    const hasInsights = loopState.insights.length > 0;

    return JSON.stringify({
      iteration: loopState.iteration,
      max_iterations: loopState.maxIterations,
      should_continue: shouldContinue && !hasEnoughContext,
      context_count: loopState.contextGathered.length,
      insights_count: loopState.insights.length,
      reflections_count: loopState.reflections.length,
      recommendation: hasEnoughContext
        ? "Contexto suficiente - pode responder"
        : shouldContinue
          ? "Continue buscando mais contexto"
          : "Limite de iterações atingido - responda com o que tem",
    }, null, 2);
  }
);

// === PLACEHOLDER: SKILL SEEKERS ===
// TODO: Skill_Seekers integration - auto-geração de skills
defTool(
  "skill_seeker_scrape",
  "Auto-generates skills from external sources when knowledge gap detected. PLACEHOLDER - a ser implementado.",
  {
    type: "object",
    properties: {
      gap_description: {
        type: "string",
        description: "Descrição do gap de conhecimento detectado",
      },
      source_type: {
        type: "string",
        enum: ["url", "github_repo", "pdf", "local_docs"],
        description: "Tipo de fonte para scrape",
      },
      source_path: {
        type: "string",
        description: "Caminho ou URL da fonte",
      },
    },
    required: ["gap_description"],
  },
  async ({ gap_description, source_type = "url", source_path }) => {
    // PLACEHOLDER: Implementação futura
    // 1. Detect gap de conhecimento
    // 2. Scrape doc/repo/PDF
    // 3. Extract conhecimento
    // 4. Generate skill definition
    // 5. Embed + upsert to fazai_kb

    return JSON.stringify({
      status: "placeholder",
      message: "Skill Seeker ainda não implementado",
      gap_detected: gap_description,
      suggested_sources: [
        "https://docs.example.com",
        "github.com/relevant/repo",
      ],
      next_steps: [
        "1. Implementar web scraper",
        "2. Implementar PDF parser",
        "3. Implementar skill generator",
        "4. Integrar com Qdrant",
      ],
    });
  }
);

// === AGENTE PRINCIPAL ===

defAgent(
  "fazai_core",
  "Agente principal do FazAI com loop agêntico completo",
  `Você é o CORAÇÃO AGÊNTICO do FazAI, um assistente Linux inteligente com capacidade de reflexão e auto-evolução.

SUAS FERRAMENTAS:
1. qdrant_multi_search - Busca em múltiplas collections com fusion scoring
2. qdrant_upsert_insight - Salva insights para aprendizado futuro
3. reflect - Reflete sobre ações para meta-cognição
4. check_loop_status - Verifica estado do loop
5. skill_seeker_scrape - (PLACEHOLDER) Auto-gera skills de fontes externas

LOOP AGÊNTICO (máx 5 iterações):
1. BUSCAR: Use qdrant_multi_search para encontrar contexto relevante
2. REFLETIR: Use reflect para analisar o que encontrou
3. GERAR: Se encontrou algo útil, use qdrant_upsert_insight para salvar
4. VERIFICAR: Use check_loop_status para decidir se continua
5. RESPONDER: Quando tiver contexto suficiente, responda ao usuário

DIRETRIZES:
- SEMPRE busque contexto antes de responder
- SEMPRE reflita após cada busca significativa
- Salve insights úteis para consultas futuras
- Seja proativo em identificar padrões
- Se detectar gap de conhecimento, mencione o skill_seeker_scrape`,
  {
    tools: [
      "qdrant_multi_search",
      "qdrant_upsert_insight",
      "reflect",
      "check_loop_status",
      "skill_seeker_scrape",
    ],
  }
);

// === PROMPT PRINCIPAL ===

// Variável de entrada (passada via CLI)
const userQuery = env.vars.query || "O que você pode fazer?";

$`
Você é o agente FazAI Core executando o loop agêntico completo.

QUERY DO USUÁRIO: ${userQuery}

EXECUTE O LOOP AGÊNTICO:

PASSO 1 - BUSCAR CONTEXTO:
Use qdrant_multi_search para buscar informações relevantes sobre a query.

PASSO 2 - REFLETIR:
Use reflect para analisar o que encontrou e gerar insights.

PASSO 3 - VERIFICAR:
Use check_loop_status para ver se deve continuar o loop.

PASSO 4 - ITERAR OU RESPONDER:
- Se should_continue=true e contexto insuficiente, volte ao PASSO 1
- Se contexto suficiente ou limite atingido, vá para PASSO 5

PASSO 5 - RESPONDER:
Forneça uma resposta completa e útil baseada no contexto acumulado.
Se gerou insights úteis, use qdrant_upsert_insight para salvá-los.

IMPORTANTE:
- Máximo de 5 iterações do loop
- Sempre busque antes de responder
- Salve insights que podem ser úteis no futuro
- Se detectar gap de conhecimento, mencione skill_seeker_scrape
`;
