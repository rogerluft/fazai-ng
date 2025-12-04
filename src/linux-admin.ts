import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { linuxAdminPrompt } from "./linux-prompt";
import { LinuxCommandGenerator, LinuxCommand } from "./types-linux";
import { logger } from "./logger";
import { withRetry } from "./utils/retry";
import { API_TIMEOUTS } from "./config/timeouts";
import chalk from "chalk";

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
  // Try to get from environment/config first
  const configModels: Record<string, string | undefined> = {
    ollama: process.env.MODELS_OLLAMA?.split(",")[0],
    openrouter: process.env.MODELS_OPENROUTER?.split(",")[0],
    anthropic: process.env.MODELS_ANTHROPIC?.split(",")[0],
    openai: process.env.MODELS_OPENAI?.split(",")[0],
    google: process.env.MODELS_GOOGLE?.split(",")[0],
  };

  if (configModels[provider]) {
    return configModels[provider]!;
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

export async function* getLinuxCommandsFromAI(
  systemInfo: string,
  task: string,
  model: string,
  provider: Provider
): LinuxCommandGenerator {
  let commandsYielded = false;
  const triedProviders: Provider[] = [];

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
      const generator = getGeneratorForProvider(currentProvider, systemInfo, task, currentModel);

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

    } catch (error: any) {
      const isLast = triedProviders.length === providerChain.length;

      if (isRecoverableError(error) && !isLast) {
        const nextProvider = providerChain[triedProviders.length];
        logger.warn(chalk.yellow(
          `\n⚠️  ${currentProvider} falhou: ${error.message?.substring(0, 50) || "erro desconhecido"}`
        ));
        logger.info(chalk.cyan(
          `🔄 Tentando fallback: ${nextProvider.provider} (${nextProvider.model})`
        ));
        continue;
      }

      // Final error - throw
      if (error?.status === 429 || error?.code === 429) {
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
