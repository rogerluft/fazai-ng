/**
 * Sistema de Aliases Globais - FazAI
 *
 * Gerenciador de aliases bash persistentes e globais
 * Compatible com fzalias standalone
 *
 * Funcionalidades:
 * - Criar/atualizar aliases persistentes
 * - Listar aliases existentes
 * - Remover aliases
 * - Validação de comandos perigosos
 * - Backup automático
 *
 * @module commands/alias
 */

import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../logger";
import chalk from "chalk";

const ALIAS_DIR = "/etc/fazai";
const ALIAS_FILE = path.join(ALIAS_DIR, "fzalias");
const BACKUP_DIR = path.join(ALIAS_DIR, "backups");

/**
 * Alias entry
 */
export interface AliasEntry {
  name: string;
  command: string;
  createdAt?: string;
  description?: string;
}

/**
 * Comandos perigosos que requerem confirmação
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/[^\/\s]*/,  // rm -rf / (root)
  /rm\s+-rf\s+~[\/\s]*/,    // rm -rf ~/ (home)
  /dd\s+if=.*of=\/dev\//,   // dd direto em dispositivo
  /mkfs\./,                 // format filesystem
  /:(){ :|:& };:/,          // fork bomb
];

/**
 * Verifica se comando é perigoso
 */
function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

/**
 * Cria diretório de aliases se não existir
 */
async function ensureAliasDir(): Promise<void> {
  try {
    await fs.mkdir(ALIAS_DIR, { recursive: true, mode: 0o755 });
    await fs.mkdir(BACKUP_DIR, { recursive: true, mode: 0o755 });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw new Error(`Failed to create alias directory: ${error.message}`);
    }
  }
}

/**
 * Faz backup do arquivo de aliases
 */
async function backupAliasFile(): Promise<void> {
  try {
    const exists = await fs.access(ALIAS_FILE).then(() => true).catch(() => false);

    if (!exists) {
      return; // Nada para fazer backup
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `fzalias.${timestamp}.bak`);

    await fs.copyFile(ALIAS_FILE, backupPath);
    logger.debug(`Backup created: ${backupPath}`);

    // Manter apenas últimos 10 backups
    const backups = await fs.readdir(BACKUP_DIR);
    const sorted = backups
      .filter((f) => f.startsWith("fzalias.") && f.endsWith(".bak"))
      .sort()
      .reverse();

    for (const old of sorted.slice(10)) {
      await fs.unlink(path.join(BACKUP_DIR, old));
    }
  } catch (error: any) {
    logger.warn(`Backup failed: ${error.message}`);
  }
}

/**
 * Lê aliases existentes
 */
export async function listAliases(): Promise<AliasEntry[]> {
  try {
    const content = await fs.readFile(ALIAS_FILE, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));

    const aliases: AliasEntry[] = [];

    for (const line of lines) {
      const match = line.match(/^alias\s+([^=]+)='(.*)'/);
      if (match) {
        aliases.push({
          name: match[1].trim(),
          command: match[2],
        });
      }
    }

    return aliases;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Cria ou atualiza um alias
 */
export async function createAlias(
  name: string,
  command: string,
  force: boolean = false
): Promise<void> {
  // Validações
  if (!name || !name.trim()) {
    throw new Error("Alias name cannot be empty");
  }

  if (!command || !command.trim()) {
    throw new Error("Command cannot be empty");
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error("Alias name can only contain letters, numbers, _ and -");
  }

  // Verifica comando perigoso
  if (isDangerousCommand(command) && !force) {
    logger.warn(chalk.yellow("⚠  Dangerous command detected!"));
    logger.warn(chalk.yellow(`   Command: ${command}`));
    throw new Error(
      "Dangerous command detected. Use --force to override (not recommended)"
    );
  }

  await ensureAliasDir();
  await backupAliasFile();

  // Lê aliases existentes
  const aliases = await listAliases();
  const existingIndex = aliases.findIndex((a) => a.name === name);

  if (existingIndex >= 0) {
    logger.info(chalk.yellow(`ℹ  Alias '${name}' already exists, updating...`));
    aliases[existingIndex].command = command;
  } else {
    aliases.push({ name, command });
  }

  // Gera conteúdo
  const header = [
    "# FazAI Global Aliases",
    "# Managed by fazai alias command",
    `# Last updated: ${new Date().toISOString()}`,
    "",
  ].join("\n");

  const aliasLines = aliases.map((a) => `alias ${a.name}='${a.command}'`).join("\n");

  const content = header + aliasLines + "\n";

  // Escreve arquivo
  await fs.writeFile(ALIAS_FILE, content, { mode: 0o644 });

  logger.info(chalk.green(`✓ Alias '${name}' created successfully`));
  logger.info(chalk.gray(`  Command: ${command}`));
  logger.info(chalk.cyan("\nℹ  Run 'source /etc/fazai/fzalias' to load aliases in current shell"));
}

/**
 * Remove um alias
 */
export async function removeAlias(name: string): Promise<void> {
  await ensureAliasDir();
  await backupAliasFile();

  const aliases = await listAliases();
  const filtered = aliases.filter((a) => a.name !== name);

  if (filtered.length === aliases.length) {
    throw new Error(`Alias '${name}' not found`);
  }

  // Gera conteúdo
  const header = [
    "# FazAI Global Aliases",
    "# Managed by fazai alias command",
    `# Last updated: ${new Date().toISOString()}`,
    "",
  ].join("\n");

  const aliasLines = filtered.map((a) => `alias ${a.name}='${a.command}'`).join("\n");

  const content = header + aliasLines + "\n";

  await fs.writeFile(ALIAS_FILE, content, { mode: 0o644 });

  logger.info(chalk.green(`✓ Alias '${name}' removed successfully`));
}

/**
 * Exibe lista de aliases formatada
 */
export async function displayAliases(): Promise<void> {
  const aliases = await listAliases();

  if (aliases.length === 0) {
    logger.info(chalk.gray("No aliases defined yet."));
    logger.info(chalk.cyan("\nCreate one with: fazai alias <name> <command>"));
    return;
  }

  logger.info(chalk.bold.cyan(`\n📝 FazAI Global Aliases (${aliases.length})`));
  logger.info(chalk.gray("─".repeat(60)));

  const maxNameLength = Math.max(...aliases.map((a) => a.name.length));

  for (const alias of aliases.sort((a, b) => a.name.localeCompare(b.name))) {
    const paddedName = alias.name.padEnd(maxNameLength);
    logger.info(chalk.yellow(paddedName) + chalk.gray(" → ") + chalk.white(alias.command));
  }

  logger.info(chalk.gray("─".repeat(60)));
  logger.info(chalk.cyan(`\nFile: ${ALIAS_FILE}`));
}

/**
 * Comando principal de aliases
 */
export async function handleAliasCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  try {
    // Sem argumentos ou --help
    if (!subcommand || subcommand === "--help" || subcommand === "-h") {
      showAliasHelp();
      return;
    }

    // Subcomandos
    switch (subcommand) {
      case "list":
      case "ls":
        await displayAliases();
        break;

      case "remove":
      case "rm":
      case "delete":
        if (!args[1]) {
          throw new Error("Alias name required. Usage: fazai alias remove <name>");
        }
        await removeAlias(args[1]);
        break;

      case "show":
        if (!args[1]) {
          await displayAliases();
        } else {
          await showAlias(args[1]);
        }
        break;

      default:
        // Criar alias: fazai alias <name> <command>
        const name = subcommand;
        const command = args.slice(1).join(" ");

        if (!command) {
          throw new Error(`Command required. Usage: fazai alias ${name} "<command>"`);
        }

        const force = args.includes("--force") || args.includes("-f");
        await createAlias(name, command, force);
        break;
    }
  } catch (error: any) {
    logger.error(chalk.red(`✗ ${error.message}`));
    process.exit(1);
  }
}

/**
 * Mostra detalhes de um alias específico
 */
async function showAlias(name: string): Promise<void> {
  const aliases = await listAliases();
  const alias = aliases.find((a) => a.name === name);

  if (!alias) {
    logger.error(chalk.red(`✗ Alias '${name}' not found`));
    return;
  }

  logger.info(chalk.bold.cyan(`\n📝 Alias: ${name}`));
  logger.info(chalk.gray("─".repeat(60)));
  logger.info(chalk.white(`Command: ${alias.command}`));
  logger.info(chalk.gray("─".repeat(60)));
}

/**
 * Exibe ajuda do comando alias
 */
function showAliasHelp(): void {
  console.log(chalk.bold.cyan("\n📝 FazAI Alias Manager\n"));
  console.log("Manage global bash aliases persistently\n");

  console.log(chalk.bold("USAGE:"));
  console.log("  fazai alias <name> <command>    Create or update alias");
  console.log("  fazai alias list                List all aliases");
  console.log("  fazai alias remove <name>       Remove alias");
  console.log("  fazai alias show <name>         Show alias details");
  console.log("  fazai alias --help              Show this help\n");

  console.log(chalk.bold("EXAMPLES:"));
  console.log("  fazai alias ll 'ls -lah --color=auto'");
  console.log("  fazai alias update 'sudo apt update && sudo apt upgrade -y'");
  console.log("  fazai alias logs 'tail -f /var/log/messages'");
  console.log("  fazai alias gs 'git status'");
  console.log("  fazai alias dc 'docker-compose'");
  console.log("  fazai alias k 'kubectl'\n");

  console.log(chalk.bold("SHORTCUTS:"));
  console.log("  list    ls");
  console.log("  remove  rm, delete");
  console.log("  show    (displays single alias)\n");

  console.log(chalk.bold("COMPATIBLE:"));
  console.log("  You can also use standalone 'fzalias' command:");
  console.log("  fzalias tm 'tail -f /var/log/messages'\n");

  console.log(chalk.gray(`Aliases file: ${ALIAS_FILE}`));
  console.log(chalk.gray(`Backups: ${BACKUP_DIR}\n`));
}
