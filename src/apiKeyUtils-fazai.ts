import chalk from "chalk";
import { password } from "@inquirer/prompts";
import { configFileExists, getConfigFilePath, getConfigValue, listConfigEntries, setConfigValue } from "./config";
import { logger } from "./logger";

export function checkAPIKey(provider: string): boolean {
  // Ollama não precisa de API key
  if (provider === "ollama") {
    const baseUrl = getOllamaBaseUrl();
    if (baseUrl) {
      process.env.OLLAMA_BASE_URL = baseUrl;
    }
    return true; // Ollama sempre retorna true
  }

  // llama.cpp server também não precisa de API key
  if (provider === "llama") {
    const serverUrl = getLlamaServerUrl();
    if (serverUrl) {
      process.env.LLAMA_SERVER_URL = serverUrl;
    }
    return true; // llama.cpp sempre retorna true
  }

  // For Anthropic, check OAuth token and API key
  if (provider === "anthropic") {
    // Priority: CLAUDE_CODE_OAUTH_TOKEN > ANTHROPIC_OAUTH_TOKEN > ANTHROPIC_API_KEY
    const oauthToken =
      process.env.CLAUDE_CODE_OAUTH_TOKEN ||
      getConfigValue("CLAUDE_CODE_OAUTH_TOKEN") ||
      getConfigValue("ANTHROPIC_OAUTH_TOKEN");
    const apiKey = getConfigValue("ANTHROPIC_API_KEY");

    if (oauthToken) {
      // SDK reads ANTHROPIC_AUTH_TOKEN for Bearer auth
      process.env.ANTHROPIC_AUTH_TOKEN = oauthToken;
      return true;
    }

    if (apiKey) {
      process.env.ANTHROPIC_API_KEY = apiKey;
      return true;
    }

    return false;
  }

  const apiKey = getAPIKeyFromConfig(provider);
  if (apiKey) {
    // Definir a variável de ambiente para o SDK
    const envVar = getEnvVarName(provider);
    process.env[envVar] = apiKey;
  }
  return !!apiKey;
}

export async function getAndSetAPIKey(provider: string): Promise<string> {
  // Ollama não precisa de API key
  if (provider === "ollama") {
    const baseUrl = getOllamaBaseUrl();
    if (baseUrl) {
      process.env.OLLAMA_BASE_URL = baseUrl;
      logger.info(chalk.green(`✅ Ollama configurado: ${baseUrl}`));
    } else {
      logger.warn(chalk.yellow(`⚠️  OLLAMA_BASE_URL não configurado no ${configFileLabel()}, usando http://localhost:11434`));
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    }
    return "ollama"; // Retorna string dummy
  }

  // llama.cpp server também não precisa de API key
  if (provider === "llama") {
    const serverUrl = getLlamaServerUrl();
    if (serverUrl) {
      process.env.LLAMA_SERVER_URL = serverUrl;
      logger.info(chalk.green(`✅ llama.cpp configurado: ${serverUrl}`));
    } else {
      logger.warn(chalk.yellow(`⚠️  LLAMA_SERVER_URL não configurado no ${configFileLabel()}, usando http://localhost:11430`));
      process.env.LLAMA_SERVER_URL = "http://localhost:11430";
    }
    return "llama"; // Retorna string dummy
  }

  let apiKey = getAPIKeyFromConfig(provider);

  if (!apiKey) {
    logger.warn(chalk.yellow(`\nAPI key para ${provider} não encontrada no ${configFileLabel()}.`));
    
    // Mostrar instruções específicas por provider
    if (provider === "openrouter") {
      logger.info(chalk.cyan(`\n💡 Como obter sua chave OpenRouter:`));
      logger.info(chalk.cyan(`   1. Acesse: https://openrouter.ai/keys`));
      logger.info(chalk.cyan(`   2. Faça login e crie uma nova chave`));
      logger.info(chalk.cyan(`   3. Adicione créditos em https://openrouter.ai/credits\n`));
    }
    
    const key = await password({
      message: `Digite sua chave API do ${provider.charAt(0).toUpperCase() + provider.slice(1)}:`,
      mask: "*",
    });

    // Salvar no arquivo de configuração
    saveAPIKeyToConfig(provider, key);
    apiKey = key;
  }

  // Definir a variável de ambiente para o SDK
  const envVar = getEnvVarName(provider);
  process.env[envVar] = apiKey;

  return apiKey;
}

function getAPIKeyFromConfig(provider: string): string | undefined {
  const envVar = getEnvVarName(provider);
  return getConfigValue(envVar);
}

function saveAPIKeyToConfig(provider: string, apiKey: string): void {
  const envVar = getEnvVarName(provider);
  try {
    setConfigValue(envVar, apiKey);
    logger.info(chalk.green(`✅ Chave API salva em ${configFileLabel()}`));
  } catch (error) {
    logger.error(`❌ Erro ao salvar chave API em ${configFileLabel()}:`, error);
  }
}

function getEnvVarName(provider: string): string {
  switch (provider) {
    case "anthropic":
      // OAuth (Bearer) takes precedence over API key (x-api-key)
      if (process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN) {
        return "ANTHROPIC_AUTH_TOKEN";
      }
      return "ANTHROPIC_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "openrouter":
      return "OPENROUTER_API_KEY";
    case "google":
      return "GOOGLE_API_KEY";
    case "fireworks":
      return "FIREWORKS_API_KEY";
    case "ollama":
      return "OLLAMA_BASE_URL";
    case "llama":
      return "LLAMA_SERVER_URL";
    case "perplexity":
      return "PERPLEXITY_API_KEY";
    default:
      throw new Error(`Provider não suportado: ${provider}`);
  }
}

function getOllamaBaseUrl(): string | undefined {
  return getConfigValue("OLLAMA_BASE_URL");
}

function getLlamaServerUrl(): string | undefined {
  return getConfigValue("LLAMA_SERVER_URL");
}

// Função para listar todas as chaves configuradas
export function listConfiguredKeys(): void {
  try {
    if (!configFileExists()) {
      logger.warn(chalk.yellow(`Arquivo ${configFileLabel()} não encontrado.`));
      return;
    }

    const entries = listConfigEntries();
    logger.info(chalk.cyan(`\n🔑 Configurações em ${configFileLabel()}:`));

    const providers = ["llama", "ollama", "openrouter", "anthropic", "openai", "perplexity", "google"];
    let found = false;

    for (const provider of providers) {
      const envVar = getEnvVarName(provider);
      const value = entries[envVar];

      if (value) {
        if (provider === "ollama") {
          logger.info(`  ${provider}: ${value || "não definida"}`);
        } else {
          const masked = "*".repeat(Math.min(value.length, 20));
          logger.info(`  ${provider}: ${masked}`);
        }
        found = true;
      }
    }

    if (!found) {
      logger.info(chalk.gray("  Nenhuma configuração encontrada."));
    }

  } catch (error) {
    logger.error(`Erro ao listar chaves:`, error);
  }
}

function configFileLabel(): string {
  return getConfigFilePath();
}
