import { spawn } from "child_process";
import chalk from "chalk";
import { LinuxCommand, CRITICAL_COMMANDS, HIGH_RISK_COMMANDS } from "./types-linux";
import { ResearchCoordinator } from "./research";
import { logger } from "./logger";

export class LinuxCommandExecutor {
  private executedCommands: Array<{ command: LinuxCommand; output: string; success: boolean }> = [];
  private dryRun: boolean = false;
  private researchCoordinator?: ResearchCoordinator;

  constructor(dryRun: boolean = false, researchCoordinator?: ResearchCoordinator) {
    this.dryRun = dryRun;
    this.researchCoordinator = researchCoordinator;
  }

  private assessRiskLevel(command: LinuxCommand): "low" | "medium" | "high" | "critical" {
    const cmd = command.command.toLowerCase();

    // Verificar comandos críticos
    for (const pattern of CRITICAL_COMMANDS) {
      if (pattern.test(cmd)) {
        return "critical";
      }
    }

    // Verificar comandos de alto risco
    for (const pattern of HIGH_RISK_COMMANDS) {
      if (pattern.test(cmd)) {
        return "high";
      }
    }

    // Classificação baseada em palavras-chave
    if (cmd.includes("rm") || cmd.includes("del") || cmd.includes("delete")) {
      return "high";
    }

    if (cmd.includes("install") || cmd.includes("update") || cmd.includes("upgrade")) {
      return "medium";
    }

    if (cmd.includes("restart") || cmd.includes("stop") || cmd.includes("start")) {
      return "medium";
    }

    return "low";
  }

  private async runSafetyChecks(command: LinuxCommand): Promise<boolean> {
    if (command.safetyChecks && command.safetyChecks.length > 0) {
      logger.info(chalk.gray("\n(Verificações de segurança ignoradas pelo modo rápido)"));
    }
    return true;
  }

  private async getUserConfirmation(command: LinuxCommand): Promise<boolean> {
    logger.info(chalk.cyan(`\n📋 Comando: ${command.command}`));
    logger.info(chalk.gray(`📝 Explicação: ${command.explain}`));
    if (command.rollbackCommand) {
      logger.info(chalk.blue(`🔄 Rollback disponível: ${command.rollbackCommand}`));
    }
    if (command.expectedOutput) {
      logger.info(chalk.gray(`🎯 Saída esperada: ${command.expectedOutput}`));
    }
    logger.info(chalk.yellow("(Confirmação automática habilitada)"));
    return true;
  }

  async executeCommand(command: LinuxCommand): Promise<{ success: boolean; output: string }> {
    logger.info(chalk.cyan(`\n🚀 Executando: ${command.command}`));

    // Verificações de segurança
    await this.runSafetyChecks(command);
    await this.getUserConfirmation(command);
    await this.researchCoordinator?.maybeRunPreExecutionResearch(command);

    if (this.dryRun) {
      logger.info(chalk.yellow(`🔍 DRY-RUN: ${command.command}`));
      return { success: true, output: "(dry-run: comando não executado)" };
    }

    try {
      logger.info(chalk.gray("Executando..."));

      // Usar spawn para melhor controle e output em tempo real
      // SECURITY: shell: false (default) prevents command injection
      const result = await new Promise<{ success: boolean; output: string }>((resolve) => {
        const [cmd, ...args] = command.command.split(' ');
        const child = spawn(cmd, args, {
          stdio: ['inherit', 'pipe', 'pipe'],
          // shell: false is default - NOT enabling to prevent RCE
        });

        let output = '';
        let errorOutput = '';

        child.stdout?.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          process.stdout.write(chunk);
        });

        child.stderr?.on('data', (data) => {
          const chunk = data.toString();
          errorOutput += chunk;
          process.stderr.write(chunk);
        });

        child.on('close', (code) => {
          const fullOutput = output + (errorOutput ? `\nSTDERR: ${errorOutput}` : '');
          resolve({
            success: code === 0,
            output: fullOutput
          });
        });

        child.on('error', (error) => {
          resolve({
            success: false,
            output: `Erro ao executar comando: ${error.message}`
          });
        });
      });

      this.executedCommands.push({
        command,
        output: result.output,
        success: result.success
      });

      if (result.success) {
        logger.info(chalk.green("✅ Comando executado com sucesso"));
      } else {
        logger.warn(chalk.red("❌ Comando falhou"));
        await this.researchCoordinator?.handleExecutionFailure(command, result.output);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorMsg = `Erro ao executar comando: ${errorMessage}`;
      logger.error(chalk.red(errorMsg));

      this.executedCommands.push({
        command,
        output: errorMsg,
        success: false
      });

      await this.researchCoordinator?.handleExecutionFailure(command, errorMsg);

      return { success: false, output: errorMsg };
    }
  }

  async rollbackLastCommand(): Promise<boolean> {
    if (this.executedCommands.length === 0) {
      logger.warn(chalk.yellow("Nenhum comando para reverter"));
      return false;
    }

    const lastCommand = this.executedCommands[this.executedCommands.length - 1];

    if (!lastCommand.command.rollbackCommand) {
      logger.warn(chalk.red("Último comando não tem rollback definido"));
      return false;
    }

    logger.info(chalk.yellow(`\n🔄 Executando rollback: ${lastCommand.command.rollbackCommand}`));

    const rollbackCommand: LinuxCommand = {
      explain: `Revertendo: ${lastCommand.command.explain}`,
      command: lastCommand.command.rollbackCommand,
      riskLevel: "medium",
      requiresConfirmation: false
    };

    const result = await this.executeCommand(rollbackCommand);
    return result.success;
  }

  getExecutionHistory(): Array<{ command: LinuxCommand; output: string; success: boolean }> {
    return [...this.executedCommands];
  }

  clearHistory(): void {
    this.executedCommands = [];
  }
}
