/**
 * Integration Examples - RAG Neural Flow Usage
 *
 * Exemplos de como integrar o sistema RAG neural nos comandos do FazAI.
 *
 * Este arquivo demonstra padrões de integração para:
 * - linux-admin.ts: Comandos Linux com contexto técnico
 * - askAI.ts: Perguntas gerais com memória e aprendizado
 * - research.ts: Pesquisas profundas com base de conhecimento
 *
 * @module rag/integration-examples
 */

import { neuralQuery, createCollectionSubset } from "./neural-flow";
import { captureLearning, incrementLearningApplication } from "./auto-learning";
import { logQuerySuccess, logQueryFailure } from "./interaction-logger";
import { createEmbeddingService } from "../services/embeddings";

/**
 * Exemplo 1: Integração em linux-admin.ts
 *
 * Busca contexto técnico antes de executar comando Linux.
 * Usa collections: KB (conhecimento técnico) + Learning (erros/soluções anteriores)
 */
export async function linuxAdminWithRAG(userCommand: string): Promise<string> {
  const startTime = Date.now();

  try {
    // 1. Gera embedding da query
    const embeddingService = await createEmbeddingService();
    const embedding = await embeddingService.generate(userCommand);

    // 2. Busca contexto relevante (apenas KB e Learning)
    const context = await neuralQuery(userCommand, embedding, {
      collections: createCollectionSubset("kb", "learning"),
      topK: 3,
      minScore: 0.5, // Score alto para garantir relevância
      weights: {
        kb: 0.6, // Prioriza KB (documentação)
        learning: 0.4, // Padrões aprendidos
        personality: 0,
        memory: 0,
        inference: 0,
      },
    });

    // 3. Monta contexto para o LLM
    let contextText = "";
    if (context.fusedResults.length > 0) {
      contextText = "\n--- Contexto Técnico Relevante ---\n";
      for (const result of context.fusedResults) {
        contextText += `[${result.collection}] ${result.content}\n\n`;
      }
    }

    // 4. Log da interação
    await logQuerySuccess(
      "admin",
      userCommand,
      context.results.map((r) => r.collection),
      context.fusedResults.length,
      context.stats.averageScore,
      Date.now() - startTime
    );

    // 5. Retorna contexto para usar no prompt do LLM
    return contextText;
  } catch (error: any) {
    await logQueryFailure("admin", userCommand, [], 0, 0, Date.now() - startTime, error.message);
    return ""; // Continua sem contexto em caso de erro
  }
}

/**
 * Exemplo 2: Integração em askAI.ts
 *
 * Busca em todas as collections para responder perguntas gerais.
 * Inclui memória de conversas anteriores e personality.
 */
export async function askAIWithRAG(userQuestion: string, conversationId?: string): Promise<string> {
  const startTime = Date.now();

  try {
    const embeddingService = await createEmbeddingService();
    const embedding = await embeddingService.generate(userQuestion);

    // Busca em todas as collections (pesos padrão)
    const context = await neuralQuery(userQuestion, embedding, {
      topK: 5,
      minScore: 0.3, // Score mais permissivo para perguntas gerais
    });

    // Filtra por conversation_id se fornecido
    let relevantMemories = context.fusedResults;
    if (conversationId) {
      relevantMemories = context.fusedResults.filter(
        (r) => r.collection === "fazai_memory" && r.metadata.conversation_id === conversationId
      );
    }

    // Monta contexto enriquecido
    let contextText = "";

    // Personality traits
    const personality = context.fusedResults.filter((r) => r.collection === "fazai_personality");
    if (personality.length > 0) {
      contextText += "\n--- Personalidade ---\n";
      for (const p of personality.slice(0, 2)) {
        contextText += `${p.content}\n`;
      }
    }

    // Memória relevante
    if (relevantMemories.length > 0) {
      contextText += "\n--- Memória da Conversa ---\n";
      for (const m of relevantMemories.slice(0, 3)) {
        contextText += `${m.content}\n`;
      }
    }

    // Conhecimento técnico
    const kb = context.fusedResults.filter((r) => r.collection === "fazai_kb");
    if (kb.length > 0) {
      contextText += "\n--- Base de Conhecimento ---\n";
      for (const k of kb.slice(0, 2)) {
        contextText += `${k.content}\n`;
      }
    }

    await logQuerySuccess(
      "ask",
      userQuestion,
      context.results.map((r) => r.collection),
      context.fusedResults.length,
      context.stats.averageScore,
      Date.now() - startTime
    );

    return contextText;
  } catch (error: any) {
    await logQueryFailure("ask", userQuestion, [], 0, 0, Date.now() - startTime, error.message);
    return "";
  }
}

/**
 * Exemplo 3: Integração em research.ts
 *
 * Busca profunda na base de conhecimento + web search.
 */
export async function researchWithRAG(researchQuery: string): Promise<string> {
  const startTime = Date.now();

  try {
    const embeddingService = await createEmbeddingService();
    const embedding = await embeddingService.generate(researchQuery);

    // Busca focada em KB e Learning com score alto
    const context = await neuralQuery(researchQuery, embedding, {
      collections: createCollectionSubset("kb", "learning", "inference"),
      topK: 10, // Mais resultados para research
      minScore: 0.4,
      weights: {
        kb: 0.5, // Base de conhecimento
        learning: 0.3, // Padrões validados
        inference: 0.2, // Regras operacionais
        personality: 0,
        memory: 0,
      },
    });

    // Monta contexto estruturado por categoria
    const byCategory: Record<string, typeof context.fusedResults> = {};
    for (const result of context.fusedResults) {
      const category = result.metadata.category || "general";
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(result);
    }

    let contextText = "\n--- Contexto de Pesquisa ---\n";
    for (const [category, results] of Object.entries(byCategory)) {
      contextText += `\n[${category.toUpperCase()}]\n`;
      for (const r of results) {
        contextText += `- ${r.content.substring(0, 200)}...\n`;
      }
    }

    await logQuerySuccess(
      "research",
      researchQuery,
      context.results.map((r) => r.collection),
      context.fusedResults.length,
      context.stats.averageScore,
      Date.now() - startTime
    );

    return contextText;
  } catch (error: any) {
    await logQueryFailure("research", researchQuery, [], 0, 0, Date.now() - startTime, error.message);
    return "";
  }
}

/**
 * Exemplo 4: Captura de aprendizado após execução de comando
 *
 * Chamado quando um comando Linux é executado com sucesso/falha.
 */
export async function captureCommandExecution(
  command: string,
  context: string,
  success: boolean,
  output: string,
  category: string = "linux"
): Promise<void> {
  try {
    const outcome = success ? "sucesso" : "falha";
    const type = success ? "acerto" : "erro";

    await captureLearning({
      type,
      title: `Comando: ${command.substring(0, 100)}`,
      description: output.substring(0, 1000),
      context,
      actionTaken: command,
      outcome,
      category,
      tags: extractTags(command),
    });
  } catch (error: any) {
    // Não quebra execução se falhar captura
    console.error(`Failed to capture learning: ${error.message}`);
  }
}

/**
 * Exemplo 5: Incrementa learning quando reutilizado
 *
 * Chamado quando uma solução aprendida anteriormente é aplicada novamente.
 */
export async function trackLearningReuse(
  learningId: string,
  wasSuccessful: boolean
): Promise<void> {
  try {
    await incrementLearningApplication(learningId, wasSuccessful);
  } catch (error: any) {
    console.error(`Failed to track learning reuse: ${error.message}`);
  }
}

/**
 * Helper: Extrai tags de um comando
 */
function extractTags(command: string): string[] {
  const tags: string[] = [];

  // Comandos comuns
  const commonCommands = ["nginx", "systemctl", "docker", "apt", "yum", "firewall", "iptables"];
  for (const cmd of commonCommands) {
    if (command.includes(cmd)) {
      tags.push(cmd);
    }
  }

  // Ações
  if (command.includes("restart")) tags.push("restart");
  if (command.includes("start")) tags.push("start");
  if (command.includes("stop")) tags.push("stop");
  if (command.includes("install")) tags.push("install");
  if (command.includes("remove") || command.includes("uninstall")) tags.push("remove");
  if (command.includes("config") || command.includes("conf")) tags.push("config");

  return tags;
}

/**
 * Exemplo 6: Uso completo no fluxo de comando Linux
 */
export async function completeLinuxWorkflow(userInput: string): Promise<{
  context: string;
  learningId?: string;
}> {
  // 1. Busca contexto relevante
  const context = await linuxAdminWithRAG(userInput);

  // 2. [LLM gera comando aqui - não implementado neste exemplo]
  const generatedCommand = "systemctl restart nginx";

  // 3. [Usuário confirma e executa - não implementado]
  const executionSuccess = true;
  const commandOutput = "nginx restarted successfully";

  // 4. Captura aprendizado
  const learningId = await captureLearning({
    type: executionSuccess ? "acerto" : "erro",
    title: `Comando executado: ${generatedCommand}`,
    description: `Usuário pediu: "${userInput}"\nComando gerado: ${generatedCommand}\nResultado: ${commandOutput}`,
    context: context || "Sem contexto RAG disponível",
    actionTaken: generatedCommand,
    outcome: executionSuccess ? "sucesso" : "falha",
    category: "linux",
    tags: extractTags(generatedCommand),
  });

  return {
    context,
    learningId,
  };
}
