#!/usr/bin/env node
import { input } from "@inquirer/prompts";
import chalk from "chalk";
import { models } from "./models";
import { checkAPIKey, getAndSetAPIKey, listConfiguredKeys } from "./apiKeyUtils-fazai";
import { getLinuxCommandsFromAI } from "./linux-admin";
import { collectSystemInfo } from "./system-info";
import { LinuxCommandExecutor } from "./linux-executor";
import { askAI } from "./askAI";
import { LinuxCommand } from "./types-linux";
import { ResearchCoordinator } from "./research";
import { runCliMode } from "./cli-mode";
import { initLogger, logger } from "./logger";
import type { VectorValidationOptions, VectorValidationResult } from "./vector-store";
import { importConversations } from "./conversation-importer";
import { decomposeTask } from "./agentic/task-decomposer";
import { DAGExecutor } from "./agentic/dag-executor";
import { handleGitHubCommand } from "./commands/github";

import { getConfigValue } from "./config";

function displayHelp() {
  const previewEnabled = getConfigValue('ENABLE_PREVIEW_FEATURES') === 'true';

  let modelsHelpText = `
Available Models:
  Google Gemini (requer GOOGLE_API_KEY):`;
  
  if (previewEnabled) {
    modelsHelpText = `
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                                                                           │
  │ Gemini 3 is now available.                                                │
  │ To use Gemini 3, enable "Preview features" in /etc/fazai/fazai.conf.      │
  │ Learn more at https://goo.gle/enable-preview-features                     │
  │                                                                           │
  └───────────────────────────────────────────────────────────────────────────┘

  Select Model:
  ● 1. Auto (default)
       Let the system choose the best model for your task.
    2. Pro (pro)
       For complex tasks that require deep reasoning and creativity
    3. Flash (flash)
       For tasks that need a balance of speed and reasoning
    4. Flash-Lite (flash-lite)
       For simple tasks that need to be done quickly

  To use a specific Gemini model on startup, use the --model flag.
`;
  } else {
    modelsHelpText += `
    gemini2flash   - Gemini 2.0 Flash Exp (rápido e gratuito)
    gemini15pro    - Gemini 1.5 Pro (mais capaz)
    gemini15flash  - Gemini 1.5 Flash (balanceado)
    `;
  }

  modelsHelpText += `
  OpenRouter (requer API key - modelos gratuitos disponíveis):
    qwen           - Qwen 3 Coder Free (DEFAULT)
    gemini-or      - Gemini 2.0 Flash via OpenRouter
    llama33        - Llama 3.3 70B Free
    deepseek       - DeepSeek R1T2 Chimera Free

  OpenAI (requer API key):
    gpt4mini    - GPT-4o-mini (rápido e barato)
    gpt4o       - GPT-4o (mais recente e inteligente)
    gpt4turbo   - GPT-4 Turbo

  Claude (Anthropic - requer API key):
    sonnet35    - Claude 3.5 Sonnet (mais inteligente)
    haiku       - Claude 3 Haiku (rápido e barato)

  Ollama (local - configure OLLAMA_BASE_URL no fazai.conf):
    gptoss-20b  - GPT-OSS 20B (local no servidor)
    llama32     - Llama 3.2
    mistral     - Mistral

  Perplexity (requer API key):
    sonar       - Perplexity Sonar Small
    sonar-pro   - Perplexity Sonar Large
    sonar-reasoning - Perplexity Sonar Reasoning
`;

  const helpText = `
🖥️  FAZAI - Administrador Linux Inteligente com IA

Usage:
  fazai [options] [model-nickname]           # Linux Admin Mode (default)
  fazai ask "Your question here"             # General AI questions
  fazai config                               # List configured API keys
  fazai completion                           # Print available CLI completions
  fazai search "query"                       # Manual research via Context7/Web
  fazai vector [validate|recreate]           # Valida collections vetoriais (Qdrant)
  fazai import <file> --source=<claude|chatgpt>  # Importa conversas para Qdrant
  fazai sync                                 # Sync repository changes to /opt/fazai
  fazai cloudflare <action>                  # Manage Cloudflare (zones, dns, workers)
  fazai cf zones                             # Cloudflare: list zones
  fazai cf dns list <zoneId>                 # Cloudflare: manage DNS
  fazai github <action>                      # GitHub integration (auth, repos, issues, etc)

Options:
  --dry-run                Simulate commands without executing
  --cli                    Open interactive CLI (chat + /exec)
  --debug                  Ativa logs detalhados (equivalente a --verbose)
  --verbose                Alias para --debug
  --log-file <path>        Define caminho explícito para o arquivo de log
  --auto-research          Reativar pesquisa automática após falhas
  --yolo, -y               Execute all commands without confirmation (DANGEROUS!)
  --help, -h               Show this help message

Examples:
  # Admin mode (default)
  fazai
  fazai --dry-run           # Safe simulation mode
  fazai haiku               # Use Claude Haiku (faster/cheaper)

  # General questions
  fazai ask "Como configurar nginx como proxy reverso?"
  fazai ask "Explicar diferença entre systemctl e service"

  # Configuration
  fazai config              # Show configured API keys
${modelsHelpText}`;
  logger.info(helpText);
}

function parseVectorArgs(rawArgs: string[]): { options: VectorValidationOptions; action: "validate" | "recreate" } {
  const options: VectorValidationOptions = {};
  let action: "validate" | "recreate" = "validate";

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (!arg) {
      continue;
    }

    if (arg === "validate") {
      action = "validate";
      continue;
    }

    if (arg === "recreate" || arg === "reset") {
      action = "recreate";
      options.recreate = true;
      continue;
    }

    if (arg === "--recreate" || arg === "--reset") {
      options.recreate = true;
      action = "recreate";
      continue;
    }

    if (arg === "--provider" && rawArgs[i + 1]) {
      options.provider = parseProvider(rawArgs[i + 1]);
      i += 1;
      continue;
    }

    if (arg.startsWith("--provider=")) {
      options.provider = parseProvider(arg.split("=")[1]);
      continue;
    }

    if (arg === "--dimension" && rawArgs[i + 1]) {
      options.dimension = parseDimension(rawArgs[i + 1]);
      i += 1;
      continue;
    }

    if (arg.startsWith("--dimension=")) {
      options.dimension = parseDimension(arg.split("=")[1]);
      continue;
    }

    if (arg === "--distance" && rawArgs[i + 1]) {
      const parsedDistance = parseDistance(rawArgs[i + 1]);
      if (parsedDistance) {
        options.distance = parsedDistance;
      }
      i += 1;
      continue;
    }

    if (arg.startsWith("--distance=")) {
      const parsedDistance = parseDistance(arg.split("=")[1]);
      if (parsedDistance) {
        options.distance = parsedDistance;
      }
      continue;
    }
  }

  if (action === "recreate" && options.recreate !== true) {
    options.recreate = true;
  }

  return { options, action };
}

function parseProvider(raw?: string): VectorValidationOptions["provider"] {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "qdrant") {
    return "qdrant";
  }
  if (normalized === "milvus" || normalized === "zilliz") {
    return "milvus";
  }

  logger.warn(chalk.yellow(`⚠️  Provedor desconhecido "${raw}". Use "qdrant" ou "milvus".`));
  return undefined;
}

function parseDimension(raw?: string): number | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    logger.warn(chalk.yellow(`⚠️  Dimensão inválida "${raw}". Informe um inteiro maior que zero.`));
    return undefined;
  }
  return parsed;
}

function parseDistance(raw?: string): VectorValidationOptions["distance"] {
  if (!raw) {
    return undefined;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "cosine" || normalized === "cos" || normalized === "angular") {
    return "Cosine";
  }
  if (normalized === "euclid" || normalized === "l2" || normalized === "euclidean") {
    return "Euclid";
  }
  if (normalized === "dot" || normalized === "dot_product" || normalized === "ip") {
    return "Dot";
  }
  logger.warn(chalk.yellow(`⚠️  Distância desconhecida "${raw}". Valores aceitos: cosine, euclid, dot.`));
  return undefined;
}

async function handleVectorCommand(rawArgs: string[]): Promise<void> {
  const { options, action } = parseVectorArgs(rawArgs);
  const { validateVectorCollections } = await import("./vector-store");
  const result = await validateVectorCollections(options);

  reportVectorResult(result, action);

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

function reportVectorResult(result: VectorValidationResult, action: "validate" | "recreate"): void {
  logger.info(chalk.cyan(`\n📦 Vetor store: ${result.provider} (${action})`));
  logger.info(chalk.gray(`Dimensão: ${result.dimension} · Distância: ${result.distance}`));

  if (result.created.length) {
    logger.info(chalk.green(`✅ Criadas: ${result.created.join(", ")}`));
  }

  if (result.verified.length) {
    logger.info(chalk.green(`✅ Já em conformidade: ${result.verified.join(", ")}`));
  }

  if (result.updated.length) {
    logger.info(chalk.yellow(`ℹ️  Necessitam ajuste manual: ${result.updated.join(", ")}`));
  }

  if (!result.created.length && !result.verified.length && !result.updated.length) {
    logger.info(chalk.gray("Nenhuma collection processada."));
  }

  if (result.errors.length) {
    logger.error(chalk.red("\n❌ Ocorreram erros:"));
    for (const entry of result.errors) {
      logger.error(` - ${entry.collection}: ${entry.message}`);
    }
  } else {
    logger.info(chalk.green("\nTudo certo com as collections vetoriais."));
  }
}

async function checkAndSetAPIKey(selectedModel: (typeof models)[number]) {
  const provider = selectedModel.provider;
  const apiKeyPresent = checkAPIKey(provider);

  if (!apiKeyPresent) {
    await getAndSetAPIKey(provider);
  }

  logger.info(chalk.green(`✅ API key configurada (${provider})`));
}

async function handleImportCommand(rawArgs: string[]): Promise<void> {
  // Parse argumentos
  let filePath: string | undefined;
  let source: "claude" | "chatgpt" | undefined;
  let recursive = false;
  let extractKnowledge = true;
  let extractLearning = true;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === "--source" && rawArgs[i + 1]) {
      const sourceArg = rawArgs[i + 1].toLowerCase();
      if (sourceArg === "claude" || sourceArg === "chatgpt") {
        source = sourceArg;
      }
      i++;
      continue;
    }

    if (arg.startsWith("--source=")) {
      const sourceArg = arg.split("=")[1].toLowerCase();
      if (sourceArg === "claude" || sourceArg === "chatgpt") {
        source = sourceArg;
      }
      continue;
    }

    if (arg === "--recursive" || arg === "-r") {
      recursive = true;
      continue;
    }

    if (arg === "--no-knowledge") {
      extractKnowledge = false;
      continue;
    }

    if (arg === "--no-learning") {
      extractLearning = false;
      continue;
    }

    // Primeiro argumento sem -- é o filepath
    if (!arg.startsWith("--") && !filePath) {
      filePath = arg;
    }
  }

  // Validar argumentos
  if (!filePath) {
    logger.error(chalk.red("✗ Erro: caminho do arquivo é obrigatório"));
    logger.info(chalk.cyan("\nUso:"));
    logger.info("  fazai import <arquivo> --source=<claude|chatgpt>");
    logger.info("  fazai import <diretório> --source=claude --recursive");
    logger.info("");
    logger.info(chalk.cyan("Opções:"));
    logger.info("  --source=<claude|chatgpt>  Fonte das conversas (obrigatório)");
    logger.info("  --recursive, -r            Processar diretório recursivamente");
    logger.info("  --no-knowledge             Não extrair conhecimento técnico");
    logger.info("  --no-learning              Não extrair padrões de aprendizado");
    return;
  }

  if (!source) {
    logger.error(chalk.red("✗ Erro: --source é obrigatório (claude ou chatgpt)"));
    logger.info(chalk.cyan("\nExemplo:"));
    logger.info("  fazai import conversas.json --source=claude");
    return;
  }

  // Executar importação
  try {
    const result = await importConversations(filePath, source, {
      recursive,
      extractKnowledge,
      extractLearning,
    });

    // Reportar resultados
    logger.info("");
    logger.info(chalk.green("✅ Importação concluída!"));
    logger.info("");
    logger.info(chalk.cyan("📊 Estatísticas:"));
    logger.info(`  Conversas importadas: ${chalk.green(result.imported)}`);
    logger.info(`  Conversas puladas: ${chalk.yellow(result.skipped)}`);
    logger.info("");
    logger.info(chalk.cyan("📦 Inserções no Qdrant:"));
    logger.info(`  fazai_memory: ${chalk.green(result.stats.memoryEntries)} mensagens`);
    logger.info(`  fazai_kb: ${chalk.green(result.stats.kbEntries)} soluções técnicas`);
    logger.info(`  fazai_learning: ${chalk.green(result.stats.learningEntries)} padrões de aprendizado`);

    if (result.errors.length > 0) {
      logger.info("");
      logger.warn(chalk.yellow(`⚠️  ${result.errors.length} erro(s) encontrado(s):`));
      result.errors.slice(0, 5).forEach((err) => {
        logger.warn(chalk.gray(`  - ${err}`));
      });

      if (result.errors.length > 5) {
        logger.warn(chalk.gray(`  ... e mais ${result.errors.length - 5} erro(s)`));
      }
    }

    logger.info("");
  } catch (error: any) {
    logger.error(chalk.red(`✗ Erro fatal na importação: ${error.message}`));
    logger.debug(error.stack);
    process.exit(1);
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const debugFlag = rawArgs.includes("--debug") || rawArgs.includes("--verbose");
  const verboseFlag = rawArgs.includes("--verbose");

  let logFileOverride: string | undefined;
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--log-file" && rawArgs[i + 1]) {
      logFileOverride = rawArgs[i + 1];
      break;
    }
    if (arg.startsWith("--log-file=")) {
      logFileOverride = arg.split("=")[1];
      break;
    }
  }

  initLogger({
    levelOverride: debugFlag || verboseFlag ? "debug" : undefined,
    logFilePathOverride: logFileOverride,
  });

  let inputs = process.argv.slice(2);

  if (inputs.includes("--cli")) {
    await runCliMode();
    return;
  }

  // Show help if no arguments or help flag is present
  if (
    inputs.length === 0 ||
    inputs.includes("--help") ||
    inputs.includes("-h")
  ) {
    displayHelp();
    return;
  }

  // Config command
  if (inputs[0] === "config") {
    listConfiguredKeys();
    return;
  }

  // Sync command
  if (inputs[0] === "sync") {
    const { syncCommand } = await import("./commands/sync");
    await syncCommand({ 
      verbose: debugFlag || verboseFlag,
      dryRun: inputs.includes("--dry-run")
    });
    return;
  }

  // Cloudflare command
  if (inputs[0] === "cf" || inputs[0] === "cloudflare") {
    const { handleCloudflare } = await import("./commands/cloudflare");
    await handleCloudflare(inputs.slice(1));
    return;
  }

  // GitHub command
  if (inputs[0] === "github") {
    await handleGitHubCommand(inputs.slice(1));
    return;
  }

  if (inputs[0] === "completion") {
    const suggestions = [
      "ask",
      "config",
      "completion",
      "search",
      "vector",
      "import",
      "sync",
      "cf",
      "cloudflare",
      "--debug",
      "--verbose",
      "--log-file",
      "--help",
      "--dry-run",
      "--cli",
      "--auto-research",
      "--yolo",
      ...models.map((model) => model.nickName),
    ];
    logger.info(suggestions.join("\n"));
    return;
  }

  if (inputs[0] === "vector") {
    await handleVectorCommand(inputs.slice(1));
    return;
  }

  if (inputs[0] === "import") {
    await handleImportCommand(inputs.slice(1));
    return;
  }

  let dryRun = false;
  let yoloMode = false;
  let autoResearchOnFailure = false;

  // Parse special arguments
  inputs = inputs.filter((input) => {
    if (input === "--dry-run") {
      dryRun = true;
      return false;
    }
    if (input === "--yolo" || input === "-y") {
      yoloMode = true;
      return false;
    }
    if (input === "--debug" || input === "--verbose") {
      return false;
    }
    if (input === "--log-file") {
      return false;
    }
    if (input.startsWith("--log-file=")) {
      return false;
    }
    if (input === "--auto-research") {
      autoResearchOnFailure = true;
      return false;
    }
    if (input === "--help" || input === "-h") {
      displayHelp();
      process.exit(0);
    }
    if (input === "--version" || input === "-v") {
      console.log(`FazAI v${require('../package.json').version}`);
      process.exit(0);
    }
    return true;
  });

  // Manual research command
  if (inputs[0] === "search") {
    const query = inputs.slice(1).join(" ");
    if (!query) {
      logger.error('Usage: fazai search "Your query here"');
      process.exit(1);
    }

    const researchCoordinator = new ResearchCoordinator();
    await researchCoordinator.research(query, { reason: "Pesquisa manual", trigger: "pre-execution" });
    return;
  }

  // Ask mode (general questions)
  if (inputs[0] === "ask") {
    // Check if last arg is a model nickname
    const lastArg = inputs[inputs.length - 1];
    let selectedModel = models.find((model) => model.nickName === lastArg);
    
    let questionParts: string[];
    if (selectedModel) {
      // Model specified, question is everything except first (ask) and last (model)
      questionParts = inputs.slice(1, -1);
    } else {
      // No model, use default and question is everything except first (ask)
      selectedModel = models[0];
      questionParts = inputs.slice(1);
    }

    const question = questionParts.join(" ");

    if (!question) {
      logger.error('Usage: fazai ask "Your question here" [model]');
      process.exit(1);
    }

    await checkAndSetAPIKey(selectedModel);

    logger.info(chalk.blue("🤔 Fazendo pergunta..."));

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
    return;
  }

  // Admin Mode (DEFAULT!)
  logger.info(chalk.cyan("\n🖥️  FAZAI - MODO ADMINISTRADOR LINUX"));
  logger.info(chalk.gray("Administração inteligente de sistemas Linux\n"));

  // Check if direct command mode (first arg is not a model nickname and not a flag)
  let directCommand: string | null = null;
  let selectedModel: typeof models[number] | undefined;

  // Try to find model in inputs (can be last or second-to-last)
  if (inputs.length > 0) {
    // Check if last arg is a model
    const lastArg = inputs[inputs.length - 1];
    logger.debug(`Parsing model: inputs=${JSON.stringify(inputs)}, lastArg=${lastArg}`);
    selectedModel = models.find((model) => model.nickName === lastArg);
    logger.debug(`Found model: ${selectedModel ? selectedModel.nickName : 'none'}`);

    if (selectedModel && inputs.length > 1) {
      // Model found at end, everything before is the command
      directCommand = inputs.slice(0, -1).join(" ");
    } else if (inputs.length > 1) {
      // Check if second-to-last is a model (task might be last)
      const secondLast = inputs[inputs.length - 2];
      const modelAtSecondLast = models.find((model) => model.nickName === secondLast);

      if (modelAtSecondLast) {
        selectedModel = modelAtSecondLast;
        // Everything except second-to-last is command
        directCommand = inputs.filter((_, i) => i !== inputs.length - 2).join(" ");
      } else {
        // No model found, all inputs are the command
        directCommand = inputs.join(" ");
      }
    } else {
      // Single input, no model specified
      directCommand = inputs[0];
    }
  }

  // Use default model if none specified
  if (!selectedModel) {
    const previewEnabled = getConfigValue('ENABLE_PREVIEW_FEATURES') === 'true';
    if (previewEnabled) {
      selectedModel = models.find(m => m.nickName === 'gemini3');
      logger.info('🤖 Auto-selecting preview model: Gemini 3');
    }
    // If preview not enabled or gemini3 not found, fallback to the absolute default
    if (!selectedModel) {
      selectedModel = models[0];
    }
  }

  logger.info(`Modelo: ${selectedModel ? selectedModel.nickName : models[0].nickName} (${selectedModel ? selectedModel.name : models[0].name})\n`);
  if (!selectedModel) selectedModel = models[0];

  await checkAndSetAPIKey(selectedModel);
  const researchCoordinator = new ResearchCoordinator({ researchOnFailure: autoResearchOnFailure });

  // Collect system info
  logger.info(chalk.gray("Coletando informações do sistema..."));
  const systemInfo = await collectSystemInfo();
  logger.info(chalk.green("✅ Sistema analisado\n"));

  if (dryRun) {
    logger.info(chalk.yellow("🔍 MODO DRY-RUN - Simulação apenas\n"));
  }

  if (yoloMode) {
    logger.warn(chalk.red("⚡ MODO YOLO - Execução automática sem confirmações!\n"));
  }

  // Get task (either from direct command or prompt)
  const task = directCommand || await input({
    message: "O que você precisa fazer? ",
    validate: (input: string) => input.trim() !== "" || "Tarefa não pode estar vazia",
  });

  // MODO NORMAL: Execução tradicional
  const commandStream = getLinuxCommandsFromAI(
    systemInfo,
    task,
    selectedModel.name,
    selectedModel.provider
  );

  // Execute commands
  const executor = new LinuxCommandExecutor(dryRun, researchCoordinator);
  let commandCount = 0;
  const attemptedCommands = new Set<string>();
  const maxRetryCycles = 2;

  const requestAlternativeCommands = async (
    failureContext: {
      command: LinuxCommand;
      output: string;
      attempts: number;
    }
  ): Promise<LinuxCommand[]> => {
    const attemptedList = Array.from(attemptedCommands);
    const attemptedSection =
      attemptedList.length > 0
        ? `\n\nComandos já tentados (não repita estes exatamente):\n- ${attemptedList.join("\n- ")}`
        : "";

    const retryTask = `${task}

O comando abaixo falhou:
Comando: ${failureContext.command.command}
Erro/saída:
${failureContext.output}

Gere uma nova sequência de comandos para atingir o mesmo objetivo, evitando repetir os comandos já usados e propondo uma abordagem alternativa.${attemptedSection}
`;

    const altStream = getLinuxCommandsFromAI(
      systemInfo,
      retryTask,
      selectedModel.name,
      selectedModel.provider
    );

    const alternatives: LinuxCommand[] = [];

    for await (const packet of altStream) {
      if (packet.type === "command") {
        alternatives.push(packet.command);
      } else if (packet.type === "allcommands") {
        break;
      } else if (packet.type === "error") {
        logger.error(`❌ Erro ao gerar alternativa: ${packet.error}`);
      }
    }

    return alternatives;
  };

  const tryAlternativeApproach = async (
    failedCommand: LinuxCommand,
    failureOutput: string
  ): Promise<boolean> => {
    let lastOutput = failureOutput;
    let lastCommand = failedCommand;

    for (let cycle = 1; cycle <= maxRetryCycles; cycle++) {
      logger.info(chalk.yellow(`\n⚙️  Tentando abordagem alternativa (${cycle}/${maxRetryCycles})...`));
      const alternatives = await requestAlternativeCommands({
        command: lastCommand,
        output: lastOutput,
        attempts: cycle,
      });

      if (alternatives.length === 0) {
        logger.warn(chalk.red("Nenhuma alternativa fornecida pela IA."));
        return false;
      }

      for (const alternative of alternatives) {
        if (attemptedCommands.has(alternative.command)) {
          continue;
        }

        attemptedCommands.add(alternative.command);
        commandCount++;
        logger.info(chalk.blue(`\n🔧 Comando ${commandCount} (alternativa):`));
        const altResult = await executor.executeCommand(alternative);

        if (altResult.success) {
          logger.info(chalk.green("✅ Abordagem alternativa executada com sucesso"));
          return true;
        }

        logger.warn(chalk.red("❌ Alternativa falhou. Avaliando próxima opção..."));
        lastOutput = altResult.output;
        lastCommand = alternative;
      }
    }

    logger.warn(chalk.red("⚠️  Nenhuma alternativa teve sucesso após múltiplas tentativas."));
    return false;
  };

  for await (const commandPacket of commandStream) {
    if (commandPacket.type === "command") {
      commandCount++;
      logger.info(chalk.blue(`\n🔧 Comando ${commandCount}:`));
      attemptedCommands.add(commandPacket.command.command);
      const result = await executor.executeCommand(commandPacket.command);

      if (!result.success && !dryRun) {
        await tryAlternativeApproach(commandPacket.command, result.output);
      }
    } else if (commandPacket.type === "allcommands") {
      logger.info(chalk.green(`\n✅ ${commandCount} comandos processados`));

      if (!dryRun) {
        const history = executor.getExecutionHistory();
        if (history.length > 0) {
          logger.info(chalk.gray("\n📋 Histórico:"));
          history.forEach((entry, index) => {
            const status = entry.success ? chalk.green("✅") : chalk.red("❌");
            logger.info(`  ${index + 1}. ${status} ${entry.command.command}`);
          });
        }
      }
      break;
    } else if (commandPacket.type === "error") {
      logger.error(`❌ Erro: ${commandPacket.error}`);
      break;
    }
  }

  logger.info(chalk.cyan("\n⭐ FAZAI - Administração Linux com IA"));
}

main().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
