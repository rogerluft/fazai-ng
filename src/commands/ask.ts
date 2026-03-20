import chalk from "chalk";
import { models, getDefaultModel } from "../models";
import { checkAPIKey, getAndSetAPIKey } from "../apiKeyUtils-fazai";
import { askAI } from "../askAI";
import { logger } from "../logger";
import { FALLBACK_CHAIN, type ProviderName } from "../utils/provider-fallback";
import { appendConversationEntry } from "../memory";
import { storeMemoryInQdrant } from "../services/memory-loader";

async function checkAndSetAPIKey(selectedModel: (typeof models)[number]) {
  const provider = selectedModel.provider;
  const apiKeyPresent = checkAPIKey(provider);

  if (!apiKeyPresent) {
    await getAndSetAPIKey(provider);
  }
}

/**
 * Get the first available model from fallback chain
 *
 * Uses FALLBACK_CHAIN to find the first provider that has:
 * 1. At least one configured model
 * 2. API key (for cloud providers) or is local (llama/ollama)
 *
 * This ensures the default model is always from a working provider.
 */
function getFirstAvailableModel(): (typeof models)[number] {
  // Try each provider in fallback chain order
  for (const provider of FALLBACK_CHAIN as ProviderName[]) {
    // Check if provider has models configured
    const providerModels = models.filter((m) => m.provider === provider);

    if (providerModels.length > 0) {
      // Local providers don't need API key
      if (provider === "llama" || provider === "ollama") {
        logger.debug(`Using default model from ${provider}: ${providerModels[0].name}`);
        return providerModels[0];
      }

      // Cloud providers need API key
      if (checkAPIKey(provider)) {
        logger.debug(`Using default model from ${provider}: ${providerModels[0].name}`);
        return providerModels[0];
      }
    }
  }

  // Fallback: if no provider in fallback chain has models, use first model overall
  logger.warn("⚠️  No provider from fallback chain available, using first configured model");
  return models[0];
}

function showAskHelp(): void {
  console.log(chalk.bold.cyan("\n🤖 FazAI Ask Command\n"));
  console.log("Ask a general question to an AI model.\n");

  console.log(chalk.bold("USAGE:"));
  console.log("  fazai ask \"<question>\" [model_name]\n");

  console.log(chalk.bold("OPTIONS:"));
  console.log("  model_name    (optional) The name of the model to use.\n");

  console.log(chalk.bold("EXAMPLES:"));
  console.log("  fazai ask \"How to configure nginx as a reverse proxy?\"");
  console.log("  fazai ask \"Explain the difference between systemctl and service\" llama3");
}

export async function handleAskCommand(inputs: string[]): Promise<void> {
  if (inputs.length === 0 || inputs.includes("--help") || inputs.includes("-h")) {
    showAskHelp();
    process.exit(0);
  }
  // Check if last arg is a model name (exact match)
  const lastArg = inputs[inputs.length - 1];
  let selectedModel = models.find((model) => model.name === lastArg);

  let questionParts: string[];
  if (selectedModel) {
    // Model specified, question is everything except first (ask) and last (model)
    questionParts = inputs.slice(0, -1);
  } else {
    // No model specified, use first available model from fallback chain
    selectedModel = getFirstAvailableModel();
    questionParts = inputs;
  }

  const question = questionParts.join(" ");

  if (!question) {
    logger.error('Usage: fazai ask "Your question here" [model-name]');
    logger.info('Example: fazai ask "How to configure nginx?" gpt-4o');
    logger.info(
      '         fazai ask "Best practices for SSH?" llama-3-sonar-small-32k-online'
    );
    process.exit(1);
  }

  await checkAndSetAPIKey(selectedModel);

  logger.info(chalk.blue("🤔 Fazendo pergunta..."));
  logger.info(
    chalk.gray(`Modelo: ${selectedModel.name} (${selectedModel.provider})`)
  );

  const sessionId = `ask-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // Persist user message (memory.json + Qdrant)
  appendConversationEntry({ timestamp, role: "user", content: question });
  storeMemoryInQdrant({ role: "user", content: question, timestamp, sessionId }).catch((err) => {
    logger.debug(`Failed to store user memory: ${err.message}`);
  });

  const answerStream = askAI(
    "",
    question,
    selectedModel.name,
    selectedModel.provider,
    true
  );

  let fullResponse = "";
  for await (const chunk of answerStream) {
    fullResponse += chunk;
    process.stdout.write(chunk);
  }
  logger.info("");

  // Persist assistant response (memory.json + Qdrant)
  if (fullResponse.length >= 10) {
    const responseTimestamp = new Date().toISOString();
    appendConversationEntry({ timestamp: responseTimestamp, role: "assistant", content: fullResponse });
    storeMemoryInQdrant({ role: "assistant", content: fullResponse, timestamp: responseTimestamp, sessionId }).catch((err) => {
      logger.debug(`Failed to store assistant memory: ${err.message}`);
    });
  }
}
