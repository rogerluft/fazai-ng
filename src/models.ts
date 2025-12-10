import { getConfigValue } from "./config";
import { logger } from "./logger";

export interface Model {
  name: string;
  provider:
    | "anthropic"
    | "openai"
    | "openrouter"
    | "ollama"
    | "google"
    | "perplexity";
  nickName: string;
  description?: string;
}

/**
 * Load models from configuration file (/etc/fazai/fazai.conf)
 * Fallback to built-in defaults if config not available
 *
 * Format in config:
 * MODELS_OPENROUTER=qwen/qwen3-coder:free,meta-llama/llama-3.3-70b,google/gemini-2.0-flash-exp:free
 * MODELS_OLLAMA=gptoss-20b,llama3.2,llama3.1
 * MODELS_OPENAI=gpt-4o,gpt-4o-mini
 * MODELS_ANTHROPIC=claude-3-5-sonnet-latest,claude-3-haiku-20240307
 */

function loadModelsFromConfig(): Model[] {
  const models: Model[] = [];

  try {
    // Load by provider (max 3 per provider)
    const providers: Array<{
      key: string;
      provider: Model["provider"];
      limit: number;
    }> = [
      { key: "MODELS_OLLAMA", provider: "ollama", limit: 3 },
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
          .filter((m) => m)
          .slice(0, limit); // Limit to N per provider

        for (const modelName of modelList) {
          // Generate nickName from model name
          let nickName = modelName
            .toLowerCase()
            .replace(/[/:.-]/g, "")
            .substring(0, 20); // Limit length

          // Special handling for common models
          if (modelName.includes("gpt-oss")) {
            nickName = "gptoss";
          } else if (modelName.includes("qwen")) {
            nickName = "qwen";
          } else if (modelName.includes("llama3.2")) {
            nickName = "llama32";
          } else if (modelName.includes("llama3.1")) {
            nickName = "llama31";
          } else if (modelName.includes("gemini-3.0")) {
            nickName = "gemini3";
          } else if (modelName.includes("gemini-2.5-pro")) {
            nickName = "pro";
          } else if (modelName.includes("gemini-2.5-flash-lite")) {
            nickName = "flash-lite";
          } else if (modelName.includes("gemini-2.5-flash")) {
            nickName = "flash";
          } else if (modelName.includes("gemini")) {
            nickName = "gemini-or"; // Generic fallback for other gemini, e.g. from OpenRouter
          } else if (modelName.includes("claude")) {
            nickName = modelName.includes("haiku") ? "haiku" : "sonnet";
          } else if (modelName.includes("gpt-4o")) {
            nickName = modelName.includes("mini") ? "gpt4mini" : "gpt4o";
          } else if (modelName.includes("llama-3-sonar-large")) {
            nickName = "sonar-pro";
          } else if (modelName.includes("llama-3-sonar-small")) {
            nickName = "sonar";
          } else if (modelName.includes("sonar-reasoning")) {
            nickName = "sonar-reasoning";
          }

          models.push({
            name: modelName,
            provider,
            nickName,
            description: `${provider.toUpperCase()} - ${modelName}`,
          });
        }
      }
    }

    if (models.length > 0) {
      logger.debug(`Loaded ${models.length} models from config`);
      return models;
    }
  } catch (error) {
    logger.debug(`Config-based models loading failed: ${error}`);
  }

  // Fallback to built-in defaults
  return getBuiltInModels();
}

function getBuiltInModels(): Model[] {
  const previewEnabled = getConfigValue('ENABLE_PREVIEW_FEATURES') === 'true';

  const googleModels: Model[] = [
    {
      name: "gemini-2.5-pro",
      provider: "google",
      nickName: "pro",
      description: "Gemini 2.5 Pro (deep reasoning)",
    },
    {
      name: "gemini-2.5-flash",
      provider: "google",
      nickName: "flash",
      description: "Gemini 2.5 Flash (fast & balanced)",
    },
    {
      name: "gemini-2.5-flash-lite",
      provider: "google",
      nickName: "flash-lite",
      description: "Gemini 2.5 Flash Lite (quick tasks)",
    },
  ];

  if (previewEnabled) {
    googleModels.unshift({
      name: "gemini-3.0-pro-latest", // Hypothetical latest model
      provider: "google",
      nickName: "gemini3",
      description: "Gemini 3 (Preview)",
    });
  }

  return [
    ...googleModels,
    // Ollama (local, max 3)
    {
      name: "gpt-oss:20b",
      provider: "ollama",
      nickName: "gptoss",
      description: "Local GPT-OSS 20B (RTX 3050 8GB friendly)",
    },
    {
      name: "llama3.2:latest",
      provider: "ollama",
      nickName: "llama32",
      description: "Local Llama 3.2",
    },
    {
      name: "llama3.1:latest",
      provider: "ollama",
      nickName: "llama31",
      description: "Local Llama 3.1",
    },

    // OpenRouter (cloud, max 3)
    {
      name: "qwen/qwen3-coder:free",
      provider: "openrouter",
      nickName: "qwen",
      description: "Qwen3 Coder 480B (free tier)",
    },
    {
      name: "meta-llama/llama-3.3-70b-instruct",
      provider: "openrouter",
      nickName: "llama33",
      description: "Llama 3.3 70B via OpenRouter",
    },
    {
      name: "google/gemini-2.0-flash-exp:free",
      provider: "openrouter",
      nickName: "gemini-or",
      description: "Google Gemini 2.0 Flash via OpenRouter",
    },

    // OpenAI (optional, max 3)
    {
      name: "gpt-4o",
      provider: "openai",
      nickName: "gpt4o",
      description: "GPT-4o",
    },
    {
      name: "gpt-4o-mini",
      provider: "openai",
      nickName: "gpt4mini",
      description: "GPT-4o Mini (fast/cheap)",
    },

    // Anthropic Claude (optional, max 3)
    {
      name: "claude-3-5-sonnet-latest",
      provider: "anthropic",
      nickName: "sonnet",
      description: "Claude 3.5 Sonnet",
    },
    {
      name: "claude-3-haiku-20240307",
      provider: "anthropic",
      nickName: "haiku",
      description: "Claude 3 Haiku (fast)",
    },
    // Perplexity (optional, max 3)
    {
      name: "llama-3-sonar-small-32k-online",
      provider: "perplexity",
      nickName: "sonar",
      description: "Perplexity Sonar Small",
    },
    {
      name: "llama-3-sonar-large-32k-online",
      provider: "perplexity",
      nickName: "sonar-pro",
      description: "Perplexity Sonar Large",
    },
  ];
}

// Load models from config or fallback to built-in
export const models: Model[] = loadModelsFromConfig();
