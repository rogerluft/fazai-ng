import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { linuxAdminPrompt } from "./linux-prompt";
import { LinuxCommandGenerator } from "./types-linux";
import { logger } from "./logger";

export async function* getLinuxCommandsFromAI(
  systemInfo: string,
  task: string,
  model: string,
  provider: "anthropic" | "openai" | "openrouter" | "ollama" | "google"
): LinuxCommandGenerator {
  try {
    if (provider === "anthropic") {
      yield* getLinuxCommandsFromClaude(systemInfo, task, model);
    } else if (provider === "openai") {
      yield* getLinuxCommandsFromOpenAI(systemInfo, task, model);
    } else if (provider === "openrouter") {
      yield* getLinuxCommandsFromOpenRouter(systemInfo, task, model);
    } else if (provider === "ollama") {
      yield* getLinuxCommandsFromOllama(systemInfo, task, model);
    } else if (provider === "google") {
      yield* getLinuxCommandsFromGemini(systemInfo, task, model);
    } else {
      throw new Error(`Provider não suportado: ${provider}`);
    }
  } catch (error: any) {
    // Melhorar mensagem de erro para rate limits
    if (error?.status === 429 || error?.code === 429) {
      const suggestion = provider === "openrouter" 
        ? "Tente outro modelo: fazai --model gemini2flash ou fazai --model gptoss"
        : "Aguarde alguns minutos ou use outro modelo";
      
      logger.error(`\n❌ Rate limit atingido no ${provider}. ${suggestion}`);
    }
    
    throw error;
  }
}

async function* getLinuxCommandsFromClaude(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const anthropic = new Anthropic();

  logger.info(`\n\n🖥️  Gerando comandos Linux com Claude (${model})...`);

  const tokens = model.includes("sonnet") ? 8192 : 4096;

  const stream = await anthropic.messages.create({
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
  });

  // Use unified streaming parser
  const { parseStreamingJSON, iterateAnthropicStream } = await import("./streaming-parser");
  yield* parseStreamingJSON(iterateAnthropicStream(stream), "anthropic");
}

async function* getLinuxCommandsFromOpenAI(
  systemInfo: string,
  task: string,
  model: string
): LinuxCommandGenerator {
  const openai = new OpenAI();

  logger.info(`\n\n🖥️  Gerando comandos Linux com OpenAI (${model})...`);

  const systemMessage = `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.

IMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido no formato:
{"commands": [array de comandos]}

Cada comando deve ter a estrutura exata definida no prompt do usuário.`;

  const stream = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: linuxAdminPrompt(task) }
    ],
    stream: true,
    temperature: 0,
    response_format: { type: "json_object" },
  });

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

  let stream;
  try {
    stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: linuxAdminPrompt(task) }
      ],
      stream: true,
      temperature: 0,
    });
  } catch (error: any) {
    if (error.status === 429) {
      logger.error(`\n⚠️  Rate limit atingido: ${model} temporariamente indisponível`);
      logger.error(`💡 Sugestão: Use outro modelo gratuito (gemini2flash, llama32) ou aguarde alguns minutos\n`);
    }
    throw error;
  }

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
  const openai = new OpenAI({
    baseURL: `${baseUrl}/v1`,
    apiKey: "ollama", // Ollama doesn't need real API key
  });

  logger.info(`\n\n🖥️  Gerando comandos Linux com Ollama (${model}) em ${baseUrl}...`);

  const systemMessage = `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.

IMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido no formato:
{"commands": [array de comandos]}

Cada comando deve ter a estrutura exata definida no prompt do usuário.`;

  const stream = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: linuxAdminPrompt(task) }
    ],
    stream: true,
    temperature: 0,
  });

  // Use unified streaming parser
  const { parseStreamingJSON, iterateOpenAIStream } = await import("./streaming-parser");
  yield* parseStreamingJSON(iterateOpenAIStream(stream), "ollama");
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
  const geminiModel = genAI.getGenerativeModel({ model });

  logger.info(`\n\n🖥️  Gerando comandos Linux com Gemini (${model})...`);

  const systemMessage = `INFORMAÇÕES DO SISTEMA:\n${systemInfo}\n\nVocê é um administrador de sistemas Linux. Sempre priorize segurança e inclua verificações apropriadas.

IMPORTANTE: Você DEVE responder APENAS com um objeto JSON válido no formato:
{"commands": [array de comandos]}

Cada comando deve ter a estrutura exata definida no prompt do usuário.`;

  const prompt = `${systemMessage}\n\n${linuxAdminPrompt(task)}`;

  const result = await geminiModel.generateContentStream(prompt);

  // Use unified streaming parser
  const { parseStreamingJSON, iterateGoogleStream } = await import("./streaming-parser");
  yield* parseStreamingJSON(iterateGoogleStream(result.stream), "google");
}
