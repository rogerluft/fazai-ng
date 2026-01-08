import { askAI } from "../askAI";
import { logger } from "../logger";
import chalk from "chalk";
import { composeExecution, SystemContext, ExecutionBlock, saveExecutionBlock } from "./execution-composer";

export interface SubTask {
  id: string;
  description: string;
  command?: string;
  dependencies: string[]; // IDs de subtarefas que devem executar antes
  estimatedComplexity: number; // 1-10
  requiresInstallation: boolean;
  installCommand?: string;
  verificationCommand?: string; // Comando para verificar se já está instalado/configurado
}

export interface DecomposedTask {
  originalTask: string;
  subtasks: SubTask[];
  executionPlan: string; // Explicação da ordem de execução
}

const DECOMPOSER_PROMPT = `Você é um especialista em administração Linux. Sua tarefa é decompor uma instrução complexa em subtarefas atômicas e executáveis.

INSTRUÇÕES:
1. Analise a tarefa e identifique TODAS as subtarefas necessárias
2. Identifique dependências (ex: instalar antes de configurar)
3. Para cada subtarefa, gere:
   - description: Descrição clara da subtarefa
   - command: Comando Linux específico (ou null se for instalação)
   - dependencies: Array de IDs de subtarefas que devem executar ANTES
   - estimatedComplexity: 1-10 (1=simples, 10=complexo)
   - requiresInstallation: true se precisa instalar algo
   - installCommand: comando de instalação (apt/yum/dnf)
   - verificationCommand: comando para verificar se já existe

IMPORTANTE:
- Se precisar instalar algo, crie uma subtarefa separada ANTES
- Use comandos específicos, não genéricos
- Identifique dependências CORRETAMENTE (ex: precisa ter iptables antes de configurar regras)

TAREFA A DECOMPOR:
{{TASK}}

Responda APENAS com JSON válido neste formato:
{
  "subtasks": [
    {
      "id": "task-1",
      "description": "Verificar se netstat/ss está instalado",
      "command": null,
      "dependencies": [],
      "estimatedComplexity": 1,
      "requiresInstallation": false,
      "verificationCommand": "which ss || which netstat"
    },
    {
      "id": "task-2",
      "description": "Instalar net-tools se necessário",
      "command": null,
      "dependencies": ["task-1"],
      "estimatedComplexity": 2,
      "requiresInstallation": true,
      "installCommand": "apt-get update && apt-get install -y net-tools",
      "verificationCommand": "which netstat"
    }
  ],
  "executionPlan": "Primeiro verifica ferramentas, depois instala faltantes, então executa a tarefa principal"
}`;

/**
 * Converte ExecutionBlock para SubTask
 */
function blockToSubTask(block: ExecutionBlock, index: number): SubTask {
  return {
    id: `task-${index + 1}`,
    description: block.intent,
    command: block.steps.length > 0 ? block.steps[0].command : undefined,
    dependencies: index > 0 ? [`task-${index}`] : [],
    estimatedComplexity: Math.min(10, Math.max(1, block.steps.length * 2)),
    requiresInstallation: false,
    verificationCommand: block.validation_command,
  };
}

/**
 * Detecta contexto do sistema (simplificado)
 */
async function detectSystemContext(): Promise<SystemContext> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  let os = "linux";
  let pkgManager = "apt";

  try {
    const { stdout: osRelease } = await execAsync("cat /etc/os-release 2>/dev/null || true");

    if (osRelease.includes("ubuntu")) os = "ubuntu";
    else if (osRelease.includes("debian")) os = "debian";
    else if (osRelease.includes("fedora")) os = "fedora";
    else if (osRelease.includes("centos") || osRelease.includes("rhel")) os = "rhel";
    else if (osRelease.includes("arch")) os = "arch";

    // Detecta package manager
    const { stdout: whichApt } = await execAsync("which apt 2>/dev/null || true");
    const { stdout: whichDnf } = await execAsync("which dnf 2>/dev/null || true");
    const { stdout: whichPacman } = await execAsync("which pacman 2>/dev/null || true");

    if (whichDnf.trim()) pkgManager = "dnf";
    else if (whichPacman.trim()) pkgManager = "pacman";
    else if (whichApt.trim()) pkgManager = "apt";
  } catch {
    // Fallback silencioso
  }

  return {
    os,
    pkg_manager: pkgManager,
    is_root: process.getuid?.() === 0,
  };
}

export async function decomposeTask(
  task: string,
  model: string,
  provider: "anthropic" | "openai" | "openrouter" | "ollama" | "google"
): Promise<DecomposedTask> {
  logger.info(chalk.cyan("\n🧩 Decompondo tarefa complexa..."));
  logger.debug(`Provider: ${provider}, Model: ${model}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🧩 ECOA: Tenta compor de blocos existentes ANTES de chamar LLM
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  try {
    const context = await detectSystemContext();
    const composition = await composeExecution(task, context);

    if (composition.fully_composed && composition.matched_blocks.length > 0) {
      logger.info(chalk.green("✅ Solução composta de blocos existentes (skip LLM)"));
      logger.info(chalk.gray(`   ⏱️  Composição: ${composition.composition_time_ms}ms`));
      logger.info(chalk.gray(`   📦 Blocos reutilizados: ${composition.matched_blocks.length}`));

      // Converte blocos para subtasks
      const subtasks = composition.matched_blocks.map((block, i) => blockToSubTask(block, i));

      return {
        originalTask: task,
        subtasks,
        executionPlan: `Composição de ${composition.matched_blocks.length} blocos conhecidos (ECOA)`,
      };
    }

    if (composition.coverage > 0.5) {
      logger.info(chalk.yellow(
        `📦 ${Math.round(composition.coverage * 100)}% composto, LLM só para: ` +
        composition.missing_intents.join(", ")
      ));
      // Por enquanto, continua com LLM completo
      // TODO: Implementar decomposição parcial
    }
  } catch (error) {
    logger.debug(`Composição falhou, usando LLM: ${error}`);
  }
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const prompt = DECOMPOSER_PROMPT.replace("{{TASK}}", task);

  // Usar askAI para streaming da resposta
  let fullResponse = "";
  const stream = askAI("", prompt, model, provider, false);

  logger.debug("Iniciando streaming do modelo...");
  let chunkCount = 0;
  let hasError = false;

  try {
    for await (const chunk of stream) {
      chunkCount++;
      fullResponse += chunk;
      if (chunkCount % 10 === 0) {
        logger.debug(`Recebidos ${chunkCount} chunks, ${fullResponse.length} chars...`);
      }
    }
  } catch (error: any) {
    logger.error(chalk.red(`❌ Erro no streaming: ${error.message}`));
    hasError = true;
  }

  if (hasError || fullResponse.length === 0) {
    logger.warn(chalk.yellow("⚠️  Decomposição falhou, usando fallback"));
    return {
      originalTask: task,
      subtasks: [{
        id: "task-1",
        description: task,
        command: task,
        dependencies: [],
        estimatedComplexity: 5,
        requiresInstallation: false
      }],
      executionPlan: "Execução direta (fallback - streaming falhou)"
    };
  }

  logger.debug(`Stream completo: ${chunkCount} chunks, ${fullResponse.length} chars total`);
  
  if (fullResponse.length < 10) {
    logger.warn(chalk.yellow("⚠️  Resposta muito curta, usando fallback"));
    return {
      originalTask: task,
      subtasks: [{
        id: "task-1",
        description: task,
        command: task,
        dependencies: [],
        estimatedComplexity: 5,
        requiresInstallation: false
      }],
      executionPlan: "Execução direta (fallback - resposta incompleta)"
    };
  }
  
  logger.debug(`Primeiros 200 chars: ${fullResponse.substring(0, 200)}`);


  // Parse JSON da resposta
  try {
    // Extrair JSON do markdown se necessário
    let jsonStr = fullResponse.trim();

    // Remover metadata de markdown (---\nfilePath:...)
    jsonStr = jsonStr.replace(/^---[\s\S]*?\n\{/m, '{');
    
    // Se vier wrapped em ```json, extrair
    if (jsonStr.includes("```json")) {
      const match = jsonStr.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (match) {
        jsonStr = match[1];
      }
    } else if (jsonStr.includes("```")) {
      const match = jsonStr.match(/```\s*(\{[\s\S]*?\})\s*```/);
      if (match) {
        jsonStr = match[1];
      }
    }

    // Encontrar primeiro { e último }
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr);

    const result: DecomposedTask = {
      originalTask: task,
      subtasks: parsed.subtasks || [],
      executionPlan: parsed.executionPlan || "Execução sequencial baseada em dependências"
    };

    logger.info(chalk.green(`✅ Tarefa decomposta em ${result.subtasks.length} subtarefas`));
    logger.info(chalk.gray(`📋 Plano: ${result.executionPlan}`));

    return result;

  } catch (error) {
    logger.error(chalk.red("❌ Erro ao parsear resposta do decomposer:"), error);
    logger.debug("Resposta recebida (primeiros 500 chars):", fullResponse.substring(0, 500));
    logger.debug("Resposta recebida (últimos 500 chars):", fullResponse.substring(Math.max(0, fullResponse.length - 500)));

    // Fallback: retorna tarefa única
    return {
      originalTask: task,
      subtasks: [{
        id: "task-1",
        description: task,
        command: task,
        dependencies: [],
        estimatedComplexity: 5,
        requiresInstallation: false
      }],
      executionPlan: "Execução direta (fallback - decomposição falhou)"
    };
  }
}
