/**
 * Samba UI - Interactive CLI interface for Samba management
 *
 * Provides interactive menu and direct command execution for /samba slash command
 */

import chalk from "chalk";
import { select, input } from "@inquirer/prompts";
import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { logger } from "../../logger";

interface SambaCommandResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Get path to fzsamba script
 */
function getFzsambaScriptPath(): string {
  const paths = [
    "/opt/fazai/scripts/fzsamba",
    resolve(__dirname, "../../../scripts/fzsamba"),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error("fzsamba script not found");
}

export class SambaUI {
  private scriptPath: string;

  constructor() {
    this.scriptPath = getFzsambaScriptPath();
  }

  /**
   * Show interactive main menu (when called without arguments)
   */
  async showMainMenu(): Promise<void> {
    console.log(chalk.bold.cyan("\n🗂️  FazAI Samba Manager\n"));

    while (true) {
      const action = await select({
        message: "Escolha uma operação:",
        choices: [
          { name: "📋 Listar compartilhamentos", value: "list" },
          { name: "➕ Adicionar compartilhamento", value: "add" },
          { name: "➖ Remover compartilhamento", value: "del" },
          { name: "👤 Criar usuário Samba", value: "criauser" },
          { name: "📁 Criar diretório + share", value: "criadir" },
          { name: "👥 Criar grupo", value: "criagroup" },
          { name: "🔙 Voltar", value: "back" },
        ],
      });

      if (action === "back") {
        break;
      }

      await this.handleAction(action);
      console.log(); // spacing
    }
  }

  /**
   * Execute direct command (when called with arguments)
   */
  async executeCommand(args: string[]): Promise<void> {
    const [cmd, ...params] = args;

    const validCommands = [
      "list", "add", "del", "criauser", "criadir", "criagroup", "completion"
    ];

    if (!validCommands.includes(cmd)) {
      logger.error(chalk.red(`Comando inválido: ${cmd}`));
      logger.info(chalk.gray(`Comandos válidos: ${validCommands.join(", ")}`));
      return;
    }

    const result = this.executeFzSamba(cmd, params);

    if (!result.success) {
      logger.error(chalk.red(`❌ Erro: ${result.error}`));
      return;
    }

    console.log(result.output);
  }

  /**
   * Handle menu action
   */
  private async handleAction(action: string): Promise<void> {
    try {
      switch (action) {
        case "list":
          await this.handleList();
          break;
        case "add":
          await this.handleAdd();
          break;
        case "del":
          await this.handleDel();
          break;
        case "criauser":
          await this.handleCriaUser();
          break;
        case "criadir":
          await this.handleCriaDir();
          break;
        case "criagroup":
          await this.handleCriaGroup();
          break;
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === "ExitPromptError") {
        // User pressed Ctrl+C - just return
        return;
      }
      logger.error(chalk.red(`Erro: ${err.message}`));
    }
  }

  private async handleList(): Promise<void> {
    console.log(chalk.bold("\n📋 Compartilhamentos Samba:\n"));
    const result = this.executeFzSamba("list", []);
    console.log(result.output);
  }

  private async handleAdd(): Promise<void> {
    const path = await input({
      message: "Caminho do diretório existente:",
      validate: (val) => val.length > 0 || "Caminho obrigatório",
    });

    console.log(chalk.gray(`\nAdicionando ${path}...`));
    this.executeFzSambaInteractive("add", [path]);
  }

  private async handleDel(): Promise<void> {
    // List shares first
    console.log(chalk.bold("\n📋 Compartilhamentos atuais:\n"));
    const listResult = this.executeFzSamba("list", []);
    console.log(listResult.output);

    const share = await input({
      message: "Nome do compartilhamento a remover:",
      validate: (val) => val.length > 0 || "Nome obrigatório",
    });

    console.log(chalk.gray(`\nRemovendo ${share}...`));
    this.executeFzSambaInteractive("del", [share]);
  }

  private async handleCriaUser(): Promise<void> {
    const user = await input({
      message: "Nome do usuário:",
      validate: (val) => val.length > 0 || "Nome obrigatório",
    });

    console.log(chalk.gray(`\nCriando usuário ${user}...`));
    this.executeFzSambaInteractive("criauser", [user]);
  }

  private async handleCriaDir(): Promise<void> {
    const path = await input({
      message: "Caminho do novo diretório:",
      validate: (val) => val.length > 0 || "Caminho obrigatório",
    });

    console.log(chalk.gray(`\nCriando diretório ${path}...`));
    this.executeFzSambaInteractive("criadir", [path]);
  }

  private async handleCriaGroup(): Promise<void> {
    const group = await input({
      message: "Nome do grupo:",
      validate: (val) => val.length > 0 || "Nome obrigatório",
    });

    console.log(chalk.gray(`\nCriando grupo ${group}...`));
    this.executeFzSambaInteractive("criagroup", [group]);
  }

  /**
   * Execute fzsamba and capture output (for non-interactive commands like list)
   */
  private executeFzSamba(cmd: string, args: string[]): SambaCommandResult {
    try {
      const fullCmd = `${this.scriptPath} ${cmd} ${args.join(" ")}`.trim();
      logger.debug(`Executando: ${fullCmd}`);

      const output = execSync(fullCmd, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      return { success: true, output };
    } catch (error: unknown) {
      const err = error as { message?: string; stderr?: Buffer; stdout?: Buffer };
      return {
        success: false,
        output: err.stdout?.toString() || "",
        error: err.stderr?.toString() || err.message || "Erro desconhecido",
      };
    }
  }

  /**
   * Execute fzsamba with interactive stdio (for commands that need user input)
   */
  private executeFzSambaInteractive(cmd: string, args: string[]): void {
    const result = spawnSync("sudo", [this.scriptPath, cmd, ...args], {
      stdio: "inherit",
      encoding: "utf-8",
    });

    if (result.status !== 0) {
      logger.error(chalk.red(`Comando falhou com código ${result.status}`));
    }
  }
}
