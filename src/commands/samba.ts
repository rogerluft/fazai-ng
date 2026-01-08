/**
 * Samba CLI Command Handler
 *
 * Provides CLI commands for managing Samba shares:
 * - fazai samba list
 * - fazai samba add <path>
 * - fazai samba del <share>
 * - fazai samba criauser <user>
 * - fazai samba criadir <path>
 * - fazai samba criagroup <group>
 * - fazai samba completion
 *
 * Usage:
 *   import { handleSambaCommand } from './commands/samba';
 *   await handleSambaCommand(process.argv.slice(3));
 */

import chalk from "chalk";
import { logger } from "../logger";
import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Samba operation options
 */
interface SambaOptions {
  operation: "list" | "add" | "del" | "criauser" | "criadir" | "criagroup" | "completion";
  argument?: string;
}

/**
 * Main handler for samba commands
 */
export async function handleSambaCommand(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    showSambaHelp();
    return;
  }

  const options = parseSambaArgs(args);

  try {
    switch (options.operation) {
      case "list":
        await handleList();
        break;

      case "add":
        await handleAdd(options.argument);
        break;

      case "del":
        await handleDel(options.argument);
        break;

      case "criauser":
        await handleCriaUser(options.argument);
        break;

      case "criadir":
        await handleCriaDir(options.argument);
        break;

      case "criagroup":
        await handleCriaGroup(options.argument);
        break;

      case "completion":
        await handleCompletion();
        break;

      default:
        logger.error(chalk.red(`✗ Unknown operation: ${options.operation}`));
        showSambaHelp();
        process.exit(1);
    }
  } catch (error: any) {
    logger.error(chalk.red(`✗ Error: ${error.message}`));
    if (error.stack) {
      logger.debug(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Display help for samba commands
 */
function showSambaHelp(): void {
  const help = `
${chalk.bold.cyan("FAZAI SAMBA MANAGEMENT")}

${chalk.bold("Usage:")}
  fazai samba <command> [argument]

${chalk.bold("Commands:")}
  ${chalk.green("list")}                    List all Samba shares
  ${chalk.green("add")} <path>              Add existing directory as Samba share
  ${chalk.green("del")} <share>             Remove Samba share (with confirmation)
  ${chalk.green("criauser")} <user>         Create Unix user + Samba user
  ${chalk.green("criadir")} <path>          Create directory + Samba share
  ${chalk.green("criagroup")} <group>       Create group + apply permissions
  ${chalk.green("completion")}              Generate bash completion script

${chalk.bold("Examples:")}
  ${chalk.gray("# List all shares")}
  fazai samba list

  ${chalk.gray("# Add existing directory as share")}
  fazai samba add /dados/compartilhado

  ${chalk.gray("# Remove share (interactive confirmation)")}
  fazai samba del myshare

  ${chalk.gray("# Create new user with Samba access")}
  fazai samba criauser joao

  ${chalk.gray("# Create new directory as share")}
  fazai samba criadir /dados/projetos

  ${chalk.gray("# Create group with permissions")}
  fazai samba criagroup developers

  ${chalk.gray("# Install bash completion")}
  sudo fazai samba completion > /etc/bash_completion.d/fazai-samba

${chalk.bold("Notes:")}
  - ${chalk.yellow("add, del, criauser, criadir, criagroup")} require sudo privileges
  - ${chalk.yellow("list")} and ${chalk.yellow("completion")} run without elevation
  - Samba service automatically restarts after write operations
  - Backup of smb.conf is created before modifications

${chalk.bold("Configuration:")}
  Samba configuration: /etc/samba/smb.conf
  Script location: /opt/fazai/scripts/fzsamba (fallback: scripts/fzsamba)

${chalk.bold("Documentation:")}
  https://github.com/your-repo/fazai-ng/docs/samba.md
`;

  console.log(help);
}

/**
 * Parse samba arguments
 */
function parseSambaArgs(args: string[]): SambaOptions {
  const operation = args[0] as SambaOptions["operation"];
  const validOps = ["list", "add", "del", "criauser", "criadir", "criagroup", "completion"];

  if (!validOps.includes(operation)) {
    throw new Error(`Invalid operation: ${operation}`);
  }

  const argument = args[1];

  // Validate required arguments
  if (["add", "del", "criauser", "criadir", "criagroup"].includes(operation) && !argument) {
    throw new Error(`Operation '${operation}' requires an argument`);
  }

  return { operation, argument };
}

/**
 * Get path to fzsamba script
 */
function getFzsambaScriptPath(): string {
  const paths = [
    "/opt/fazai/scripts/fzsamba",
    "/home/rluft/fazai-ng/scripts/fzsamba",
    resolve(process.cwd(), "scripts/fzsamba"),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(`fzsamba script not found. Searched: ${paths.join(", ")}`);
}

/**
 * Execute fzsamba script with sudo for write operations
 */
function executeFzsamba(operation: string, argument?: string, needsSudo = true): void {
  const scriptPath = getFzsambaScriptPath();
  const args = argument ? [scriptPath, operation, argument] : [scriptPath, operation];
  const command = needsSudo ? "sudo" : "bash";

  if (!needsSudo) {
    args.unshift(scriptPath);
  }

  const result = spawnSync(command, needsSudo ? args : [scriptPath, operation], {
    stdio: "inherit",
    encoding: "utf-8",
  });

  if (result.error) {
    throw new Error(`Failed to execute fzsamba: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`fzsamba exited with code ${result.status}`);
  }
}

/**
 * Execute fzsamba and capture output (for list/completion)
 */
function executeFzsambaOutput(operation: string): string {
  const scriptPath = getFzsambaScriptPath();

  try {
    const output = execSync(`bash ${scriptPath} ${operation}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output;
  } catch (error: any) {
    throw new Error(`Failed to execute fzsamba ${operation}: ${error.message}`);
  }
}

/**
 * Handle list command (no sudo needed)
 */
async function handleList(): Promise<void> {
  logger.info(chalk.bold("Listing Samba shares..."));

  try {
    const output = executeFzsambaOutput("list");
    console.log(output);
  } catch (error: any) {
    logger.error(chalk.red(`✗ Failed to list shares: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Handle add command (requires sudo)
 */
async function handleAdd(path?: string): Promise<void> {
  if (!path) {
    throw new Error("Path argument is required for 'add' operation");
  }

  const absolutePath = resolve(path);

  if (!existsSync(absolutePath)) {
    throw new Error(`Directory does not exist: ${absolutePath}`);
  }

  logger.info(chalk.bold(`Adding share for: ${absolutePath}`));
  executeFzsamba("add", absolutePath, true);
  console.log(chalk.green(`✓ Share added successfully`));
}

/**
 * Handle del command (requires sudo, interactive confirmation)
 */
async function handleDel(share?: string): Promise<void> {
  if (!share) {
    throw new Error("Share name is required for 'del' operation");
  }

  logger.info(chalk.bold(`Removing share: ${share}`));
  logger.warn(chalk.yellow("You will be prompted for confirmation by the script"));

  executeFzsamba("del", share, true);
  console.log(chalk.green(`✓ Share removal processed`));
}

/**
 * Handle criauser command (requires sudo, interactive)
 */
async function handleCriaUser(user?: string): Promise<void> {
  if (!user) {
    throw new Error("Username is required for 'criauser' operation");
  }

  logger.info(chalk.bold(`Creating user: ${user}`));
  logger.info(chalk.gray("The script will prompt for Samba password and share assignment"));

  executeFzsamba("criauser", user, true);
  console.log(chalk.green(`✓ User creation processed`));
}

/**
 * Handle criadir command (requires sudo, interactive)
 */
async function handleCriaDir(path?: string): Promise<void> {
  if (!path) {
    throw new Error("Directory path is required for 'criadir' operation");
  }

  const absolutePath = resolve(path);

  logger.info(chalk.bold(`Creating directory and share: ${absolutePath}`));
  logger.info(chalk.gray("The script will prompt for owner and group information"));

  executeFzsamba("criadir", absolutePath, true);
  console.log(chalk.green(`✓ Directory and share created successfully`));
}

/**
 * Handle criagroup command (requires sudo, interactive)
 */
async function handleCriaGroup(group?: string): Promise<void> {
  if (!group) {
    throw new Error("Group name is required for 'criagroup' operation");
  }

  logger.info(chalk.bold(`Creating group: ${group}`));
  logger.info(chalk.gray("The script will prompt for users and directory assignment"));

  executeFzsamba("criagroup", group, true);
  console.log(chalk.green(`✓ Group creation processed`));
}

/**
 * Handle completion command (no sudo needed)
 */
async function handleCompletion(): Promise<void> {
  try {
    const output = executeFzsambaOutput("completion");
    console.log(output);

    console.log(chalk.gray("\nTo install, run:"));
    console.log(chalk.cyan("  sudo fazai samba completion > /etc/bash_completion.d/fazai-samba"));
    console.log(chalk.cyan("  source /etc/bash_completion.d/fazai-samba"));
  } catch (error: any) {
    logger.error(chalk.red(`✗ Failed to generate completion: ${error.message}`));
    process.exit(1);
  }
}
