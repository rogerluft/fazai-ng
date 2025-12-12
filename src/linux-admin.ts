import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { linuxAdminPrompt } from "./linux-prompt";
import { LinuxCommandGenerator, LinuxCommand } from "./types-linux";
import { logger } from "./logger";
import { withRetry } from "./utils/retry";
import { API_TIMEOUTS } from "./config/timeouts";
import chalk from "chalk";
import { neuralQuery } from "./rag/neural-flow";
import { captureLearning } from "./rag/auto-learning";
import { createEmbeddingService } from "./services/embeddings";
import { logQuerySuccess, logQueryFailure } from "./rag/interaction-logger";

type Provider = "anthropic" | "openai" | "openrouter" | "ollama" | "google";

// Fallback chains for each provider
const FALLBACK_CHAINS: Record<Provider, Provider[]> = {
  ollama: ["openrouter", "anthropic", "openai", "google"],
  openrouter: ["ollama", "anthropic", "openai", "google"],
  anthropic: ["openrouter", "ollama", "openai", "google"],
  openai: ["anthropic", "openrouter", "ollama", "google"],
  google: ["openrouter", "ollama", "anthropic", "openai"],
};

// Check if a provider is configured
function isProviderAvailable(provider: Provider): boolean {
  switch (provider) {
    case "ollama":
      return true; // Always try Ollama
    case "openrouter":
      return !!process.env.OPENROUTER_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "google":
      return !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    default:
      return false;
  }
}

// Get default model for a provider (reads from config if available)
function getDefaultModel(provider: Provider): string {
  // Import config reader
  const { getConfigValue } = require("./config");

  // Try to get from config first (same as models.ts)
  const configKeys: Record<Provider, string> = {
    ollama: "MODELS_OLLAMA",
    openrouter: "MODELS_OPENROUTER",
    anthropic: "MODELS_ANTHROPIC",
    openai: "MODELS_OPENAI",
    google: "MODELS_GOOGLE",
  };

  const modelStr = getConfigValue(configKeys[provider]);
  if (modelStr && modelStr.trim()) {
    const firstModel = modelStr.split(",")[0].trim();
    if (firstModel) {
      return firstModel;
    }
  }

  // Fallback defaults
  switch (provider) {
    case "ollama":
      return "llama3.2:latest";
    case "openrouter":
      return "qwen/qwen3-coder:free";
    case "anthropic":
      return "claude-3-5-sonnet-latest";
    case "openai":
      return "gpt-4o-mini";
    case "google":
      return "gemini-1.5-flash";
    default:
      return "";
  }
}


// Check if error is recoverable (should try fallback)
function isRecoverableError(error: any): boolean {
  const message = error?.message?.toLowerCase() || "";
  const status = error?.status;

  // Memory errors from Ollama
  if (message.includes("memory") || message.includes("alloc")) return true;

  // Rate limits
  if (status === 429 || error?.code === 429) return true;

  // Timeout
  if (message.includes("timeout")) return true;

  // Connection errors
  if (message.includes("econnrefused") || message.includes("enotfound")) return true;

  // Model not found
  if (message.includes("not found") || status === 404) return true;

  return false;
}

/**
 * Captura padrão de sucesso para aprendizado futuro
 *
 * Deve ser chamado após comandos executados com sucesso
 * @param task Tarefa original
 * @param commands Comandos que foram bem-sucedidos
 * @param systemInfo Informações do sistema
 */
export async function captureLearningFromCommands(
  task: string,
  commands: LinuxCommand[],
  systemInfo: string
): Promise<void> {
  try {
    logger.debug("📚 Capturando aprendizado de comandos bem-sucedidos...");

    // Extrai categoria da tarefa (nginx, docker, network, etc.)
    const category = extractCategory(task);

    // Monta descrição do aprendizado
    const commandList = commands.map(c => c.command).join("; ");
    const description = `Comandos executados para: ${task}\n${commandList}`;

    // Gera embedding
    const embeddingService = await createEmbeddingService();
    const textToEmbed = `${task}\n${description}\n${systemInfo}`;
    const embedding = await embeddingService.generate(textToEmbed);

    // Captura no sistema de learning
    const learningId = await captureLearning(
      {
        type: "acerto",
        title: `Linux: ${task.substring(0, 80)}`,
        description,
        context: `Sistema: ${systemInfo.substring(0, 200)}`,
        actionTaken: commandList,
        outcome: "sucesso",
        category,
        tags: extractTags(task, commands),
        initialConfidence: 0.85, // Alta confiança para comandos validados
      },
      embedding
    );

    // Armazena também os comandos no metadata para recuperação futura
    const { getQdrantClient } = await import("./database/qdrant-pool");
    const client = await getQdrantClient();

    await client.setPayload("fazai_learning", {
      points: [learningId],
      payload: {
        commands: commands.map(c => ({
          explain: c.explain,
          command: c.command,
          riskLevel: c.riskLevel,
          requiresConfirmation: c.requiresConfirmation,
        })),
      },
    });

    logger.info(chalk.green(`✅ Aprendizado capturado: ${learningId}`));
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.debug(`Erro ao capturar learning: ${err.message}`);
    // Falha graceful - não deve interromper o fluxo
  }
}

/**
 * Extrai categoria da tarefa
 */
function extractCategory(task: string): string {
  const lower = task.toLowerCase();

  if (lower.includes("nginx") || lower.includes("apache")) return "webserver";
  if (lower.includes("docker") || lower.includes("container")) return "docker";
  if (lower.includes("firewall") || lower.includes("ufw") || lower.includes("iptables")) return "security";
  if (lower.includes("network") || lower.includes("ip") || lower.includes("route")) return "network";
  if (lower.includes("disk") || lower.includes("mount") || lower.includes("filesystem")) return "storage";
  if (lower.includes("user") || lower.includes("permission") || lower.includes("chmod")) return "permissions";
  if (lower.includes("service") || lower.includes("systemctl")) return "services";
  if (lower.includes("backup") || lower.includes("restore")) return "backup";

  return "general";
}

/**
 * Extrai tags relevantes da tarefa e comandos
 */
function extractTags(task: string, commands: LinuxCommand[]): string[] {
  const tags = new Set<string>();

  // Tags da tarefa
  const taskWords = task.toLowerCase().split(/\s+/);
  for (const word of taskWords) {
    if (word.length > 3 && !["como", "fazer", "configurar", "instalar"].includes(word)) {
      tags.add(word);
    }
  }

  // Tags dos comandos
  for (const cmd of commands) {
    const cmdWords = cmd.command.toLowerCase().split(/\s+/);
    if (cmdWords[0]) tags.add(cmdWords[0]); // Primeiro comando (apt, systemctl, etc.)
  }

  return Array.from(tags).slice(0, 10); // Limita a 10 tags
}

/**
 * Enriquece o prompt da IA com contexto RAG de KB e Learning
 *
 * Não retorna comandos prontos, apenas contexto textual para a IA considerar.
 *
 * @param task - Tarefa do usuário
 * @param systemInfo - Informações do sistema
 * @returns Contexto RAG formatado ou string vazia em caso de falha
 */
async function enrichContextWithRAG(
  task: string,
  systemInfo: string
): Promise<string> {
  const startTime = Date.now();

  try {
    logger.debug("🧠 Buscando contexto RAG para enriquecer prompt...");

    // 1. Gera embedding (trunca systemInfo para economizar tokens)
    const embeddingService = await createEmbeddingService();
    const queryText = `${task}\n${systemInfo.substring(0, 500)}`;
    const embedding = await embeddingService.generate(queryText);

    // 2. Busca neural (KB + Learning)
    const result = await neuralQuery(queryText, embedding, {
      topK: 5,
      minScore: 0.5,
      collections: ["fazai_kb", "fazai_learning"],
      weights: {
        kb: 0.6,
        learning: 0.4,
        personality: 0,
        memory: 0,
        inference: 0,
      },
    });

    // 3. Log da interação
    await logQuerySuccess(
      "admin",
      task,
      result.results.map((r) => r.collection),
      result.fusedResults.length,
      result.stats.averageScore,
      result.totalTime
    );

    const elapsed = Date.now() - startTime;
    logger.debug(`⏱️ RAG context enrichment completed in ${elapsed}ms`);

    // 4. Se não encontrou resultados, retorna vazio
    if (result.fusedResults.length === 0) {
      logger.debug("Nenhum contexto RAG relevante encontrado");
      return "";
    }

    // 5. Formata contexto para adicionar ao prompt (limita para economizar tokens)
    let contextText = "\n--- CONTEXTO TÉCNICO RELEVANTE (RAG) ---\n";

    // Agrupa por collection
    const kbResults = result.fusedResults.filter(r => r.collection === "fazai_kb");
    const learningResults = result.fusedResults.filter(r => r.collection === "fazai_learning");

    if (kbResults.length > 0) {
      contextText += "\n📚 Base de Conhecimento:\n";
      for (const r of kbResults.slice(0, 3)) { // Máximo 3 resultados
        contextText += `  • [Score: ${r.score.toFixed(2)}] ${r.content.substring(0, 200)}...\n`;
      }
    }

    if (learningResults.length > 0) {
      contextText += "\n🎓 Padrões Aprendidos:\n";
      for (const r of learningResults.slice(0, 2)) { // Máximo 2 resultados
        contextText += `  • [Score: ${r.score.toFixed(2)}] ${r.content.substring(0, 200)}...\n`;
      }
    }

    contextText += "--- FIM DO CONTEXTO RAG ---\n";

    logger.info(chalk.cyan(
      `✨ Contexto RAG enriquecido: ${result.fusedResults.length} resultados ` +
      `(avg score: ${result.stats.averageScore.toFixed(3)})`
    ));

    return contextText;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const elapsed = Date.now() - startTime;

    logger.debug(`Erro ao enriquecer contexto RAG: ${err.message}`);

    await logQueryFailure(
      "admin",
      task,
      ["fazai_kb", "fazai_learning"],
      0,
      0,
      elapsed,
      err.message
    );

    return ""; // Falha graceful - continua sem contexto
  }
}

/**
 * Consulta neural flow para padrões aprendidos similares
 * @returns Comandos aprendidos se encontrados, null caso contrário
 */
async function consultNeuralFlow(
  task: string,
  systemInfo: string
): Promise<LinuxCommand[] | null> {
  const startTime = Date.now();

  try {
    logger.debug("🧠 Consultando neural flow para padrões aprendidos...");

    // Gera embedding da task (trunca systemInfo para economizar tokens)
    const embeddingService = await createEmbeddingService();
    const queryText = `${task}\n${systemInfo.substring(0, 500)}`;
    const embedding = await embeddingService.generate(queryText);

    // Busca neural em collections relevantes (kb e learning têm maior peso)
    const result = await neuralQuery(queryText, embedding, {
      topK: 5,
      minScore: 0.5,
      collections: ["fazai_learning", "fazai_kb"],
      weights: {
        kb: 0.6,
        learning: 0.4,
        personality: 0,
        memory: 0,
        inference: 0,
      },
    });

    // Log da interação
    await logQuerySuccess(
      "admin",
      task,
      result.results.map((r) => r.collection),
      result.fusedResults.length,
      result.stats.averageScore,
      result.totalTime
    );

    const elapsed = Date.now() - startTime;
    logger.debug(`⏱️ Neural flow query completed in ${elapsed}ms`);

    // Se encontrou resultados relevantes
    if (result.fusedResults.length > 0) {
      const topResult = result.fusedResults[0];

      logger.info(chalk.green(
        `✨ Padrão similar encontrado: score=${topResult.score.toFixed(3)} ` +
        `(${topResult.collection})`
      ));

      // Extrai comandos do metadata se disponível
      if (topResult.metadata.commands && Array.isArray(topResult.metadata.commands)) {
        const { LinuxCommandSchema } = await import("./types-linux");
        const validCommands: LinuxCommand[] = [];

        for (const cmd of topResult.metadata.commands) {
          try {
            const validated = LinuxCommandSchema.parse(cmd);
            validCommands.push(validated);
          } catch (e) {
            logger.debug("Comando do learning inválido, ignorando");
          }
        }

        if (validCommands.length > 0) {
          logger.info(chalk.cyan(`📚 Usando ${validCommands.length} comando(s) do aprendizado`));
          return validCommands;
        }
      }
    }

    logger.debug("Nenhum padrão similar encontrado no neural flow");
    return null;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const elapsed = Date.now() - startTime;

    logger.debug(`Erro ao consultar neural flow: ${err.message}`);

    await logQueryFailure(
      "admin",
      task,
      ["fazai_learning", "fazai_kb"],
      0,
      0,
      elapsed,
      err.message
    );

    return null; // Falha graceful - continua com IA normal
  }
}

export async function* getLinuxCommandsFromAI(
  systemInfo: string,
  task: string,
  model: string,
  provider: Provider
): LinuxCommandGenerator {
  let commandsYielded = false;
  const triedProviders: Provider[] = [];

  // 🧠 NEURAL FLOW: Tenta buscar padrão aprendido primeiro
  const learnedCommands = await consultNeuralFlow(task, systemInfo);

  if (learnedCommands && learnedCommands.length > 0) {
    // Usa comandos do learning
    for (const cmd of learnedCommands) {
      yield { type: "command", command: cmd };
    }
    yield { type: "allcommands", commands: learnedCommands };
    return; // Early return - não precisa chamar IA
  }

  // 🧠 RAG ENRICHMENT: Se não encontrou comandos, enriquece prompt com contexto
  const ragContext = await enrichContextWithRAG(task, systemInfo);
  const enhancedSystemInfo = ragContext
    ? `${systemInfo}\n\n${ragContext}`
    : systemInfo;

  // Build provider chain: primary + fallbacks
  const providerChain: { provider: Provider; model: string }[] = [
    { provider, model },
    ...FALLBACK_CHAINS[provider]
      .filter(p => isProviderAvailable(p) && p !== provider)
      .map(p => ({ provider: p, model: getDefaultModel(p) }))
  ];

  for (const { provider: currentProvider, model: currentModel } of providerChain) {
    if (commandsYielded) break;

    triedProviders.push(currentProvider);

    try {
      const generator = getGeneratorForProvider(currentProvider, enhancedSystemInfo, task, currentModel);

      for await (const result of generator) {
        if (result.type === "command" || result.type === "allcommands") {
          commandsYielded = true;
        }
        yield result;
      }

      // If we got here without yielding commands, consider it a failure
      if (!commandsYielded) {
        throw new Error(`Provider ${currentProvider} returned no commands`);
      }

      break; // Success, exit loop

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const isLast = triedProviders.length === providerChain.length;

      if (isRecoverableError(err) && !isLast) {
        const nextProvider = providerChain[triedProviders.length];
        logger.warn(chalk.yellow(
          `\n⚠️  ${currentProvider} falhou: ${err.message.substring(0, 50)}`
        ));
        logger.info(chalk.cyan(
          `🔄 Tentando fallback: ${nextProvider.provider} (${nextProvider.model})`
        ));
        continue;
      }

      // Final error - throw
      const errWithStatus = err as Error & { status?: number; code?: number };
      if (errWithStatus.status === 429 || errWithStatus.code === 429) {
        const suggestion = currentProvider === "openrouter"
          ? "Tente: fazai llama32 ou aguarde alguns minutos"
          : "Aguarde alguns minutos ou use outro modelo";
        logger.error(`\n❌ Rate limit atingido. ${suggestion}`);
      }

      throw error;
    }
  }
}

function getGeneratorForProvider(
  provider: Provider,
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  switch (provider) {
    case "anthropic":
      return getLinuxCommandsFromClaude(systemInfo, task, model);
    case "openai":
      return getLinuxCommandsFromOpenAI(systemInfo, task, model);
    case "openrouter":
      return getLinuxCommandsFromOpenRouter(systemInfo, task, model);
    case "ollama":
      return getLinuxCommandsFromOllama(systemInfo, task, model);
    case "google":
      return getLinuxCommandsFromGemini(systemInfo, task, model);
    default:
      throw new Error(`Provider não suportado: ${provider}`);
  }
}

async function* getLinuxCommandsFromClaude(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const anthropic = new Anthropic({
    timeout: API_TIMEOUTS.anthropic,
  });

  logger.info(`\n\n🖥️  Gerando comandos Linux com Claude (${model})...`);

  const tokens = model.includes("sonnet") ? 8192 : 4096;

  const stream = await withRetry(
    () => anthropic.messages.create({
      messages: [
        {
          role: "user" as const,
          content: linuxAdminPrompt(task),
        },
      ],
      model,
      max_tokens: tokens,
      stream: true,
      temperature: 0,
      system: `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.

IMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido no formato:
{"commands": [array de comandos]}

Cada comando deve ter a estrutura exata definida no prompt do usuário.`,
    }),
    { provider: "anthropic" }
  );

  // Use unified streaming parser
  const { parseStreamingJSON, iterateAnthropicStream } = await import("./streaming-parser");
  yield* parseStreamingJSON(iterateAnthropicStream(stream), "anthropic");
}

async function* getLinuxCommandsFromOpenAI(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const openai = new OpenAI({
    timeout: API_TIMEOUTS.openai,
  });

  logger.info(`\n\n🖥️  Gerando comandos Linux com OpenAI (${model})...`);

  const systemMessage = `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.

IMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido no formato:
{"commands": [array de comandos]}

Cada comando deve ter a estrutura exata definida no prompt do usuário.`;

  const stream = await withRetry(
    () => openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: linuxAdminPrompt(task) }
      ],
      stream: true,
      temperature: 0,
      response_format: { type: "json_object" },
    }),
    { provider: "openai" }
  );

  // Use unified streaming parser
  const { parseStreamingJSON, iterateOpenAIStream } = await import("./streaming-parser");
  yield* parseStreamingJSON(iterateOpenAIStream(stream), "openai");
}

async function* getLinuxCommandsFromOpenRouter(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    timeout: API_TIMEOUTS.openrouter,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/rogerluft/fazai-ng",
      "X-Title": "FazAI Terminal Assistant",
    },
  });

  logger.info(`\n\n🖥️  Gerando comandos Linux com OpenRouter (${model})...`);

  const systemMessage = `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.

IMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido no formato:
{"commands": [array de comandos]}

Cada comando deve ter a estrutura exata definida no prompt do usuário.`;

  const stream = await withRetry(
    () => openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: linuxAdminPrompt(task) }
      ],
      stream: true,
      temperature: 0,
    }),
    { provider: "openrouter" }
  );

  // Use unified streaming parser
  const { parseStreamingJSON, iterateOpenAIStream } = await import("./streaming-parser");
  yield* parseStreamingJSON(iterateOpenAIStream(stream), "openai");
}

async function* getLinuxCommandsFromOllama(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://192.168.0.101:11434";

  logger.debug(`[DEBUG] Ollama baseURL: ${baseUrl}`);
  logger.debug(`[DEBUG] Model: ${model}`);

  logger.info(`\n\n🖥️  Gerando comandos Linux com Ollama (${model}) em ${baseUrl}...`);

  const systemMessage = `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.`;

  const prompt = `${linuxAdminPrompt(task)}

IMPORTANTE: Responda APENAS com um objeto JSON válido no formato:
{"commands": [{"explain": "...", "command": "...", "riskLevel": "low|medium|high|critical", "requiresConfirmation": true|false}]}`;

  // Use native Ollama API with format: "json" for reliable JSON output
  const response = await withRetry(
    async () => {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system: systemMessage,
          prompt,
          format: "json",
          stream: false,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama error ${res.status}: ${text}`);
      }

      return res.json();
    },
    { provider: "ollama" }
  );

  logger.debug(`[DEBUG] Ollama response received`);

  // Parse the response
  try {
    const jsonResponse = typeof response.response === "string"
      ? JSON.parse(response.response)
      : response.response;

    const { LinuxCommandSchema } = await import("./types-linux");

    if (jsonResponse.commands && Array.isArray(jsonResponse.commands)) {
      const validCommands: LinuxCommand[] = [];

      for (const cmd of jsonResponse.commands) {
        try {
          const validated = LinuxCommandSchema.parse(cmd);
          validCommands.push(validated);
          yield { type: "command", command: validated };
        } catch (e) {
          logger.warn(`⚠️  Comando inválido ignorado: ${JSON.stringify(cmd).substring(0, 50)}`);
        }
      }

      logger.info(`✓ Commands: ${validCommands.length} valid`);
      yield { type: "allcommands", commands: validCommands };
    } else {
      throw new Error("Resposta não contém array de comandos");
    }
  } catch (error: any) {
    logger.error(`❌ Erro ao parsear resposta Ollama: ${error.message}`);
    logger.debug(`Response was: ${JSON.stringify(response.response).substring(0, 200)}`);
    throw error;
  }
}


async function* getLinuxCommandsFromGemini(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY ou GEMINI_API_KEY não configurada. Configure no /etc/fazai/fazai.conf");
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    // Google SDK doesn't support timeout config directly, handled by withRetry
  });

  logger.info(`\n\n🖥️  Gerando comandos Linux com Gemini (${model})...`);

  const systemMessage = `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.

IMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido no formato:
{"commands": [array de comandos]}

Cada comando deve ter a estrutura exata definida no prompt do usuário.`;

  const prompt = `${systemMessage}\n\n${linuxAdminPrompt(task)}`;

  const result = await withRetry(
    () => geminiModel.generateContentStream(prompt),
    { provider: "google" }
  );

  // Use unified streaming parser
  const { parseStreamingJSON, iterateGoogleStream } = await import("./streaming-parser");
  yield* parseStreamingJSON(iterateGoogleStream(result.stream), "google");
}
