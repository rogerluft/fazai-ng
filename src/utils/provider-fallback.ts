/**
 * Provider Fallback System
 *
 * Automatic fallback chain for AI providers when one fails.
 * Order: ollama → openrouter → anthropic → openai → google
 *
 * Features:
 * - Auto-detection of recoverable errors
 * - Preserves original model preferences when possible
 * - Logs fallback chain for transparency
 * - Skips providers without API keys
 *
 * @module utils/provider-fallback
 */

import { logger } from "../logger";
import { models } from "../models";
import { checkAPIKey } from "../apiKeyUtils-fazai";

export type ProviderName = "ollama" | "openrouter" | "anthropic" | "openai" | "google";

/**
 * Fallback chain: ollama → openrouter → anthropic → openai → google
 */
export const FALLBACK_CHAIN: ProviderName[] = [
  "ollama",
  "openrouter",
  "anthropic",
  "openai",
  "google",
];

/**
 * Errors that should trigger fallback to next provider
 */
export interface FallbackError extends Error {
  code?: string | number;
  status?: number;
  message: string;
}

/**
 * Check if error should trigger provider fallback
 */
export function shouldFallbackToNextProvider(error: FallbackError): boolean {
  // Network/connection errors
  if (
    error.code === "ECONNREFUSED" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ENOTFOUND" ||
    error.code === "ECONNRESET"
  ) {
    return true;
  }

  // Check error message patterns
  const message = error.message?.toLowerCase() || "";

  // Ollama-specific: server offline
  if (
    message.includes("econnrefused") ||
    message.includes("connection refused") ||
    message.includes("ollama") && message.includes("not") && message.includes("running")
  ) {
    return true;
  }

  // Rate limiting (try next provider instead of waiting)
  if (error.status === 429) {
    return true;
  }

  // Out of memory / quota exceeded
  if (
    message.includes("memory") ||
    message.includes("quota") ||
    message.includes("insufficient")
  ) {
    return true;
  }

  // Service unavailable
  if (error.status === 503 || error.status === 504) {
    return true;
  }

  // Model not found / not supported
  if (error.status === 404 && message.includes("model")) {
    return true;
  }

  return false;
}

/**
 * Get next provider in fallback chain
 */
export function getNextProvider(currentProvider: ProviderName): ProviderName | null {
  const currentIndex = FALLBACK_CHAIN.indexOf(currentProvider);

  if (currentIndex === -1 || currentIndex === FALLBACK_CHAIN.length - 1) {
    return null; // No next provider
  }

  // Find next provider with API key configured
  for (let i = currentIndex + 1; i < FALLBACK_CHAIN.length; i++) {
    const nextProvider = FALLBACK_CHAIN[i];

    // Ollama doesn't need API key
    if (nextProvider === "ollama") {
      return nextProvider;
    }

    // Check if API key is configured
    if (checkAPIKey(nextProvider)) {
      return nextProvider;
    }
  }

  return null; // No provider with API key found
}

/**
 * Get default model for a provider
 */
export function getDefaultModelForProvider(provider: ProviderName): string | null {
  const providerModels = models.filter((m) => m.provider === provider);

  if (providerModels.length === 0) {
    return null;
  }

  // Return first model (default)
  return providerModels[0].name;
}

/**
 * Get equivalent model for different provider (best effort)
 */
export function getEquivalentModel(
  originalModel: string,
  targetProvider: ProviderName
): string | null {
  // Try to find similar model
  const originalLower = originalModel.toLowerCase();

  // Model mapping heuristics
  const mappings: Record<string, Partial<Record<ProviderName, string>>> = {
    // Large models
    "gpt-4": {
      anthropic: "claude-3-5-sonnet-latest",
      openrouter: "anthropic/claude-3.5-sonnet",
      google: "gemini-1.5-pro-latest",
      ollama: "llama3.2:latest",
    },
    sonnet: {
      openai: "gpt-4o",
      openrouter: "anthropic/claude-3.5-sonnet",
      google: "gemini-1.5-pro-latest",
      ollama: "llama3.2:latest",
    },
    "gemini": {
      openai: "gpt-4o",
      anthropic: "claude-3-5-sonnet-latest",
      openrouter: "google/gemini-pro-1.5",
      ollama: "llama3.2:latest",
    },
    // Fast models
    "gpt-4o-mini": {
      anthropic: "claude-3-5-haiku-latest",
      openrouter: "anthropic/claude-3.5-haiku",
      google: "gemini-1.5-flash-latest",
      ollama: "llama3.2:latest",
    },
    haiku: {
      openai: "gpt-4o-mini",
      openrouter: "anthropic/claude-3.5-haiku",
      google: "gemini-1.5-flash-latest",
      ollama: "llama3.2:latest",
    },
    flash: {
      openai: "gpt-4o-mini",
      anthropic: "claude-3-5-haiku-latest",
      openrouter: "google/gemini-flash-1.5",
      ollama: "llama3.2:latest",
    },
    // Ollama models
    llama: {
      openai: "gpt-4o-mini",
      anthropic: "claude-3-5-haiku-latest",
      openrouter: "meta-llama/llama-3.1-8b-instruct",
      google: "gemini-1.5-flash-latest",
    },
    qwen: {
      openai: "gpt-4o-mini",
      anthropic: "claude-3-5-haiku-latest",
      openrouter: "qwen/qwen-2.5-coder-32b-instruct",
      google: "gemini-1.5-flash-latest",
    },
  };

  // Find matching mapping
  for (const [key, mapping] of Object.entries(mappings)) {
    if (originalLower.includes(key)) {
      const equivalentModel = mapping[targetProvider];
      if (equivalentModel) {
        return equivalentModel;
      }
    }
  }

  // No mapping found, return default for target provider
  return getDefaultModelForProvider(targetProvider);
}

/**
 * Execute function with automatic provider fallback
 *
 * @param fn Function to execute (receives provider and model)
 * @param initialProvider Starting provider
 * @param initialModel Starting model
 * @returns Result from first successful provider
 *
 * @example
 * const result = await withProviderFallback(
 *   async (provider, model) => askAI("", prompt, model, provider),
 *   "ollama",
 *   "llama3.2:latest"
 * );
 */
export async function withProviderFallback<T>(
  fn: (provider: ProviderName, model: string) => Promise<T>,
  initialProvider: ProviderName,
  initialModel: string
): Promise<T> {
  let currentProvider = initialProvider;
  let currentModel = initialModel;
  const attemptedProviders: string[] = [];

  while (currentProvider) {
    attemptedProviders.push(currentProvider);

    try {
      logger.debug(`Attempting ${currentProvider} with model ${currentModel}`);

      const result = await fn(currentProvider, currentModel);

      // Success!
      if (currentProvider !== initialProvider) {
        logger.info(
          `✅ Fallback successful: ${currentProvider} (after ${attemptedProviders.slice(0, -1).join(" → ")} failed)`
        );
      }

      return result;
    } catch (error: unknown) {
      const err = error as FallbackError;

      // Check if we should fallback
      if (!shouldFallbackToNextProvider(err)) {
        logger.debug(`Non-fallback error from ${currentProvider}, re-throwing`);
        throw error;
      }

      // Get next provider
      const nextProvider = getNextProvider(currentProvider);

      if (!nextProvider) {
        logger.error(
          `❌ All providers failed: ${attemptedProviders.join(" → ")}`
        );
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

  // Should never reach here
  throw new Error("Provider fallback loop failed unexpectedly");
}
