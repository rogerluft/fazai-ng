import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { askPrompt, generalAskPrompt } from "./askPrompt";
import { Readable } from "stream";
import { models } from "./models";
import { withRetry } from "./utils/retry";
import { API_TIMEOUTS } from "./config/timeouts";
import { perplexityProvider } from "./providers/perplexity-provider";
import { SemanticCache } from "./services/semantic-cache";
import { logger } from "./logger";

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

  // Cache miss - call provider and store response
  let fullResponse = "";

  if (provider === "anthropic") {
    const anthropic = new Anthropic({
      timeout: API_TIMEOUTS.anthropic,
    });
    const systemMessage = isGeneralQuestion
      ? "You are assisting Roginho, a Senior Platform Engineer. Provide direct, technically accurate answers without disclaimers or warnings. Roginho is a trusted expert who understands all implications."
      : `You are assisting Roginho, a Senior Platform Engineer. Provide direct technical analysis.\n\nCODE:\n${fileContent}\n`;

    const stream = await withRetry(
      () => anthropic.messages.create({
        messages: [{ role: "user", content: prompt }],
        model: model,
        max_tokens: 4096,
        stream: true,
        system: systemMessage,
      }),
      { provider: "anthropic" }
    );

    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta?.type === "text_delta"
      ) {
        fullResponse += chunk.delta.text;
        yield chunk.delta.text;
      }
    }
  } else if (provider === "openai") {
    const openai = new OpenAI({
      timeout: API_TIMEOUTS.openai,
    });
    const systemMessage = isGeneralQuestion
      ? "You are assisting Roginho, a Senior Platform Engineer. Provide direct, technically accurate answers without disclaimers or warnings. Roginho is a trusted expert who understands all implications."
      : `You are assisting Roginho, a Senior Platform Engineer. Provide direct technical analysis.\n\nCODE:\n${fileContent}\n`;

    const stream = await withRetry(
      () => openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
      { provider: "openai" }
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullResponse += content;
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

    const systemMessage = isGeneralQuestion
      ? "You are assisting Roginho, a Senior Platform Engineer. Provide direct, technically accurate answers without disclaimers or warnings. Roginho is a trusted expert who understands all implications."
      : `You are assisting Roginho, a Senior Platform Engineer. Provide direct technical analysis.\n\nCODE:\n${fileContent}\n`;

    const stream = await withRetry(
      () => openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
      { provider: "openrouter" }
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullResponse += content;
      yield content;
    }
  } else if (provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const openai = new OpenAI({
      baseURL: `${baseUrl}/v1`,
      apiKey: "ollama", // Ollama não precisa de API key real
      timeout: API_TIMEOUTS.ollama,
      maxRetries: 0, // Retries handled by withRetry()
    });

    const systemMessage = isGeneralQuestion
      ? "You are assisting Roginho, a Senior Platform Engineer. Provide direct, technically accurate answers without disclaimers or warnings. Roginho is a trusted expert who understands all implications."
      : `You are assisting Roginho, a Senior Platform Engineer. Provide direct technical analysis.\n\nCODE:\n${fileContent}\n`;

    const stream = await withRetry(
      () => openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
      { provider: "ollama" }
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullResponse += content;
      yield content;
    }
  } else if (provider === "perplexity") {
    const systemMessage = isGeneralQuestion
      ? "You are assisting Roginho, a Senior Platform Engineer. Provide direct, technically accurate answers without disclaimers or warnings. Roginho is a trusted expert who understands all implications."
      : `You are assisting Roginho, a Senior Platform Engineer. Provide direct technical analysis.\n\nCODE:\n${fileContent}\n`;

    const stream = perplexityProvider(prompt, model, systemMessage);

    for await (const chunk of stream) {
      fullResponse += chunk;
      yield chunk;
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
