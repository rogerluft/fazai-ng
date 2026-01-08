/**
 * FazAI Planner - O Maestro da Execução (V2)
 * 
 * Responsabilidade: Decomposição de tarefas com verificação prévia de dependências.
 * Modelo: Local Inference (Llama) definido em fazai.conf
 */

const localModel = env.vars.model_local || "ollama:llama3";

script({
    title: "FazAI Maestro Planner",
    description: "Planejador estratégico com verificação de dependências e redundância",
    model: localModel,
    temperature: 0.1, // Precisão máxima
});

const userTask = env.vars.task;
const systemContext = env.vars.system_info;

if (!userTask) throw new Error("Task required");

$`
You are the SYSTEM MAESTRO for FazAI.
Your goal is to create a robust execution plan for a Linux system.

INPUT CONTEXT:
${systemContext}

USER ORDER: "${userTask}"

THINKING PROCESS (Internal Monologue):
1.  **Analyze Intent:** What is the core goal?
2.  **Check Context:** Does the user already have the tools? (e.g., if 'python3' is in context, use it for HTTP server instead of installing Apache).
3.  **Dependency Tree:** What must happen first? (e.g., install -> configure -> start).
4.  **Redundancy:** If the primary plan fails, what is the alternative?

OUTPUT FORMAT (JSON ONLY):
{
  "plan_id": "slug_unique",
  "intent": "summary in portuguese",
  "dependency_check": {
    "satisfied": ["tool_already_installed"],
    "missing": ["tool_to_install"]
  },
  "primary_plan": [
    {
      "step": 1,
      "action": "install/config/exec",
      "description": "technical instruction in portuguese",
      "tool": "apt/systemctl/bash",
      "validation": "command to verify success",
      "criticality": "high/medium/low"
    }
  ],
  "fallback_plan": [
    {
      "step": 1,
      "description": "alternative approach (e.g. use python instead of apache)"
    }
  ]
}
`
