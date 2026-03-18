/**
 * Provider Fallback System
 *
 * Automatic fallback chain for AI providers when one fails.
 * Order: Loaded from PROVIDER_FALLBACK_ORDER in fazai.conf
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
import { getConfigValue } from "../config";

export type ProviderName = "llama" | "ollama" | "openrouter" | "anthropic" | "openai" | "google" | "perplexity";

/** Default fallback order when PROVIDER_FALLBACK_ORDER is not configured */
const DEFAULT_FALLBACK_ORDER: ProviderName[] = [
  "llama",      // Local llama.cpp server (Phi-3-mini)
  "ollama",     // Local Ollama server
  "openrouter", // Cloud with free tier
  "anthropic",  // Claude API
  "openai",     // OpenAI API
  "google",     // Gemini API
  "perplexity", // Perplexity API (sonar models)
];

/**
 * Load fallback chain from config or use defaults
 *
 * Config key: PROVIDER_FALLBACK_ORDER (comma-separated)
 * Example: PROVIDER_FALLBACK_ORDER=llama,ollama,openrouter,anthropic,openai,google,perplexity
 *
 * Invalid provider names are filtered out with a warning.
 */
function loadFallbackChain(): ProviderName[] {
  const configOrder = getConfigValue("PROVIDER_FALLBACK_ORDER");

  if (!configOrder) {
    return DEFAULT_FALLBACK_ORDER;
  }

  const validProviders: Set<ProviderName> = new Set([
    "llama", "ollama", "openrouter", "anthropic", "openai", "google", "perplexity"
  ]);

  const chain: ProviderName[] = [];

  for (const raw of configOrder.split(",")) {
    const provider = raw.trim().toLowerCase() as ProviderName;

    if (validProviders.has(provider)) {
      chain.push(provider);
    } else if (raw.trim()) {
      logger.warn(`⚠️ Invalid provider in PROVIDER_FALLBACK_ORDER: "${raw.trim()}" (skipped)`);
    }
  }

  if (chain.length === 0) {
    logger.warn("⚠️ PROVIDER_FALLBACK_ORDER is empty or invalid, using defaults");
    return DEFAULT_FALLBACK_ORDER;
  }

  return chain;
}

/**
 * Fallback chain loaded from PROVIDER_FALLBACK_ORDER config
 *
 * Priority: Loaded from PROVIDER_FALLBACK_ORDER config (or defaults if not set)
 * Providers without API keys are skipped automatically at runtime.
 */
export const FALLBACK_CHAIN: ProviderName[] = loadFallbackChain();

/**
 * Errors that should trigger fallback to next provider
 */
export interface FallbackError extends Error {
  code?: string | number;
  status?: number;
  message: string;
  cause?: FallbackError;
}

/**
 * Check if error should trigger provider fallback
 */
export function shouldFallbackToNextProvider(error: FallbackError): boolean {
  // Recursively check the cause chain for network errors
  let currentError: FallbackError | undefined = error;
  while (currentError) {
    if (
      currentError.code === "ECONNREFUSED" ||
      currentError.code === "ETIMEDOUT" ||
      currentError.code === "ENOTFOUND" ||
      currentError.code === "ECONNRESET" ||
      currentError.code === "ERR_INVALID_URL"
    ) {
      return true;
    }
    currentError = currentError.cause;
  }

  // Check error message patterns from the top-level error
  const message = error.message?.toLowerCase() || "";

  // Ollama-specific: server offline
  if (
    message.includes("econnrefused") ||
    message.includes("connection refused") ||
    (message.includes("ollama") && message.includes("not") && message.includes("running"))
  ) {
    return true;
  }

  // Authentication errors (invalid API key, expired token, etc.)
  if (error.status === 401 || error.status === 403) {
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

    // Local providers don't need API key
    if (nextProvider === "llama" || nextProvider === "ollama") {
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
 *
 * Uses config-loaded models via getDefaultModelForProvider() instead of
 * hardcoded model names. Falls back to first configured model for provider.
 */
export function getEquivalentModel(
  _originalModel: string,
  targetProvider: ProviderName
): string | null {
  // Always use the first configured model for the target provider.
  // This respects MODELS_* from fazai.conf instead of hardcoded values.
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
 *   "anthropic",
 *   "claude-sonnet-4-5"
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
