script({
    title: "FazAI Test Auditor",
    description: "Audita a execução de testes reais verificando logs, Qdrant e Cache",
    model: "llama:llama3", // Modelo local para análise
    temperature: 0.1
});

const logFile = env.vars.logfile || "tests/real-world-output.log";
let logContent = "";

try {
    const fs = await import("fs");
    logContent = fs.readFileSync(logFile, "utf8");
} catch (e) {
    throw new Error(`Log file not found: ${logFile}`);
}

// Tool: Check Qdrant Memory
defTool(
  "check_qdrant_memory",
  "Verifica se interações recentes foram salvas na memória",
  { type: "object", properties: {} },
  async () => {
    const { qdrantScroll } = await import("./tools/qdrant-tools.mjs");
    const memories = await qdrantScroll("fazai_memory", 5);
    return JSON.stringify(memories.map(m => ({ 
        content: m.payload.content, 
        timestamp: m.payload.timestamp 
    })), null, 2);
  }
);

// Tool: Check Semantic Cache
defTool(
  "check_semantic_cache",
  "Verifica hits recentes no cache semântico",
  { type: "object", properties: {} },
  async () => {
    const { qdrantScroll } = await import("./tools/qdrant-tools.mjs");
    const cache = await qdrantScroll("fazai_semantic_cache", 5);
    return JSON.stringify(cache.map(c => ({
        prompt: c.payload.prompt,
        model: c.payload.model
    })), null, 2);
  }
);

$`
Você é o AUDITOR DE QUALIDADE do FazAI.
Sua missão é validar se o sistema se comportou como um Agente Inteligente durante os testes.

LOG DE EXECUÇÃO:
${logContent}

PASSO 1: ANÁLISE DE LOGS
- Identifique quantos testes passaram (SUCESSO) e falharam (ERRO).
- Para cada falha, explique a causa provável baseada na mensagem de erro.

PASSO 2: VERIFICAÇÃO DE MEMÓRIA (Use tools!)
- Use 'check_qdrant_memory' para ver se as perguntas "ask" foram gravadas.
- Use 'check_semantic_cache' para ver se houve cacheamento.

PASSO 3: RELATÓRIO FINAL
Gere um relatório Markdown com:
1. Resumo Executivo (Pass/Fail rate)
2. Análise de Falhas (Causa Raiz)
3. Auditoria Agêntica:
   - Memória: [OK/FAIL] (O sistema lembrou das interações?)
   - Cache: [OK/FAIL] (O sistema cacheou respostas?)
   - Personalidade: [OK/FAIL] (O tom das respostas foi técnico?)

Seja rigoroso. Se o sistema não gravou memória, marque como FAIL.
`
