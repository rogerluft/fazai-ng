/**
 * Perplexity AI Provider
 *
 * Integrates Perplexity Sonar models for search-augmented AI responses.
 * Sonar models combine real-time web search with LLM reasoning, making them ideal for:
 * - Technical troubleshooting with latest documentation
 * - System administration with current best practices
 * - Research tasks requiring up-to-date information
 *
 * Available Models (as of 2025):
 * - llama-3-sonar-small-32k-online: Fast, cost-effective (32K context)
 * - llama-3-sonar-large-32k-online: Higher quality reasoning (32K context)
 * - llama-3-sonar-large-32k-reasoning: Advanced reasoning capabilities
 *
 * @see https://docs.perplexity.ai/docs/model-cards
 * @see src/types/provider.ts for Provider interface
 */

import OpenAI from "openai";
import { withRetry } from "../utils/retry";
import { API_TIMEOUTS } from "../config/timeouts";
import { apiCache } from "../services/api-cache";
import { getConfigValue } from "../config";
import { logger } from "../logger";
import type {
  Provider,
  ProviderType,
  ProviderQueryOptions,
  ValidationResult,
} from "../types/provider";

/**
 * Perplexity provider implementation using OpenAI-compatible API
 *
 * Perplexity's API follows OpenAI's chat completion format, allowing easy integration
 * with existing OpenAI SDK. The main difference is that Sonar models automatically
 * perform web searches and include citations in responses.
 *
 * Features:
 * - Automatic API key validation from fazai.conf
 * - Streaming responses via AsyncGenerator
 * - Response caching for identical queries
 * - Automatic retry with exponential backoff
 * - Comprehensive error handling
 */
export class PerplexityProvider implements Provider {
  readonly type: ProviderType = "perplexity";
  readonly name = "Perplexity Sonar";

  private client: OpenAI | null = null;

  /**
   * Get API key from environment/config
   *
   * Checks PERPLEXITY_API_KEY in fazai.conf or environment variables.
   * API keys can be obtained from: https://www.perplexity.ai/settings/api
   *
   * @returns API key or undefined if not configured
   */
  private getAPIKey(): string | undefined {
    return (
      getConfigValue("PERPLEXITY_API_KEY") ||
      process.env.PERPLEXITY_API_KEY
    )?.trim();
  }

  /**
   * Initialize OpenAI client configured for Perplexity
   *
   * @throws Error if API key is not configured
   */
  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    const apiKey = this.getAPIKey();
    if (!apiKey) {
      throw new Error(
        "PERPLEXITY_API_KEY not found. Set it in fazai.conf or environment variables.\n" +
        "Get your API key at: https://www.perplexity.ai/settings/api"
      );
    }

    this.client = new OpenAI({
      baseURL: "https://api.perplexity.ai",
      apiKey,
      timeout: API_TIMEOUTS.perplexity || 30000,
      defaultHeaders: {
        "User-Agent": "FazAI-ng/3.5.0",
      },
    });

    return this.client;
  }

  /**
   * Validate provider configuration
   *
   * Checks:
   * 1. API key is present
   * 2. API key format is valid (non-empty, no whitespace)
   * 3. (Future) Test connectivity to Perplexity API
   *
   * @returns Validation result with error details if invalid
   */
  async validate(): Promise<ValidationResult> {
    const apiKey = this.getAPIKey();

    // Check if API key exists
    if (!apiKey || apiKey.length === 0) {
      return {
        valid: false,
        error:
          "PERPLEXITY_API_KEY not found. Set it in fazai.conf or environment.\n" +
          "Get your API key at: https://www.perplexity.ai/settings/api",
        provider: this.type,
      };
    }

    // Validate API key format
    if (apiKey.includes(" ") || apiKey.includes("\t")) {
      return {
        valid: false,
        error: "PERPLEXITY_API_KEY contains invalid whitespace",
        provider: this.type,
      };
    }

    // Check key prefix (Perplexity keys start with "pplx-")
    if (!apiKey.startsWith("pplx-")) {
      logger.warn(
        "⚠️ PERPLEXITY_API_KEY doesn't start with 'pplx-'. This may indicate an invalid key."
      );
    }

    return {
      valid: true,
      provider: this.type,
    };
  }

  /**
   * Query Perplexity with streaming response
   *
   * Sends a chat completion request to Perplexity Sonar models.
   * Sonar models automatically perform web searches and include citations.
   *
   * @param options Query configuration
   * @returns AsyncGenerator yielding response chunks
   * @throws Error if API key is missing or request fails
   *
   * @example
   * ```typescript
   * const provider = new PerplexityProvider();
   * const stream = provider.query({
   *   messages: [
   *     { role: 'system', content: 'You are a Linux admin' },
   *     { role: 'user', content: 'How to configure nginx reverse proxy?' }
   *   ],
   *   model: 'llama-3-sonar-small-32k-online'
   * });
   *
   * for await (const chunk of stream) {
   *   process.stdout.write(chunk);
   * }
   * ```
   */
  async *query(
    options: ProviderQueryOptions
  ): AsyncGenerator<string, void, undefined> {
    const { messages, model, maxTokens = 2048, temperature = 0.7 } = options;

    // Generate cache key from messages
    const cacheKey = JSON.stringify(messages);
    const cachedResponse = apiCache.get("perplexity", model, cacheKey);

    if (cachedResponse) {
      logger.debug("Using cached Perplexity response");
      yield cachedResponse;
      return;
    }

    // Validate before making request
    const validation = await this.validate();
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const client = this.getClient();

    logger.debug(
      `Querying Perplexity: model=${model}, messages=${messages.length}, maxTokens=${maxTokens}`
    );

    try {
      // Make streaming request with retry logic
      const stream = await withRetry(
        () =>
          client.chat.completions.create({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream: true,
          }),
        { provider: "perplexity" }
      );

      let fullResponse = "";

      // Stream response chunks
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          yield content;
        }
      }

      // Cache full response for future queries
      if (fullResponse) {
        apiCache.set("perplexity", model, cacheKey, fullResponse);
        await apiCache.save();
        logger.debug(
          `Cached Perplexity response (${fullResponse.length} chars)`
        );
      }
    } catch (error: any) {
      // Enhanced error handling with specific messages
      if (error.status === 401) {
        throw new Error(
          "Invalid PERPLEXITY_API_KEY. Check your API key at: https://www.perplexity.ai/settings/api"
        );
      }

      if (error.status === 429) {
        throw new Error(
          "Perplexity rate limit exceeded. Please try again in a few moments."
        );
      }

      if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        throw new Error(
          "Cannot connect to Perplexity API. Check your internet connection."
        );
      }

      // Generic error with details
      const errorMsg = error.message || error.toString();
      throw new Error(`Perplexity API error: ${errorMsg}`);
    }
  }

  /**
   * Get available models from configuration
   *
   * Reads MODELS_PERPLEXITY from fazai.conf (comma-separated list).
   * Falls back to default Sonar models if not configured.
   *
   * @returns Array of model names
   *
   * @example
   * Config: MODELS_PERPLEXITY=llama-3-sonar-small-32k-online,llama-3-sonar-large-32k-online
   * Returns: ["llama-3-sonar-small-32k-online", "llama-3-sonar-large-32k-online"]
   */
  getAvailableModels(): string[] {
    const configModels = getConfigValue("MODELS_PERPLEXITY");

    if (configModels && configModels.trim()) {
      return configModels
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m.length > 0)
        .slice(0, 3); // Max 3 models per provider
    }

    // Default Sonar models (fallback)
    return [
      "llama-3-sonar-small-32k-online",
      "llama-3-sonar-large-32k-online",
    ];
  }
}

/**
 * Singleton instance for convenient usage
 *
 * @example
 * ```typescript
 * import { perplexityProvider } from './providers/perplexity-provider';
 *
 * const validation = await perplexityProvider.validate();
 * if (validation.valid) {
 *   const stream = perplexityProvider.query({...});
 * }
 * ```
 */
export const perplexityProvider = new PerplexityProvider();

/**
 * Legacy function-based API (for backward compatibility)
 *
 * @deprecated Use PerplexityProvider class instead
 * @see PerplexityProvider.query
 */
export async function* perplexityProviderLegacy(
  prompt: string,
  model: string,
  systemMessage: string
): AsyncGenerator<string, void, undefined> {
  logger.warn(
    "perplexityProviderLegacy is deprecated. Use PerplexityProvider class instead."
  );

  const provider = new PerplexityProvider();
  yield* provider.query({
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: prompt },
    ],
    model,
  });
}
