
import chalk from "chalk";
import { logger } from "../logger";
import { importConversations } from "../conversation-importer";

function showImportHelp(): void {
  console.log(chalk.bold.cyan("\n📥 FazAI Import Command\n"));
  console.log("Import conversations from Claude or ChatGPT into Qdrant.\n");

  console.log(chalk.bold("USAGE:"));
  console.log("  fazai import <file|directory> --source=<claude|chatgpt> [options]\n");

  console.log(chalk.bold("OPTIONS:"));
  console.log("  --source=<claude|chatgpt>    (required) The source of the conversations.");
  console.log("  --recursive, -r              Process a directory recursively.");
  console.log("  --no-knowledge               Do not extract technical knowledge.");
  console.log("  --no-learning                Do not extract learning patterns.\n");

  console.log(chalk.bold("EXAMPLES:"));
  console.log("  fazai import conversations.json --source=claude");
  console.log("  fazai import ./all_chats --source=chatgpt --recursive");
}

export async function handleImportCommand(rawArgs: string[]): Promise<void> {
  if (rawArgs.length === 0 || rawArgs.includes("--help") || rawArgs.includes("-h")) {
    showImportHelp();
    return;
  }
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
    logger.info(
      "  --source=<claude|chatgpt>  Fonte das conversas (obrigatório)"
    );
    logger.info(
      "  --recursive, -r            Processar diretório recursivamente"
    );
    logger.info(
      "  --no-knowledge             Não extrair conhecimento técnico"
    );
    logger.info(
      "  --no-learning              Não extrair padrões de aprendizado"
    );
    return;
  }

  if (!source) {
    logger.error(
      chalk.red("✗ Erro: --source é obrigatório (claude ou chatgpt)")
    );
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
    logger.info(
      `  fazai_memory: ${chalk.green(result.stats.memoryEntries)} mensagens`
    );
    logger.info(
      `  fazai_kb: ${chalk.green(
        result.stats.kbEntries
      )} soluções técnicas`
    );
    logger.info(
      `  fazai_learning: ${chalk.green(
        result.stats.learningEntries
      )} padrões de aprendizado`
    );

    if (result.errors.length > 0) {
      logger.info("");
      logger.warn(
        chalk.yellow(`⚠️  ${result.errors.length} erro(s) encontrado(s):`)
      );
      result.errors.slice(0, 5).forEach((err) => {
        logger.warn(chalk.gray(`  - ${err}`));
      });

      if (result.errors.length > 5) {
        logger.warn(
          chalk.gray(`  ... e mais ${result.errors.length - 5} erro(s)`)
        );
      }
    }

    logger.info("");
  } catch (error: any) {
    logger.error(chalk.red(`✗ Erro fatal na importação: ${error.message}`));
    logger.debug(error.stack);
    process.exit(1);
  }
}
