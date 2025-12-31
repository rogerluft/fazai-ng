/**
 * FazAI Cleaner Command
 * Wrapper para o GenAIScript cleaner.genai.mjs
 *
 * Uso:
 *   fazai cleaner          # Modo análise (gera relatório)
 *   fazai cleaner --exec   # Modo execução (move arquivos)
 *   fazai cleaner --help   # Ajuda
 */

import chalk from "chalk";
import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { logger } from "../logger";

export async function handleCleanerCommand(args: string[]): Promise<void> {
  // Help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
${chalk.cyan("🧹 FazAI Cleaner - Faxineiro Semântico")}

${chalk.yellow("Uso:")}
  fazai cleaner              Executa análise e gera relatório
  fazai cleaner --exec       Move arquivos para archive/ (requer aprovação)
  fazai cleaner --dry-run    Simula execução sem mover arquivos
  fazai cleaner --help       Mostra esta ajuda

${chalk.yellow("O que o Cleaner faz:")}
  • Detecta tecnologias deprecadas (Milvus, Jarvis legado)
  • Identifica arquivos órfãos (não importados por ninguém)
  • Gera relatório JSON em archive/cleaner-report.json
  • Move arquivos para archive/ (modo --exec)

${chalk.yellow("Segurança:")}
  ${chalk.red("✗")} NUNCA deleta arquivos (apenas move)
  ${chalk.red("✗")} NUNCA mexe em genaisrc/ ou src/agentic/
  ${chalk.green("✓")} Requer aprovação humana antes de mover

${chalk.yellow("Exemplos:")}
  fazai cleaner                     # Gera relatório de análise
  fazai cleaner --exec              # Move arquivos após aprovação
  fazai cleaner --exec --dry-run    # Simula movimentação
`);
    return;
  }

  // Check if genaiscript is available
  try {
    execSync("npx genaiscript --version", { stdio: "ignore" });
  } catch {
    logger.error("GenAIScript não encontrado. Instale com: npm install -g genaiscript");
    process.exit(1);
  }

  // Check if cleaner script exists
  const scriptPath = join(process.cwd(), "genaisrc", "cleaner.genai.mjs");
  if (!existsSync(scriptPath)) {
    logger.error(`Script não encontrado: ${scriptPath}`);
    logger.info("Execute este comando a partir do diretório raiz do FazAI");
    process.exit(1);
  }

  // Build genaiscript command
  const mode = args.includes("--exec") ? "exec" : "analyze";
  const dryRun = args.includes("--dry-run") ? "true" : "false";

  console.log(chalk.cyan("\n🧹 FazAI Cleaner - Faxineiro Semântico\n"));
  console.log(chalk.gray(`Modo: ${mode === "exec" ? "Execução" : "Análise"}`));
  if (mode === "exec") {
    console.log(chalk.yellow("⚠️  Modo execução ativo - arquivos serão movidos para archive/\n"));
  }

  // Run genaiscript
  const genaiscriptArgs = [
    "genaiscript",
    "run",
    "cleaner",
    "--vars",
    `mode=${mode}`,
    "--vars",
    `dry_run=${dryRun}`,
  ];

  logger.debug(`Executando: npx ${genaiscriptArgs.join(" ")}`);

  const result = spawnSync("npx", genaiscriptArgs, {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    logger.error("Cleaner falhou. Verifique os logs acima.");
    process.exit(result.status || 1);
  }

  // Show report location
  const reportPath = join(process.cwd(), "archive", "cleaner-report.json");
  if (existsSync(reportPath)) {
    console.log(chalk.green(`\n✅ Relatório salvo em: ${reportPath}`));
  }
}
