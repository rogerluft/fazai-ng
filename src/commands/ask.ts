
import chalk from "chalk";
import { models } from "../models";
import { checkAPIKey, getAndSetAPIKey } from "../apiKeyUtils-fazai";
import { askAI } from "../askAI";
import { logger } from "../logger";

async function checkAndSetAPIKey(selectedModel: (typeof models)[number]) {
  const provider = selectedModel.provider;
  const apiKeyPresent = checkAPIKey(provider);

  if (!apiKeyPresent) {
    await getAndSetAPIKey(provider);
  }
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
    // No model, use default and question is everything except first (ask)
    selectedModel = models[0];
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

  const answerStream = askAI(
    "",
    question,
    selectedModel.name,
    selectedModel.provider,
    true
  );

  for await (const chunk of answerStream) {
    process.stdout.write(chunk);
  }
  logger.info("");
}
