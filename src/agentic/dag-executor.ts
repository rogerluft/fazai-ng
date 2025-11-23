import { SubTask } from "./task-decomposer";
import { LinuxCommand } from "../types-linux";
import { LinuxCommandExecutor } from "../linux-executor";
import { getLinuxCommandsFromAI } from "../linux-admin";
import { logger } from "../logger";
import chalk from "chalk";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ExecutionNode {
  subtask: SubTask;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: { success: boolean; output: string };
  startTime?: number;
  endTime?: number;
}

export class DAGExecutor {
  private nodes: Map<string, ExecutionNode> = new Map();
  private executor: LinuxCommandExecutor;
  private systemInfo: string;
  private model: string;
  private provider: "anthropic" | "openai" | "openrouter" | "ollama" | "google";

  constructor(
    subtasks: SubTask[],
    executor: LinuxCommandExecutor,
    systemInfo: string,
    model: string,
    provider: "anthropic" | "openai" | "openrouter" | "ollama" | "google"
  ) {
    this.executor = executor;
    this.systemInfo = systemInfo;
    this.model = model;
    this.provider = provider;

    // Inicializar nodes
    for (const subtask of subtasks) {
      this.nodes.set(subtask.id, {
        subtask,
        status: "pending"
      });
    }
  }

  async execute(): Promise<{ success: boolean; results: Map<string, ExecutionNode> }> {
    logger.info(chalk.cyan(`\n⚡ Executando ${this.nodes.size} subtarefas com DAG...\n`));

    // Executar em ordem topológica
    const executed = new Set<string>();
    let hasChanges = true;

    while (hasChanges && executed.size < this.nodes.size) {
      hasChanges = false;

      for (const [id, node] of this.nodes) {
        if (node.status !== "pending") continue;

        // Verificar se todas as dependências foram concluídas
        const depsReady = node.subtask.dependencies.every(depId => {
          const depNode = this.nodes.get(depId);
          return depNode && (depNode.status === "completed" || depNode.status === "skipped");
        });

        if (!depsReady) continue;

        // Executar esta subtarefa
        hasChanges = true;
        await this.executeSubtask(node);
        executed.add(id);
      }
    }

    // Verificar se todas foram executadas
    const allSuccess = Array.from(this.nodes.values()).every(
      node => node.status === "completed" || node.status === "skipped"
    );

    return {
      success: allSuccess,
      results: this.nodes
    };
  }

  private async executeSubtask(node: ExecutionNode): Promise<void> {
    const { subtask } = node;

    node.status = "running";
    node.startTime = Date.now();

    logger.info(chalk.blue(`\n🔧 [${subtask.id}] ${subtask.description}`));

    try {
      // 1. Se precisa instalar, verificar se já existe
      if (subtask.requiresInstallation && subtask.verificationCommand) {
        const alreadyExists = await this.checkIfExists(subtask.verificationCommand);
        if (alreadyExists) {
          logger.info(chalk.green(`✅ Já instalado - pulando instalação`));
          node.status = "skipped";
          node.result = { success: true, output: "Already installed" };
          node.endTime = Date.now();
          return;
        }
      }

      // 2. Instalar se necessário e ainda não existe
      if (subtask.requiresInstallation && subtask.installCommand) {
        logger.info(chalk.yellow(`📦 Instalando dependências...`));
        const installResult = await this.runDirectCommand(subtask.installCommand);
        if (!installResult.success) {
          logger.warn(chalk.red(`⚠️  Instalação falhou, tentando continuar...`));
        }
      }

      // 3. Executar comando principal
      if (subtask.command) {
        // Se já tem comando direto, executar
        const result = await this.runDirectCommand(subtask.command);
        node.result = result;
        node.status = result.success ? "completed" : "failed";
      } else {
        // Se não tem comando direto, pedir para IA gerar comandos
        logger.info(chalk.gray(`🤖 Pedindo IA para gerar comandos...`));
        const commands = await this.getCommandsFromAI(subtask.description);

        if (commands.length === 0) {
          node.status = "failed";
          node.result = { success: false, output: "IA não gerou comandos" };
        } else {
          // Executar comandos gerados
          let lastResult = { success: true, output: "" };
          for (const cmd of commands) {
            lastResult = await this.executor.executeCommand(cmd);
            if (!lastResult.success) break;
          }
          node.result = lastResult;
          node.status = lastResult.success ? "completed" : "failed";
        }
      }

    } catch (error: any) {
      logger.error(chalk.red(`❌ Erro ao executar: ${error.message}`));
      node.status = "failed";
      node.result = { success: false, output: error.message };
    }

    node.endTime = Date.now();

    const duration = ((node.endTime - node.startTime!) / 1000).toFixed(2);
    const statusIcon = node.status === "completed" ? "✅" : node.status === "failed" ? "❌" : "⏭️";
    logger.info(chalk.gray(`${statusIcon} Concluído em ${duration}s`));
  }

  private async checkIfExists(command: string): Promise<boolean> {
    try {
      await execAsync(command);
      return true;
    } catch {
      return false;
    }
  }

  private async runDirectCommand(command: string): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execAsync(command);
      return {
        success: true,
        output: stdout + (stderr ? `\nSTDERR: ${stderr}` : "")
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.message + (error.stderr ? `\nSTDERR: ${error.stderr}` : "")
      };
    }
  }

  private async getCommandsFromAI(taskDescription: string): Promise<LinuxCommand[]> {
    const commandStream = getLinuxCommandsFromAI(
      this.systemInfo,
      taskDescription,
      this.model,
      this.provider
    );

    const commands: LinuxCommand[] = [];

    for await (const packet of commandStream) {
      if (packet.type === "command") {
        commands.push(packet.command);
      }
    }

    return commands;
  }

  printSummary(): void {
    logger.info(chalk.cyan("\n📊 Resumo da Execução:\n"));

    for (const [id, node] of this.nodes) {
      const icon =
        node.status === "completed" ? chalk.green("✅") :
        node.status === "failed" ? chalk.red("❌") :
        node.status === "skipped" ? chalk.yellow("⏭️") :
        chalk.gray("⏸️");

      const duration = node.startTime && node.endTime
        ? ` (${((node.endTime - node.startTime) / 1000).toFixed(2)}s)`
        : "";

      logger.info(`${icon} [${id}] ${node.subtask.description}${duration}`);
    }
  }
}
