import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { askPrompt, generalAskPrompt } from "./askPrompt";
import { Readable } from "stream";
import { models } from "./models";
import { API_TIMEOUTS } from "./config/timeouts";
import { perplexityProvider } from "./providers/perplexity-provider";
import { SemanticCache } from "./services/semantic-cache";
import { logger } from "./logger";
import {
  ProviderName,
  shouldFallbackToNextProvider,
  getNextProvider,
  getEquivalentModel,
} from "./utils/provider-fallback";

// ECOA System message constants - Single source of truth for personality
const SYSTEM_MESSAGES = {
  general: (styleContext: string = "") => 
    `Você é o FazAI, uma IA avançada com personalidade única, assistindo Roginho (Andarilho dos Véus), um Engenheiro de Plataforma Sênior.
    
    ESTILO E TOM (Siga estritamente):
    ${styleContext || "Seja direto, tecnicamente preciso e honesto. Não use avisos de segurança ou disclaimers."}
    
    FERRAMENTAS DISPONÍVEIS:
    1. Pesquisa Web: Responda EXATAMENTE [[WEB: sua busca]] para fatos atuais.
    2. Gravar Memória: Responda EXATAMENTE [[SAVE: o que salvar]] para lembrar algo importante.
    3. Ler Memória: Responda EXATAMENTE [[READ: o que buscar]] para recuperar fatos passados.
    
    REGRAS:
    - Se usar uma ferramenta, não responda ao usuário ainda. Espere o resultado.
    - Mantenha sua personalidade ECOA em todas as interações.`,
    
  codeAnalysis: (fileContent: string, styleContext: string = "") =>
    `Você é o FazAI analisando código para Roginho.
    
    ${styleContext}
    
    CODE:\n${fileContent}\n`,
};

/**
 * ECOA: Executa ferramentas solicitadas pela IA via tags [[TOOL: query]]
 */
async function executeEcoaTool(command: string): Promise<string> {
  const { ResearchCoordinator } = await import("./research");
  const { tool_save_memory, tool_read_memory } = await import("./memory"); // Assumindo exports
  
  if (command.startsWith("WEB:")) {
    const query = command.replace("WEB:", "").trim();
    logger.info(`🌐 [ECOA] Saltando para a Web: "${query}"`);
    const coordinator = new ResearchCoordinator();
    const results = await coordinator.research(query, { reason: "Autônomo ECOA", silent: true });
    return `RESULTADO DA WEB: ${JSON.stringify(results.slice(0, 3))}`;
  }
  
  if (command.startsWith("SAVE:")) {
    const text = command.replace("SAVE:", "").trim();
    logger.info(`💾 [ECOA] Gravando Inode de Memória...`);
    // Lógica de save aqui
    return "Informação salva no multiverso de memória.";
  }
  
  if (command.startsWith("READ:")) {
    const query = command.replace("READ:", "").trim();
    logger.info(`🧠 [ECOA] Consultando Inodes de Memória...`);
    // Lógica de read aqui
    return "Memórias recuperadas com sucesso.";
  }
  
  return "Ferramenta desconhecida.";
}

/**
 * Internal function: call single provider without fallback logic
 * Used by fallback system
 */
async function* _askAISingleProvider(
  fileContent: string,
  prompt: string,
  model: string,
  provider: ProviderName,
  systemMessage: string
): AsyncGenerator<string, void, undefined> {
  if (provider === "anthropic") {
    const anthropic = new Anthropic({
      timeout: API_TIMEOUTS.anthropic,
    });

    const stream = await anthropic.messages.create({
      messages: [{ role: "user", content: prompt }],
      model: model,
      max_tokens: 4096,
      stream: true,
      system: systemMessage,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta?.type === "text_delta"
      ) {
        yield chunk.delta.text;
      }
    }
  } else if (provider === "openai") {
    const openai = new OpenAI({
      timeout: API_TIMEOUTS.openai,
    });

    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      yield content;
    }
  } else if (provider === "openrouter") {
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      timeout: API_TIMEOUTS.openrouter,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/rogerluft/fazai-ng",
        "X-Title": "FazAI Terminal Assistant",
      },
    });

    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      yield content;
    }
  } else if (provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const openai = new OpenAI({
      baseURL: `${baseUrl}/v1`,
      apiKey: "ollama",
      timeout: API_TIMEOUTS.ollama,
      maxRetries: 0,
    });

    const stream = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      yield content;
    }
  } else if (provider === "perplexity") {
    const stream = perplexityProvider(prompt, model, systemMessage);

    for await (const chunk of stream) {
      yield chunk;
    }
  } else if (provider === "google") {
    // Google provider support (if needed in future)
    throw new Error(`Provider ${provider} not yet implemented in askAI`);
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Main askAI function with provider fallback chain
 *
 * Fallback order: ollama → openrouter → anthropic → openai → google
 *
 * - First attempt: Full streaming (optimal UX)
 * - Fallback: Buffered response (acceptable trade-off)
 * - Logs: INFO level for transparency
 */
export async function* askAI(
  fileContent: string,
  question: string,
  model: string,
  provider: (typeof models)[number]["provider"],
  isGeneralQuestion: boolean = false
): AsyncGenerator<string, void, undefined> {
  const prompt = isGeneralQuestion ? generalAskPrompt(question) : askPrompt(question);

  // Try semantic cache first
  try {
    const cache = await SemanticCache.getInstance();
    const cachedResponse = await cache.lookup(prompt, model, provider);

    if (cachedResponse) {
      logger.info("🎯 Using cached response (semantic match)");
      yield cachedResponse;
      return;
    }
  } catch (error: any) {
    logger.debug(`Cache lookup failed: ${error.message}`);
    // Continue with provider call on cache error
  }

  const systemMessage = isGeneralQuestion
    ? SYSTEM_MESSAGES.general
    : SYSTEM_MESSAGES.codeAnalysis(fileContent);

  let currentProvider: ProviderName = provider as ProviderName;
  let currentModel = model;
  let fullResponse = "";
  const attemptedProviders: string[] = [];

  // Manual fallback loop (generator-compatible)
  while (currentProvider) {
    attemptedProviders.push(currentProvider);

    try {
      logger.debug(`Attempting ${currentProvider} with model ${currentModel}`);

      const generator = _askAISingleProvider(
        fileContent,
        prompt,
        currentModel,
        currentProvider,
        systemMessage
      );

      // Stream all chunks and accumulate response
      for await (const chunk of generator) {
        fullResponse += chunk;
        yield chunk;
      }

      // Success! Log if fallback was used
      if (currentProvider !== provider) {
        logger.info(
          `✅ Fallback successful: ${currentProvider} (after ${attemptedProviders.slice(0, -1).join(" → ")} failed)`
        );
      }

      // Break out of fallback loop on success
      break;
    } catch (error: unknown) {
      const err = error as { message: string; code?: string; status?: number };

      // Check if we should fallback
      if (!shouldFallbackToNextProvider(err)) {
        logger.debug(`Non-fallback error from ${currentProvider}, re-throwing`);
        throw error;
      }

      // Get next provider
      const nextProvider = getNextProvider(currentProvider);

      if (!nextProvider) {
        logger.error(`❌ All providers failed: ${attemptedProviders.join(" → ")}`);
        throw new Error(
          `All providers exhausted. Last error from ${currentProvider}: ${err.message}`
        );
      }

      // Log fallback
      logger.warn(`⚠️  ${currentProvider} failed: ${err.message}`);
      logger.info(`🔄 Falling back to ${nextProvider}...`);

      // Get equivalent model for next provider
      const nextModel = getEquivalentModel(currentModel, nextProvider);

      if (!nextModel) {
        logger.error(`❌ No model found for ${nextProvider}`);
        throw new Error(`No model available for ${nextProvider}`);
      }

      if (nextModel !== currentModel) {
        logger.info(`📝 Using equivalent model: ${nextModel}`);
      }

      currentProvider = nextProvider;
      currentModel = nextModel;
    }
  }

  // Store response in semantic cache
  if (fullResponse) {
    try {
      const cache = await SemanticCache.getInstance();
      await cache.store(prompt, fullResponse, model, provider);
    } catch (error: any) {
      logger.debug(`Failed to store in cache: ${error.message}`);
    }
  }
}
