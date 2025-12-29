script({
    title: "FazAI QA Reporter",
    description: "Analisa logs de testes reais e gera relatório de erros",
    model: "llama:llama3", // Análise local custo zero
    temperature: 0.1
});

const logFile = "tests/real-world-output.log";
let logContent = "";

try {
    const fs = await import("fs");
    logContent = fs.readFileSync(logFile, "utf8");
} catch (e) {
    throw new Error(`Arquivo de log não encontrado: ${logFile}. Rode ./tests/real-world-suite.sh primeiro.`);
}

$`
Você é um Engenheiro de QA (Quality Assurance) analisando os logs de execução do FazAI.

LOGS DE EXECUÇÃO:
${logContent}

SUA TAREFA:
Analise o log acima e gere um RELATÓRIO DE ERROS conciso em formato Markdown.

DIRETRIZES:
1. Ignore "SUCCESS" ou "Timeout Expected". Foque apenas onde diz "RESULT: ERROR" ou onde o output indica falha (ex: "command not found", "permission denied").
2. Para cada erro, tente identificar a causa raiz (ex: falta de sudo, modelo de IA alucinando, comando inválido).
3. Se o modo --cli falhou, verifique se os comandos injetados (/help, /ask) foram processados.

FORMATO DO RELATÓRIO:
# Relatório de Testes Reais FazAI

## Resumo
- Total de Testes: [N]
- Sucessos: [N]
- Falhas: [N]

## Falhas Identificadas
1. **[Nome do Teste]**
   - **Erro:** [Mensagem de erro]
   - **Causa Provável:** [Sua análise]
   - **Sugestão:** [Como corrigir]

## Observações Gerais
[Comentários sobre a performance ou comportamento geral]
`
