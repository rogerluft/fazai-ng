/**
 * FazAI Reflect - Script de Reflexão Autônoma
 * Analisa ações recentes e gera insights
 */

script({
  title: "FazAI Reflect",
  description: "Reflexão autônoma sobre ações e aprendizados recentes",
  model: "anthropic:claude-3-5-sonnet-latest",
  temperature: 0.5,
  maxTokens: 2048,
});

// Tool: Lista aprendizados recentes
defTool(
  "list_recent_learnings",
  "Lista os aprendizados mais recentes do FazAI",
  {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Número de aprendizados a listar",
        default: 10,
      },
    },
  },
  async ({ limit = 10 }) => {
    const { qdrantScroll, COLLECTIONS } = await import("./tools/qdrant-tools.mjs");
    const learnings = await qdrantScroll(COLLECTIONS.learning, limit);
    return JSON.stringify(learnings, null, 2);
  }
);

// Tool: Identifica padrões
defTool(
  "identify_patterns",
  "Identifica padrões nos aprendizados",
  {
    type: "object",
    properties: {
      learnings: {
        type: "string",
        description: "JSON com lista de aprendizados",
      },
    },
    required: ["learnings"],
  },
  async ({ learnings }) => {
    const data = JSON.parse(learnings);

    // Agrupa por categoria
    const byCategory = {};
    for (const l of data) {
      const cat = l.payload?.category || "unknown";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    return JSON.stringify({
      total: data.length,
      by_category: byCategory,
      recent_topics: data.slice(0, 5).map(l => l.payload?.content?.substring(0, 100)),
    }, null, 2);
  }
);

// Tool: Gera insights
defTool(
  "generate_insight",
  "Gera um insight a partir de padrões identificados",
  {
    type: "object",
    properties: {
      patterns: {
        type: "string",
        description: "JSON com padrões identificados",
      },
    },
    required: ["patterns"],
  },
  async ({ patterns }) => {
    const insight = await runPrompt(
      `Analise estes padrões de aprendizado e gere um insight acionável:

${patterns}

Responda com um insight conciso (máx 2 frases) que ajude a melhorar o sistema.`,
      { model: "small" }
    );

    return insight.text;
  }
);

$`
Execute uma reflexão autônoma:

1. Liste os aprendizados recentes (últimos 10)
2. Identifique padrões nos aprendizados
3. Gere um insight acionável
4. Sugira uma melhoria concreta para o sistema

Seja objetivo e focado em ações práticas.
`;
