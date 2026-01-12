/**
 * GenAI Runner - Executor de scripts GenAIScript COMPLETO
 * Integra GenAIScript runtime com FazAI com error handling robusto
 */

import { join } from "path";
import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { getConfigValue } from "../config.js";

// Compatível com CJS bundle - usa process.cwd() como fallback
const PROJECT_ROOT = process.env.FAZAI_PROJECT_ROOT || process.cwd();
const GENAISRC_DIR = join(PROJECT_ROOT, "genaisrc");

export interface GenAIRunOptions {
  script: string;
  vars?: Record<string, string>;
  model?: string;
  timeout?: number;
  verbose?: boolean;
  maxRetries?: number;
}

export interface GenAIRunResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  exitCode?: number;
  retries?: number;
}

/**
 * Valida se o script existe
 */
function validateScript(scriptName: string): string {
  const scriptPath = join(GENAISRC_DIR, scriptName);

  if (!existsSync(scriptPath)) {
    throw new Error(`Script não encontrado: ${scriptPath}`);
  }

  return scriptPath;
}

/**
 * Executa um script GenAIScript com error handling robusto
 */
export async function runGenAIScript(options: GenAIRunOptions): Promise<GenAIRunResult> {
  const {
    script,
    vars = {},
    model,
    timeout = 120000, // 2 minutos default
    verbose = false,
    maxRetries = 2,
  } = options;

  let retries = 0;
  let lastError: string | undefined;

  while (retries <= maxRetries) {
    try {
      const result = await executeScript({
        script,
        vars,
        model,
        timeout,
        verbose,
      });

      if (result.success) {
        return { ...result, retries };
      }

      // Se falhou mas não é erro de timeout, tenta de novo
      if (!result.error?.includes("timeout") && retries < maxRetries) {
        retries++;
        lastError = result.error;
        continue;
      }

      return { ...result, retries };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      retries++;

      if (retries > maxRetries) {
        return {
          success: false,
          output: "",
          error: `Falha após ${retries} tentativas: ${lastError}`,
          duration: 0,
          retries,
        };
      }
    }
  }

  return {
    success: false,
    output: "",
    error: lastError || "Erro desconhecido",
    duration: 0,
    retries,
  };
}

/**
 * Execução interna do script
 */
async function executeScript(options: Omit<GenAIRunOptions, "maxRetries">): Promise<GenAIRunResult> {
  const { script, vars = {}, model, timeout = 120000, verbose = false } = options;

  const startTime = Date.now();

  // Valida script
  let scriptPath: string;
  try {
    scriptPath = validateScript(script);
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }

  // Monta argumentos do CLI
  const args = ["genaiscript", "run", scriptPath];

  // Adiciona variáveis
  for (const [key, value] of Object.entries(vars)) {
    args.push("--vars", `${key}=${value}`);
  }

  // Modelo específico
  if (model) {
    args.push("--model", model);
  }

  return new Promise((resolve) => {
    let output = "";
    let error = "";
    let proc: ChildProcess;
    let timedOut = false;

    // Timeout handler
    const timeoutId = setTimeout(() => {
      timedOut = true;
      if (proc && !proc.killed) {
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (proc && !proc.killed) {
            proc.kill("SIGKILL");
          }
        }, 5000);
      }
    }, timeout);

    try {
      // Injeta variáveis do fazai.conf para o GenAIScript
      const ollamaBaseUrl = getConfigValue("OLLAMA_BASE_URL") || process.env.OLLAMA_BASE_URL;
      const anthropicApiKey = getConfigValue("ANTHROPIC_API_KEY") || process.env.ANTHROPIC_API_KEY;
      const openaiApiKey = getConfigValue("OPENAI_API_KEY") || process.env.OPENAI_API_KEY;
      const googleApiKey = getConfigValue("GEMINI_API_KEY") || process.env.GOOGLE_API_KEY;

      proc = spawn("npx", args, {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          GENAISCRIPT_DEFAULT_MODEL: model || process.env.GENAISCRIPT_DEFAULT_MODEL,
          // Injeta config do fazai.conf
          OLLAMA_BASE_URL: ollamaBaseUrl,
          ANTHROPIC_API_KEY: anthropicApiKey,
          OPENAI_API_KEY: openaiApiKey,
          GOOGLE_API_KEY: googleApiKey,
          // Força cores no output
          FORCE_COLOR: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });

      proc.stdout?.on("data", (data) => {
        const text = data.toString();
        output += text;
        if (verbose) {
          process.stdout.write(text);
        }
      });

      proc.stderr?.on("data", (data) => {
        const text = data.toString();
        error += text;
        if (verbose) {
          process.stderr.write(text);
        }
      });

      proc.on("close", (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (timedOut) {
          resolve({
            success: false,
            output: output.trim(),
            error: `Timeout após ${timeout}ms`,
            duration,
            exitCode: code ?? -1,
          });
          return;
        }

        resolve({
          success: code === 0,
          output: output.trim(),
          error: error.trim() || undefined,
          duration,
          exitCode: code ?? 0,
        });
      });

      proc.on("error", (err) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          output: output.trim(),
          error: `Erro de processo: ${err.message}`,
          duration,
          exitCode: -1,
        });
      });
    } catch (err) {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        output: "",
        error: `Erro ao iniciar processo: ${err instanceof Error ? err.message : String(err)}`,
        duration: Date.now() - startTime,
        exitCode: -1,
      });
    }
  });
}

/**
 * Executa o loop agêntico principal
 */
export async function runAgenticLoop(
  query: string,
  options: Partial<GenAIRunOptions> = {}
): Promise<GenAIRunResult> {
  return runGenAIScript({
    script: "fazai-core.genai.mjs",
    vars: { query },
    timeout: 180000, // 3 minutos para loop completo
    ...options,
  });
}

/**
 * Executa reflexão autônoma
 */
export async function runReflection(
  options: Partial<GenAIRunOptions> = {}
): Promise<GenAIRunResult> {
  return runGenAIScript({
    script: "reflect.genai.mjs",
    timeout: 60000, // 1 minuto para reflexão
    ...options,
  });
}

/**
 * Executa Skill Seeker
 */
export async function runSkillSeeker(
  query: string,
  mode: "detect" | "scrape" | "generate" = "detect",
  options: Partial<GenAIRunOptions> = {}
): Promise<GenAIRunResult> {
  return runGenAIScript({
    script: "skill-seeker.genai.mjs",
    vars: { query, mode },
    timeout: 120000,
    ...options,
  });
}

/**
 * Lista scripts disponíveis
 */
export async function listAvailableScripts(): Promise<string[]> {
  try {
    const files = await readdir(GENAISRC_DIR);
    return files.filter((f) => f.endsWith(".genai.mjs"));
  } catch {
    return [];
  }
}

/**
 * Verifica se GenAIScript está instalado
 */
export async function checkGenAIScriptInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("npx", ["genaiscript", "--version"], {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
    });

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", () => {
      resolve(false);
    });

    // Timeout de 10 segundos
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
        resolve(false);
      }
    }, 10000);
  });
}

/**
 * Obtém informações sobre o ambiente GenAIScript
 */
export async function getGenAIScriptInfo(): Promise<{
  installed: boolean;
  scriptsDir: string;
  scriptsCount: number;
  scripts: string[];
}> {
  const installed = await checkGenAIScriptInstalled();
  const scripts = await listAvailableScripts();

  return {
    installed,
    scriptsDir: GENAISRC_DIR,
    scriptsCount: scripts.length,
    scripts,
  };
}

export default {
  runGenAIScript,
  runAgenticLoop,
  runReflection,
  runSkillSeeker,
  listAvailableScripts,
  checkGenAIScriptInstalled,
  getGenAIScriptInfo,
};
