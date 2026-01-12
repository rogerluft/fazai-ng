import { getConfigValue } from "./config";
import { logger } from "./logger";
import type { ProviderType } from "./types/provider";

/**
 * Model definition - Simplified, NO nicknames
 *
 * Models are now referenced by their EXACT names as configured in fazai.conf
 * Order in config = order of priority (first model = default for provider)
 *
 * @example
 * MODELS_OLLAMA=qwen2.5:7b,tinyllama:1b
 * First model (qwen2.5:7b) becomes the default for Ollama provider
 */
export interface Model {
  /** Exact model name as specified by provider (e.g., "gpt-4o", "llama-3-sonar-small-32k-online") */
  name: string;

  /** Provider type */
  provider: ProviderType;

  /** Optional description for help text */
  description?: string;
}

/**
 * Load models from configuration file (fazai.conf)
 *
 * Configuration format:
 * MODELS_PROVIDER=model1,model2,model3
 *
 * @example
 * MODELS_OLLAMA=qwen2.5:7b,tinyllama:1b
 * MODELS_OPENROUTER=qwen/qwen3-coder:free,google/gemini-2.0-flash-exp:free
 * MODELS_PERPLEXITY=llama-3-sonar-small-32k-online,llama-3-sonar-large-32k-online
 *
 * Rules:
 * 1. Order matters: First model in list = default for that provider
 * 2. Maximum 3 models per provider (organization constraint)
 * 3. Use EXACT model names (no aliases, no nicknames)
 * 4. Fallback to built-in defaults if config not found
 */
function loadModelsFromConfig(): Model[] {
  const models: Model[] = [];

  try {
    // Provider configurations (max 3 models each)
    const providers: Array<{
      key: string;
      provider: ProviderType;
      limit: number;
    }> = [
      { key: "MODELS_LLAMA", provider: "llama", limit: 3 },   // llama.cpp local (Phi-3) - primary
      { key: "MODELS_OLLAMA", provider: "ollama", limit: 3 }, // Ollama remote - only for embeddings
      { key: "MODELS_OPENROUTER", provider: "openrouter", limit: 3 },
      { key: "MODELS_OPENAI", provider: "openai", limit: 3 },
      { key: "MODELS_ANTHROPIC", provider: "anthropic", limit: 3 },
      { key: "MODELS_GOOGLE", provider: "google", limit: 3 },
      { key: "MODELS_PERPLEXITY", provider: "perplexity", limit: 3 },
    ];

    for (const { key, provider, limit } of providers) {
      const modelStr = getConfigValue(key);
      if (modelStr && modelStr.trim()) {
        const modelList = modelStr
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m.length > 0)
          .slice(0, limit); // Enforce limit

        for (const modelName of modelList) {
          models.push({
            name: modelName,
            provider,
            description: `${provider.toUpperCase()} - ${modelName}`,
          });

          logger.debug(`Loaded model: ${modelName} (${provider})`);
        }
      }
    }

    if (models.length > 0) {
      logger.debug(`Successfully loaded ${models.length} models from config`);
      return models;
    }
  } catch (error) {
    logger.debug(`Config-based model loading failed: ${error}`);
  }

  // Fallback to built-in defaults if config is empty or invalid
  logger.debug("Falling back to built-in default models");
  return getBuiltInModels();
}

/**
 * Built-in default models (fallback when config is not available)
 *
 * These are conservative defaults that work out-of-the-box.
 * Users should configure their own models in fazai.conf for optimal experience.
 */
function getBuiltInModels(): Model[] {
  const previewEnabled = getConfigValue("ENABLE_PREVIEW_FEATURES") === "true";

  const models: Model[] = [];

  // Google Gemini (preview feature)
  if (previewEnabled) {
    models.push({
      name: "gemini-3.0-pro-latest",
      provider: "google",
      description: "Gemini 3 Pro (Preview)",
    });
  }

  // Google Gemini (stable)
  models.push(
    {
      name: "gemini-2.5-pro",
      provider: "google",
      description: "Gemini 2.5 Pro (deep reasoning)",
    },
    {
      name: "gemini-2.5-flash",
      provider: "google",
      description: "Gemini 2.5 Flash (fast & balanced)",
    },
    {
      name: "gemini-2.5-flash-lite",
      provider: "google",
      description: "Gemini 2.5 Flash Lite (quick tasks)",
    }
  );

  // Ollama (local models - require Ollama server)
  models.push(
    {
      name: "qwen2.5:7b",
      provider: "ollama",
      description: "Qwen 2.5 7B (local, efficient)",
    },
    {
      name: "tinyllama:1b",
      provider: "ollama",
      description: "TinyLlama 1B (local, fast)",
    }
  );

  // OpenRouter (cloud, free tier available)
  models.push(
    {
      name: "qwen/qwen3-coder:free",
      provider: "openrouter",
      description: "Qwen3 Coder (free tier)",
    },
    {
      name: "google/gemini-2.0-flash-exp:free",
      provider: "openrouter",
      description: "Gemini 2.0 Flash via OpenRouter (free)",
    }
  );

  // Perplexity (online search + AI)
  models.push(
    {
      name: "llama-3-sonar-small-32k-online",
      provider: "perplexity",
      description: "Perplexity Sonar Small (search-enabled)",
    },
    {
      name: "llama-3-sonar-large-32k-online",
      provider: "perplexity",
      description: "Perplexity Sonar Large (search-enabled)",
    }
  );

  // OpenAI (optional, requires API key)
  models.push(
    {
      name: "gpt-4o-mini",
      provider: "openai",
      description: "GPT-4o Mini (fast & cheap)",
    },
    {
      name: "gpt-4o",
      provider: "openai",
      description: "GPT-4o (most capable)",
    }
  );

  // Anthropic Claude (optional, requires API key)
  // Hierarchy: Opus 4.5 (most capable) → Sonnet 4.5 → Haiku 4.5 (fast)
  models.push(
    {
      name: "claude-opus-4-5-20251101",
      provider: "anthropic",
      description: "Claude Opus 4.5 (most capable, deep reasoning)",
    },
    {
      name: "claude-sonnet-4-5-20250929",
      provider: "anthropic",
      description: "Claude Sonnet 4.5 (balanced, fast)",
    },
    {
      name: "claude-3-5-haiku-latest",
      provider: "anthropic",
      description: "Claude 3.5 Haiku (fastest, efficient)",
    }
  );

  return models;
}

/**
 * Get default model for a specific provider
 *
 * Rules:
 * 1. First model in provider's config list = default
 * 2. If provider has no models configured, return first built-in for that provider
 * 3. If provider has no built-in defaults, return overall first model
 *
 * @param provider Provider type to get default for
 * @returns Default model for the provider
 */
export function getDefaultModel(provider?: ProviderType): Model {
  if (provider) {
    const providerModels = models.filter((m) => m.provider === provider);
    if (providerModels.length > 0) {
      return providerModels[0];
    }
  }

  // Fallback: first model overall (usually Gemini or first in config)
  return models[0];
}

/**
 * Find model by exact name
 *
 * @param name Exact model name (case-sensitive)
 * @returns Model if found, undefined otherwise
 */
export function findModelByName(name: string): Model | undefined {
  return models.find((m) => m.name === name);
}

/**
 * Get all models for a specific provider
 *
 * @param provider Provider type
 * @returns Array of models for that provider (order preserved from config)
 */
export function getModelsByProvider(provider: ProviderType): Model[] {
  return models.filter((m) => m.provider === provider);
}

/**
 * Check if a provider has any models configured
 *
 * @param provider Provider type
 * @returns True if provider has at least one model
 */
export function hasModelsForProvider(provider: ProviderType): boolean {
  return models.some((m) => m.provider === provider);
}

// Load models on module initialization
export const models: Model[] = loadModelsFromConfig();

// Log loaded models for debugging
logger.debug("Available models:");
for (const model of models) {
  logger.debug(`  - ${model.name} (${model.provider})`);
}
