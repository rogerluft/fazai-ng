#!/usr/bin/env node
import chalk from "chalk";
import { models, type Model } from "./models";
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
import { handleAskCommand } from "./commands/ask";
import { handleVectorCommand } from "./commands/vector";
import { handleImportCommand } from "./commands/import";
import { handleIndexCommand } from "./commands/index-command";
import { handleCompletionCommand } from "./commands/completion";

import { getConfigValue } from "./config";
import { normalizeTask } from "./utils/task-normalizer";

function displayHelp() {
  const previewEnabled = getConfigValue('ENABLE_PREVIEW_FEATURES') === 'true';

  // Group models by provider for better organization
  const modelsByProvider: Record<string, Model[]> = {};
  for (const model of models) {
    if (!modelsByProvider[model.provider]) {
      modelsByProvider[model.provider] = [];
    }
    modelsByProvider[model.provider].push(model);
  }

  let modelsHelpText = '\nAvailable Models (use exact model names):\n';

  // Display models grouped by provider
  const providerOrder: Array<{ key: string; name: string }> = [
    { key: 'ollama', name: 'Ollama (local models)' },
    { key: 'openrouter', name: 'OpenRouter (free tier available)' },
    { key: 'perplexity', name: 'Perplexity (search-enabled AI)' },
    { key: 'google', name: 'Google Gemini' },
    { key: 'openai', name: 'OpenAI' },
    { key: 'anthropic', name: 'Anthropic Claude' },
  ];

  for (const { key, name } of providerOrder) {
    const providerModels = modelsByProvider[key];
    if (providerModels && providerModels.length > 0) {
      modelsHelpText += `\n  ${name}:\n`;
      for (const model of providerModels) {
        const isDefault = model === models[0] ? ' (DEFAULT)' : '';
        modelsHelpText += `    ${model.name}${isDefault}\n`;
        if (model.description) {
          modelsHelpText += `      ${model.description}\n`;
        }
      }
    }
  }

  modelsHelpText += `
  Note: First model in your fazai.conf = default for that provider
  Configure models in /etc/fazai/fazai.conf (MODELS_PROVIDER=model1,model2,model3)
`;

  const helpText = `
🖥️  FAZAI - Administrador Linux Inteligente com IA

Usage:
  fazai [options] ["task description"] [model-name]  # Linux Admin Mode (default)
  fazai ask "Your question here" [model-name]        # General AI questions
  fazai config                                       # List configured API keys
  fazai completion                                   # Print available CLI completions
  fazai alias <name> <command>                       # Create/manage global bash aliases
  fazai alias list                                   # List all aliases
  fazai search "query"                               # Manual research via Context7/Web (supports SPAs)
  fazai vector [validate|recreate]                   # Valida collections vetoriais (Qdrant)
  fazai import <file> --source=<claude|chatgpt>     # Importa conversas para Qdrant
  fazai ingest <dir> [--batch|--preview]             # Personality data ingestion
  fazai qdrant <command>                             # Qdrant management (status, metrics, backup, etc)
  fazai cloudflare <action>                          # Manage Cloudflare (zones, dns, workers)
  fazai cf zones                                     # Cloudflare: list zones
  fazai cf dns list <zoneId>                         # Cloudflare: manage DNS
  fazai github <action>                              # GitHub integration (auth, repos, issues, etc)
  fazai sync                                         # Sincroniza configurações e scripts (dotfiles)
  fazai index                                        # Gerencia o índice de metacognição (código fonte)
  fazai inference <command>                          # Gerencia conhecimento injetado pelo usuário
  fazai agent <command>                              # Executa agentes GenAIScript (loop, reflect, etc)
  fazai dashboard <command>                          # Gerencia REST API Dashboard (start, stop, status)
  fazai daemon                                       # Inicia servidor HTTP/WS em background (estilo OpenClaw)
  fazai install-daemon                               # Instala e configura o daemon como serviço systemd
  fazai migrate-openclaw [sqlite_path]               # Migra memórias do OpenClaw para o Qdrant
  fazai memory <command>                             # Busca e indexa memórias agênticas no Qdrant
  fazai samba <command>                              # Gerencia compartilhamentos Samba (list, add, del, etc)

Options:
  --dry-run                Simulate commands without executing
  --cli                    Open interactive CLI (chat + /exec)
  --debug                  Ativa logs detalhados (equivalente a --verbose)
  --verbose                Alias para --debug
  --log-file <path>        Define caminho explícito para o arquivo de log
  --auto-research          Reativar pesquisa automática após falhas
  --yolo, -y               Execute all commands without confirmation (DANGEROUS!)
  --semantic               Enable semantic search (default: false)
  --help, -h               Show this help message

Examples:
  # Admin mode (default)
  fazai
  fazai --dry-run                                    # Safe simulation mode
  fazai "install nginx" qwen2.5:7b                   # Use specific model
  fazai "configure firewall" llama-3-sonar-small-32k-online  # Use Perplexity Sonar

  # General questions
  fazai ask "Como configurar nginx como proxy reverso?"
  fazai ask "Explicar diferença entre systemctl e service"

  # Configuration
  fazai config              # Show configured API keys
${modelsHelpText}`;
  logger.info(helpText);
}

async function checkAndSetAPIKey(selectedModel: (typeof models)[number]) {
  const provider = selectedModel.provider;
  const apiKeyPresent = checkAPIKey(provider);

  if (!apiKeyPresent) {
    await getAndSetAPIKey(provider);
  }

  logger.info(chalk.green(`✅ API key configurada (${provider})`));
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const debugFlag = rawArgs.includes("--debug") || rawArgs.includes("--verbose");
  
  if (debugFlag) {
    console.log("DEBUG: Raw Args:", rawArgs);
    console.log("DEBUG: Loaded Models:", models.map(m => `${m.name} (${m.provider})`));
  }
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
  const semanticSearchEnabled = inputs.includes('--semantic');

  if (inputs.includes("--cli")) {
    await runCliMode(semanticSearchEnabled);
    // runCliMode() handles its own exit (interactive mode)
    return;
  }

  // List of subcommands that have their own --help handlers
  const SUBCOMMANDS_WITH_HELP = [
    "qdrant", "vector", "ask", "import", "alias",
    "cloudflare", "cf", "github", "index", "sync",
    "config", "search", "inference", "agent", "ingest",
    "dashboard", "samba", "completion", "cleaner", "daemon", "serve", "install-daemon", "migrate-openclaw", "memory"
  ];

  const firstArg = inputs[0];
  const hasHelpFlag = inputs.includes("--help") || inputs.includes("-h");

  // Show general help only if:
  // 1. No arguments at all, OR
  // 2. Only --help/-h flag (not a subcommand with --help)
  if (inputs.length === 0) {
    displayHelp();
    process.exit(0);
  }

  // If --help/-h is present BUT first arg is a known subcommand,
  // let the subcommand handler process the --help
  if (hasHelpFlag && !SUBCOMMANDS_WITH_HELP.includes(firstArg)) {
    displayHelp();
    process.exit(0);
  }

  // Config command
  if (inputs[0] === "config") {
    listConfiguredKeys();
    process.exit(0);
  }

  // Sync command
  if (inputs[0] === "sync") {
    const { syncCommand } = await import("./commands/sync");
    await syncCommand({
      verbose: debugFlag || verboseFlag,
      dryRun: inputs.includes("--dry-run")
    });
    process.exit(0);
  }

  // Source Indexer command (Metacognition)
  if (inputs[0] === "index") {
    await handleIndexCommand(inputs.slice(1));
    process.exit(0);
  }

  // Cloudflare command
  if (inputs[0] === "cf" || inputs[0] === "cloudflare") {
    const { handleCloudflare } = await import("./commands/cloudflare");
    await handleCloudflare(inputs.slice(1));
    process.exit(0);
  }

  // GitHub command
  if (inputs[0] === "github") {
    await handleGitHubCommand(inputs.slice(1));
    process.exit(0);
  }

  // Qdrant command
  if (inputs[0] === "qdrant") {
    const { handleQdrantCommand } = await import("./commands/qdrant");
    await handleQdrantCommand(inputs.slice(1));
    process.exit(0);
  }

  // Alias command
  if (inputs[0] === "alias") {
    const { handleAliasCommand } = await import("./commands/alias");
    await handleAliasCommand(inputs.slice(1));
    process.exit(0);
  }

  // Inference command - Gerencia conhecimento injetado pelo usuário
  if (inputs[0] === "inference") {
    const { handleInferenceCommand } = await import("./commands/inference");
    await handleInferenceCommand(inputs.slice(1));
    process.exit(0);
  }

  // Agent command - Coração agêntico do FazAI
  if (inputs[0] === "agent") {
    const { handleAgentCommand } = await import("./commands/agent");
    await handleAgentCommand(inputs.slice(1));
    process.exit(0);
  }

  // Dashboard command - REST API Server
  if (inputs[0] === "dashboard") {
    const { handleDashboardCommand } = await import("./commands/dashboard");
    await handleDashboardCommand(inputs.slice(1));
    process.exit(0);
  }

  // Ingest command - Personality Data Ingestion
  if (inputs[0] === "ingest") {
    const { handleIngestCommand } = await import("./commands/ingest");
    await handleIngestCommand(inputs.slice(1));
    process.exit(0);
  }

  // Samba command - Samba Share Management
  if (inputs[0] === "samba") {
    const { handleSambaCommand } = await import("./commands/samba");
    await handleSambaCommand(inputs.slice(1));
    process.exit(0);
  }

  if (inputs[0] === "completion") {
    await handleCompletionCommand(inputs.slice(1));
    process.exit(0);
  }

  // Cleaner command - Faxineiro Semântico
  if (inputs[0] === "cleaner") {
    const { handleCleanerCommand } = await import("./commands/cleaner");
    await handleCleanerCommand(inputs.slice(1));
    process.exit(0);
  }

  // Daemon command - Always-on background server (OpenClaw style)
  if (inputs[0] === "daemon" || inputs[0] === "serve") {
    const { handleDaemonCommand } = await import("./commands/daemon");
    await handleDaemonCommand(inputs.slice(1));
    return; // Do not process.exit(0) because server must stay alive
  }

  // Install Daemon command
  if (inputs[0] === "install-daemon") {
    const { handleInstallDaemonCommand } = await import("./commands/install-daemon");
    await handleInstallDaemonCommand(inputs.slice(1));
    process.exit(0);
  }

  // Migrate OpenClaw Memory command
  if (inputs[0] === "migrate-openclaw") {
    const { handleMigrateOpenClawCommand } = await import("./commands/migrate-openclaw");
    await handleMigrateOpenClawCommand(inputs.slice(1));
    process.exit(0);
  }

  // Memory tools command
  if (inputs[0] === "memory") {
    const { handleMemoryCommand } = await import("./commands/memory-cmd");
    await handleMemoryCommand(inputs.slice(1));
    process.exit(0);
  }

  if (inputs[0] === "vector") {
    await handleVectorCommand(inputs.slice(1));
    process.exit(0);
  }

  if (inputs[0] === "import") {
    await handleImportCommand(inputs.slice(1));
    process.exit(0);
  }

  // Handle Version command immediately before any async model logic
  if (inputs.includes("--version") || inputs.includes("-v")) {
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(`FazAI v${pkg.version}`);
    process.exit(0);
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
    // --help e -h são tratados no início do main() para subcomandos
    // Aqui só remove da lista de args para o admin mode
    if (input === "--help" || input === "-h") {
      return false;
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
    process.exit(0);
  }

  // Ask mode (general questions)
  if (inputs[0] === "ask") {
    await handleAskCommand(inputs.slice(1));
    process.exit(0);
  }

  // ============================================================================
  // VALIDATION: Unknown commands/options
  // Prevents garbage like "fazai --punheta" from being sent to AI
  // ============================================================================
  const KNOWN_OPTIONS = [
    "--dry-run", "--yolo", "-y", "--debug", "--verbose",
    "--log-file", "--auto-research", "--help", "-h", "--version", "-v",
    "--cli", "--exec"
  ];

  // Check for unknown options (args starting with --)
  if (inputs.length > 0) {
    const unknownOptions = inputs.filter(arg =>
      arg.startsWith("--") && !KNOWN_OPTIONS.includes(arg) && !arg.startsWith("--log-file=")
    );

    if (unknownOptions.length > 0) {
      logger.error(chalk.red(`❌ Opção desconhecida: ${unknownOptions.join(", ")}`));
      logger.info(chalk.yellow("💡 Use 'fazai --help' para ver opções disponíveis"));
      process.exit(1);
    }

    // Check if first arg looks like a command but isn't known
    const firstArg = inputs[0];
    if (firstArg && !firstArg.startsWith("-") && !firstArg.startsWith("--")) {
      const isKnownCommand = SUBCOMMANDS_WITH_HELP.includes(firstArg);
      const isModelName = models.some(m => m.name === firstArg);
      const looksLikeTask = firstArg.includes(" ") || /^[a-z]+\s/i.test(inputs.join(" "));

      // If it's a single word that's not a command or model, it might be a typo
      if (!isKnownCommand && !isModelName && inputs.length === 1 && !looksLikeTask) {
        // Check for common typos
        const similarCommands = SUBCOMMANDS_WITH_HELP.filter(cmd =>
          cmd.startsWith(firstArg.slice(0, 2)) || firstArg.startsWith(cmd.slice(0, 2))
        );

        if (similarCommands.length > 0) {
          logger.error(chalk.red(`❌ Comando desconhecido: ${firstArg}`));
          logger.info(chalk.yellow(`💡 Você quis dizer: ${similarCommands.join(", ")}?`));
          logger.info(chalk.gray("   Use 'fazai --help' para ver todos os comandos"));
          process.exit(1);
        }
      }
    }
  }

  // Admin Mode (DEFAULT!)
  logger.info(chalk.cyan("\n🖥️  FAZAI - MODO ADMINISTRADOR LINUX"));
  logger.info(chalk.gray("Administração inteligente de sistemas Linux\n"));

  // Check if direct command mode (first arg is not a model name and not a flag)
  let directCommand: string | null = null;
  let selectedModel: typeof models[number] | undefined;

  // Try to find model in inputs (can be last or second-to-last)
  if (inputs.length > 0) {
    // Check if last arg is a model name (exact match)
    const lastArg = inputs[inputs.length - 1];
    logger.debug(`Parsing model: inputs=${JSON.stringify(inputs)}, lastArg=${lastArg}`);
    selectedModel = models.find((model) => model.name === lastArg);
    logger.debug(`Found model: ${selectedModel ? selectedModel.name : 'none'}`);

    if (selectedModel && inputs.length > 1) {
      // Model found at end, everything before is the command
      directCommand = inputs.slice(0, -1).join(" ");
    } else if (inputs.length > 1) {
      // Check if second-to-last is a model (task might be last)
      const secondLast = inputs[inputs.length - 2];
      const modelAtSecondLast = models.find((model) => model.name === secondLast);

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
      selectedModel = models.find(m => m.name === 'gemini-3.0-pro-latest');
      logger.info('🤖 Auto-selecting preview model: Gemini 3.0 Pro');
    }
    // If preview not enabled or gemini3 not found, fallback to the absolute default
    if (!selectedModel) {
      selectedModel = models[0];
    }
  }

  logger.info(`Modelo: ${selectedModel.name} (${selectedModel.provider})\n`);
  if (!selectedModel) {
    logger.error("Modelo selecionado não encontrado.");
    process.exit(1);
  }

  await checkAndSetAPIKey(selectedModel);
  const researchCoordinator = new ResearchCoordinator({
    researchOnFailure: autoResearchOnFailure,
  });

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
  let task = directCommand;
  if (!task) {
    const { input } = await import("@inquirer/prompts");
    task = await input({
      message: "O que você precisa fazer? ",
      validate: (input: string) => input.trim() !== "" || "Tarefa não pode estar vazia",
    });
  }

  // Normalize task to avoid comma ambiguity (NLP fix)
  const normalizedTask = normalizeTask(task);
  if (normalizedTask !== task) {
    logger.debug(`Task normalized: "${task}" → "${normalizedTask}"`);
  }

  // MODO NORMAL: Execução tradicional
  const commandStream = getLinuxCommandsFromAI(
    systemInfo,
    normalizedTask,
    selectedModel.name,
    selectedModel.provider
  );

  // Execute commands (pass yoloMode for auto-confirmation)
  const executor = new LinuxCommandExecutor(dryRun, researchCoordinator, yoloMode);
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

// Global handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`FATAL: Unhandled Rejection at:`, promise, 'reason:', reason);
  // Em situações críticas, pode ser útil forçar a saída
  // process.exit(1);
});
