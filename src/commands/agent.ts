/**
 * Comando: fazai agent
 * Interface CLI para o coração agêntico
 */

import chalk from "chalk";
import ora from "ora";
import { runAgenticLoop, runReflection, listAvailableScripts } from "../agentic/genai-runner.js";
import { AgenticLoop, runAgenticQuery, BudgetAgenticLoop, runBudgetAgenticQuery } from "../agentic/agentic-loop.js";
import { getSessionManager } from "../agentic/session-manager.js";
import { getSkillRegistry, initSkillRegistry } from "../skills/registry.js";

const HELP = `
${chalk.bold.cyan("fazai agent")} - Coração Agêntico do FazAI

${chalk.bold("USAGE:")}
  fazai agent <subcommand> [options]

${chalk.bold("SUBCOMMANDS:")}
  ${chalk.green("loop")} <query>      Executa loop agêntico nativo completo (RECOMENDADO)
  ${chalk.green("budget")} <query>    Executa loop com budget tracking (max iterations + tokens)
  ${chalk.green("run")} <query>       Executa via GenAIScript (requer npx genaiscript)
  ${chalk.green("reflect")}           Executa reflexão autônoma sobre aprendizados
  ${chalk.green("native")} <query>    Alias para loop (compatibilidade)
  ${chalk.green("scripts")}           Lista scripts GenAIScript disponíveis
  ${chalk.green("status")} [id]       Mostra status do sistema ou sessão específica
  ${chalk.green("sessions")}          Lista todas as sessões agênticas
  ${chalk.green("skills")}            Lista skills/tools registrados
  ${chalk.green("use")} <skill>       Executa um skill registrado
  ${chalk.green("pause")} <id>        Pausa uma sessão em execução
  ${chalk.green("resume")} <id>       Retoma uma sessão pausada
  ${chalk.green("kill")} <id>         Encerra uma sessão
  ${chalk.green("claude-import")} <path> Importa uma skill do formato Claude (.claude/SKILL.md)

${chalk.bold("EXAMPLES:")}
  fazai agent loop "como otimizar embeddings locais no DL380"
  fazai agent budget "configure samba para compartilhamento" -i 20 --token-budget 100000
  fazai agent run "teste com GenAIScript" --model ollama:phi3
  fazai agent skills
  fazai agent use cleaner --mode analyze
  fazai agent claude-import ./meu-projeto
  fazai agent sessions
  fazai agent pause <session-id>
  fazai agent status <session-id>

${chalk.bold("OPTIONS:")}
  --verbose, -v         Mostra output detalhado
  --model, -m           Modelo a usar (ex: ollama:phi3, anthropic:claude-sonnet-4-5)
  --iterations, -i      Número máximo de iterações (default: from config or 5)
  --token-budget, -t    Budget máximo de tokens (default: from config or 50000)
`;

interface AgentOptions {
  verbose?: boolean;
  model?: string;
  iterations?: number;
  tokenBudget?: number;
}

function parseArgs(args: string[]): { command: string; query: string; options: AgentOptions } {
  const options: AgentOptions = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--model" || arg === "-m") {
      options.model = args[++i];
    } else if (arg === "--iterations" || arg === "-i") {
      options.iterations = parseInt(args[++i], 10);
    } else if (arg === "--token-budget" || arg === "-t") {
      options.tokenBudget = parseInt(args[++i], 10);
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  return {
    command: positional[0] || "help",
    query: positional.slice(1).join(" "),
    options,
  };
}

async function handleRun(query: string, options: AgentOptions): Promise<void> {
  if (!query) {
    console.error(chalk.red("Erro: Query é obrigatória"));
    console.log("Uso: fazai agent run <query>");
    return;
  }

  const spinner = ora("Executando loop agêntico via GenAIScript...").start();

  try {
    const result = await runAgenticLoop(query, {
      model: options.model || "ollama:phi3", // Prioritário: modelo local
      verbose: options.verbose,
    });

    spinner.stop();

    if (result.success) {
      console.log(chalk.green("\n✓ Loop agêntico concluído"));
      console.log(chalk.dim(`Duração: ${result.duration}ms`));
      console.log("\n" + result.output);
    } else {
      console.log(chalk.yellow("\n⚠ Loop concluído com avisos"));
      console.log(result.output);
      if (result.error) {
        console.log(chalk.red("Erro: " + result.error));
      }
    }
  } catch (error) {
    spinner.fail("Erro ao executar loop agêntico");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function handleLoop(query: string, options: AgentOptions): Promise<void> {
  if (!query) {
    console.error(chalk.red("Erro: Query é obrigatória"));
    console.log("Uso: fazai agent loop <query>");
    return;
  }

  console.log(chalk.cyan("\n🔄 Iniciando Loop Agêntico Completo..."));
  console.log(chalk.dim(`Query: "${query}"`));
  console.log(chalk.dim(`Iterações máx: ${options.iterations || 5}`));
  console.log();

  const spinner = ora("Executando loop nativo com reflexão...").start();

  try {
    const loop = new AgenticLoop({
      maxIterations: options.iterations || 5,
      enableReflection: true,
      enableLearning: true,
      verbose: options.verbose,
    });

    const state = await loop.run(query);
    spinner.stop();

    console.log(loop.formatOutput(state));

    // Verifica se detectou gap de conhecimento
    if (state.context.length < 3) {
      console.log(chalk.yellow("\n⚠ Gap de conhecimento detectado!"));
      console.log(chalk.dim("Sugestão: Use 'fazai agent skill-seek' para auto-gerar skills"));
    }
  } catch (error) {
    spinner.fail("Erro ao executar loop");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function handleReflect(options: AgentOptions): Promise<void> {
  const spinner = ora("Executando reflexão autônoma...").start();

  try {
    const result = await runReflection({
      model: options.model,
      verbose: options.verbose,
    });

    spinner.stop();

    if (result.success) {
      console.log(chalk.green("\n✓ Reflexão concluída"));
      console.log(chalk.dim(`Duração: ${result.duration}ms`));
      console.log("\n" + result.output);
    } else {
      console.log(chalk.yellow("\n⚠ Reflexão concluída com avisos"));
      if (result.error) {
        console.log(chalk.red("Erro: " + result.error));
      }
    }
  } catch (error) {
    spinner.fail("Erro ao executar reflexão");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function handleNative(query: string, options: AgentOptions): Promise<void> {
  if (!query) {
    console.error(chalk.red("Erro: Query é obrigatória"));
    console.log("Uso: fazai agent native <query>");
    return;
  }

  const spinner = ora("Executando loop agêntico nativo...").start();

  try {
    const loop = new AgenticLoop({
      maxIterations: options.iterations || 5,
      enableReflection: true,
      enableLearning: true,
      verbose: options.verbose,
    });

    const state = await loop.run(query);
    spinner.stop();

    console.log(chalk.green("\n✓ Loop agêntico nativo concluído"));
    console.log(loop.formatOutput(state));
  } catch (error) {
    spinner.fail("Erro ao executar loop nativo");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function handleScripts(): Promise<void> {
  try {
    const scripts = await listAvailableScripts();
    console.log(chalk.bold("\nScripts GenAIScript disponíveis:"));
    scripts.forEach((s) => {
      console.log(chalk.green(`  • ${s}`));
    });
  } catch (error) {
    console.error(chalk.red("Erro ao listar scripts"));
    console.error(error instanceof Error ? error.message : String(error));
  }
}

async function handleStatus(): Promise<void> {
  console.log(chalk.bold("\n=== Status do Sistema Agêntico ===\n"));

  // Verifica Qdrant
  const spinner = ora("Verificando conexões...").start();

  try {
    const { QdrantClient } = await import("@qdrant/js-client-rest");
    const client = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" });
    const collections = await client.getCollections();

    spinner.succeed("Qdrant conectado");
    console.log(chalk.dim(`  Collections: ${collections.collections.map((c) => c.name).join(", ")}`));
  } catch {
    spinner.fail("Qdrant não disponível");
  }

  // Verifica GenAIScript
  const spinner2 = ora("Verificando GenAIScript...").start();
  try {
    const scripts = await listAvailableScripts();
    spinner2.succeed(`GenAIScript configurado (${scripts.length} scripts)`);
  } catch {
    spinner2.fail("GenAIScript não configurado");
  }

  console.log();
}

async function handleBudgetLoop(query: string, options: AgentOptions): Promise<void> {
  if (!query) {
    console.error(chalk.red("Erro: Query é obrigatória"));
    console.log("Uso: fazai agent budget <query>");
    return;
  }

  console.log(chalk.cyan("\n💰 Iniciando Budget Agentic Loop..."));
  console.log(chalk.dim(`Query: "${query}"`));
  console.log(chalk.dim(`Max Iterações: ${options.iterations || 'config default'}`));
  console.log(chalk.dim(`Token Budget: ${options.tokenBudget || 'config default'}`));
  console.log();

  const spinner = ora("Executando loop com budget tracking...").start();

  try {
    const loop = new BudgetAgenticLoop({
      maxIterations: options.iterations,
      enableReflection: true,
      enableLearning: true,
      verbose: options.verbose,
      budget: {
        maxIterations: options.iterations,
        tokenBudget: options.tokenBudget,
      },
    });

    const result = await loop.runWithBudget(query);
    spinner.stop();

    console.log(loop.formatBudgetOutput(result));

    if (result.exitReason === "circuit_breaker") {
      console.log(chalk.yellow("\n⚠ Circuit breaker ativado! Considere ajustar a query."));
    } else if (result.exitReason === "budget_exhausted") {
      console.log(chalk.yellow("\n💰 Budget esgotado. Use --token-budget ou --iterations para aumentar."));
    }
  } catch (error) {
    spinner.fail("Erro ao executar budget loop");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function handleSessions(): Promise<void> {
  const manager = getSessionManager();
  const sessions = manager.listSessions();

  if (sessions.length === 0) {
    console.log(chalk.dim("\nNenhuma sessão agêntica ativa."));
    return;
  }

  console.log(chalk.bold(`\n=== Sessões Agênticas (${sessions.length}) ===\n`));
  for (const session of sessions) {
    const stateColor = {
      running: chalk.green,
      paused: chalk.yellow,
      completed: chalk.cyan,
      failed: chalk.red,
      killed: chalk.gray,
    };
    const colorFn = stateColor[session.state] || chalk.white;
    console.log(colorFn(manager.formatSession(session)));
    console.log();
  }
}

async function handlePause(sessionId: string): Promise<void> {
  if (!sessionId) {
    console.error(chalk.red("Erro: Session ID é obrigatório"));
    console.log("Uso: fazai agent pause <session-id>");
    return;
  }

  const manager = getSessionManager();
  const success = manager.pauseSession(sessionId);

  if (success) {
    console.log(chalk.yellow(`⏸️  Sessão ${sessionId} pausada.`));
  } else {
    console.error(chalk.red(`❌ Não foi possível pausar a sessão ${sessionId}`));
  }
}

async function handleResume(sessionId: string): Promise<void> {
  if (!sessionId) {
    console.error(chalk.red("Erro: Session ID é obrigatório"));
    console.log("Uso: fazai agent resume <session-id>");
    return;
  }

  const manager = getSessionManager();
  const success = manager.resumeSession(sessionId);

  if (success) {
    console.log(chalk.green(`▶️  Sessão ${sessionId} retomada.`));
  } else {
    console.error(chalk.red(`❌ Não foi possível retomar a sessão ${sessionId}`));
  }
}

async function handleKill(sessionId: string): Promise<void> {
  if (!sessionId) {
    console.error(chalk.red("Erro: Session ID é obrigatório"));
    console.log("Uso: fazai agent kill <session-id>");
    return;
  }

  const manager = getSessionManager();
  const success = manager.killSession(sessionId);

  if (success) {
    console.log(chalk.red(`💀 Sessão ${sessionId} encerrada.`));
  } else {
    console.error(chalk.red(`❌ Não foi possível encerrar a sessão ${sessionId}`));
  }
}

async function handleSessionStatus(sessionId: string): Promise<void> {
  if (!sessionId) {
    // Fall back to system status
    await handleStatus();
    return;
  }

  const manager = getSessionManager();
  const session = manager.getSession(sessionId);

  if (!session) {
    console.error(chalk.red(`❌ Sessão não encontrada: ${sessionId}`));
    return;
  }

  console.log(chalk.bold("\n=== Sessão Agêntica ==="));
  console.log(manager.formatSession(session));
}

async function handleSkills(): Promise<void> {
  const spinner = ora("Discovering skills...").start();

  try {
    const registry = await initSkillRegistry();
    spinner.stop();

    const count = registry.count();
    console.log(chalk.bold(`\n=== Skills Registrados (${count}) ===\n`));
    console.log(registry.formatSkillList());
    console.log();
  } catch (error) {
    spinner.fail("Erro ao descobrir skills");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function handleUse(skillId: string, options: AgentOptions): Promise<void> {
  if (!skillId) {
    console.error(chalk.red("Erro: Skill ID é obrigatório"));
    console.log("Uso: fazai agent use <skill-id> [--mode <mode>]");
    return;
  }

  const spinner = ora(`Loading skill: ${skillId}...`).start();

  try {
    const registry = await initSkillRegistry();
    const skill = registry.get(skillId);

    if (!skill) {
      spinner.fail(`Skill não encontrado: ${skillId}`);
      console.log(chalk.dim(`Skills disponíveis: ${registry.list().map(s => s.id).join(", ")}`));
      return;
    }

    spinner.text = `Executing: ${skill.name}...`;

    const input: Record<string, unknown> = {};
    if (options.model) input.model = options.model;
    if (options.verbose) input.verbose = options.verbose;

    const result = await registry.execute(skillId, input);
    spinner.stop();

    if (result.success) {
      console.log(chalk.green(`\n✓ ${skill.name} concluído (${result.duration}ms)`));
      if (result.output) console.log("\n" + result.output);
    } else {
      console.log(chalk.red(`\n✗ ${skill.name} falhou (${result.duration}ms)`));
      if (result.error) console.log(chalk.red("Erro: " + result.error));
    }
  } catch (error) {
    spinner.fail("Erro ao executar skill");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function handleClaudeImport(pathArg: string): Promise<void> {
  if (!pathArg) {
    console.error(chalk.red("Erro: Caminho é obrigatório"));
    console.log("Uso: fazai agent claude-import <path>");
    return;
  }

  const spinner = ora(`Importing Claude skill from: ${pathArg}...`).start();

  try {
    const { claudeConverterSkill } = await import("../skills/claude-converter.js");
    const result = await claudeConverterSkill.handler({ targetPath: pathArg });
    
    spinner.stop();

    if (result.success) {
      console.log(chalk.green("\n✓ Importação concluída!"));
      console.log(result.output);
    } else {
      console.log(chalk.red("\n✗ Falha na importação"));
      console.error(result.error);
    }
  } catch (error) {
    spinner.fail("Erro fatal ao importar skill");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

export async function handleAgentCommand(args: string[]): Promise<void> {
  const { command, query, options } = parseArgs(args);

  switch (command) {
    case "run":
      await handleRun(query, options);
      break;

    case "loop":
      await handleLoop(query, options);
      break;

    case "budget":
      await handleBudgetLoop(query, options);
      break;

    case "reflect":
      await handleReflect(options);
      break;

    case "native":
      await handleNative(query, options);
      break;

    case "scripts":
      await handleScripts();
      break;

    case "status":
      await handleSessionStatus(query);
      break;

    case "sessions":
      await handleSessions();
      break;

    case "pause":
      await handlePause(query);
      break;

    case "resume":
      await handleResume(query);
      break;

    case "kill":
      await handleKill(query);
      break;

    case "skills":
      await handleSkills();
      break;

    case "use":
      await handleUse(query, options);
      break;

    case "claude-import":
      await handleClaudeImport(query);
      break;

    case "help":
    case "--help":
    case "-h":
    default:
      console.log(HELP);
      break;
  }
}

export default handleAgentCommand;
