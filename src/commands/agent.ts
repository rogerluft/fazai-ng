/**
 * Comando: fazai agent
 * Interface CLI para o coração agêntico
 */

import chalk from "chalk";
import ora from "ora";
import { runAgenticLoop, runReflection, listAvailableScripts } from "../agentic/genai-runner.js";
import { AgenticLoop, runAgenticQuery } from "../agentic/agentic-loop.js";

const HELP = `
${chalk.bold.cyan("fazai agent")} - Coração Agêntico do FazAI

${chalk.bold("USAGE:")}
  fazai agent <subcommand> [options]

${chalk.bold("SUBCOMMANDS:")}
  ${chalk.green("loop")} <query>      Executa loop agêntico nativo completo (RECOMENDADO)
  ${chalk.green("run")} <query>       Executa via GenAIScript (requer npx genaiscript)
  ${chalk.green("reflect")}           Executa reflexão autônoma sobre aprendizados
  ${chalk.green("native")} <query>    Alias para loop (compatibilidade)
  ${chalk.green("scripts")}           Lista scripts GenAIScript disponíveis
  ${chalk.green("status")}            Mostra status do sistema agêntico

${chalk.bold("EXAMPLES:")}
  fazai agent loop "como otimizar embeddings locais no DL380"
  fazai agent loop "configure samba para compartilhamento" -v
  fazai agent run "teste com GenAIScript" --model ollama:phi3
  fazai agent reflect
  fazai agent status

${chalk.bold("OPTIONS:")}
  --verbose, -v       Mostra output detalhado
  --model, -m         Modelo a usar (ex: ollama:phi3, anthropic:claude-sonnet-4-5)
  --iterations, -i    Número máximo de iterações (default: 5)
`;

interface AgentOptions {
  verbose?: boolean;
  model?: string;
  iterations?: number;
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

export async function handleAgentCommand(args: string[]): Promise<void> {
  const { command, query, options } = parseArgs(args);

  switch (command) {
    case "run":
      await handleRun(query, options);
      break;

    case "loop":
      await handleLoop(query, options);
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
      await handleStatus();
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
