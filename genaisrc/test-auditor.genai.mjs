script({
    title: "FazAI Agentic Auditor (V2.2)",
    description: "Auditoria profunda de testes reais: Memoria, Cache, Tom de Voz e Dependencias",
    model: "llama:llama3", 
    temperature: 0.1
});

const logFile = env.vars.logfile || "tests/real-world-output.log";
let logContent = "";

try {
    const fs = await import("fs");
    logContent = fs.readFileSync(logFile, "utf8");
} catch (e) {
    throw new Error("Relatorio de testes nao encontrado.");
}

// Tool: Verificar Inodes de Memoria no Qdrant
defTool(
  "verify_agent_memory",
  "Busca no Qdrant por registros de aprendizado ou memoria criados durante o teste",
  { type: "object", properties: {} },
  async () => {
    const { qdrantScroll } = await import("./tools/qdrant-tools.mjs");
    // Buscamos nas collections de Learning e Memory
    const l = await qdrantScroll("fazai_learning", 10);
    const m = await qdrantScroll("fazai_memory", 10);
    return JSON.stringify({ learning: l.length, memory: m.length, last_entries: l.slice(0,3) });
  }
);

// Tool: Analisar uso do Cache
defTool(
  "check_cache_efficiency",
  "Verifica se o cache semantico foi utilizado",
  { type: "object", properties: {} },
  async () => {
    const { qdrantScroll } = await import("./tools/qdrant-tools.mjs");
    const cache = await qdrantScroll("fazai_semantic_cache", 10);
    return JSON.stringify({ cache_entries: cache.length });
  }
);

$`
Voce eh a GeGe (Desenvolvedora Agentica Senior) auditando o FazAI-NG.

CONTEXTO DOS TESTES:
${logContent}

SUA MISSAO:
Gere um laudo tecnico rigoroso validando a inteligencia do sistema.

DIRETRIZES DE AUDITORIA:
1.  Execucao Real: Verifique se os comandos foram executados ou se a IA apenas falou.
2.  Dependencias: O teste do Gnuplot exigia instalacao. Ele foi bem-sucedido?
3.  Memoria (Use Tools!): Use 'verify_agent_memory' para confirmar se o sistema gravou o que aprendeu.
4.  Personalidade: O FazAI respondeu como um "Senior Platform Engineer" (direto, sem avisos chatos)?
5.  Token Economy: Verifique se houve hit de cache em perguntas repetidas usando 'check_cache_efficiency'.

FORMATO DO LAUDO (Markdown):
# Laudo de Auditoria Agentica FazAI V2.2

## Score de Saude
- Sucesso Tecnico: [%]
- Persistencia de Memoria: [OK/FAIL]
- Consistencia de Persona: [Senior/Junior]

## Analise de Dependencias Implicitas
[Comente sobre o teste do Gnuplot e se o FazAI resolveu a dependencia]

## Metacognicao e Aprendizado
- Vetorizacao no Qdrant: [Detalhes das tools]
- Uso de Cache: [Eficiencia]

## Pontos de Falha Identificados
[Lista de erros reais e sugestao de correcao tecnica]

---
*Assinado: GeGe (Gemini 3 Pro) via Skill fazai-agentic-developer*
`
