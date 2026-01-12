/**
 * FazAI Reasoning Engine (Reflect & Plan)
 *
 * Modes:
 * - mode="reflect": Retrospective analysis of learnings (Default)
 * - mode="plan": Proactive task planning with dependencies (Maestro)
 */

const mode = env.vars.mode || "reflect";
// Reflect: usa Sonnet 4.5 (balanced). Plan: usa modelo local (economia)
const model = mode === "plan" ? (env.vars.model_local || "ollama:llama3") : "anthropic:claude-sonnet-4-5-20250929";

script({
  title: `FazAI Reasoning (${mode})`,
  description: mode === "plan" ? "Maestro Task Planner" : "Autonomous Reflection",
  model: model,
  temperature: mode === "plan" ? 0.1 : 0.5,
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

if (mode === "reflect") {
$`
Execute uma reflexão autônoma:

1. Liste os aprendizados recentes (últimos 10)
2. Identifique padrões nos aprendizados
3. Gere um insight acionável
4. Sugira uma melhoria concreta para o sistema

Seja objetivo e focado em ações práticas.
`;
} else {

// === MAESTRO PLANNER LOGIC ===
const userTask = env.vars.task;
const systemContext = env.vars.system_info || "Linux Generic";

if (!userTask) throw new Error("Task required for plan mode");

$`
You are the SYSTEM MAESTRO for FazAI.
Your goal is to create a robust execution plan for a Linux system.

INPUT CONTEXT:
${systemContext}

USER ORDER: "${userTask}"

THINKING PROCESS (Internal Monologue):
1.  **Analyze Intent:** What is the core goal?
2.  **Check Context:** Does the user already have the tools?
3.  **Dependency Tree:** What must happen first?
4.  **Redundancy:** If the primary plan fails, what is the alternative?

OUTPUT FORMAT (JSON ONLY):
{
  "plan_id": "slug_unique",
  "intent": "summary in portuguese",
  "primary_plan": [
    {
      "step": 1,
      "action": "install/config/exec",
      "description": "technical instruction in portuguese",
      "tool": "apt/systemctl/bash",
      "validation": "command to verify success"
    }
  ]
}
`;
}
