import fs from "fs";
import os from "os";
import path from "path";
import util from "util";
import chalk from "chalk";
import { getConfigValue } from "./config";

type LogLevel = "error" | "warn" | "info" | "debug";

type LoggerInitOptions = {
  levelOverride?: LogLevel;
  logFilePathOverride?: string;
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const ANSI_REGEX = /[\u001B\u009B][[\]()#;?]*(?:(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~])/g;

function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, "");
}

function parseLogLevel(raw?: string | null): LogLevel | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim().toLowerCase();
  if (value === "error" || value === "warn" || value === "info" || value === "debug") {
    return value;
  }
  return null;
}

let currentLevel: LogLevel = "info";
let logFilePath: string | null = null;
let logStream: fs.WriteStream | null = null;
let debugFilePath: string | null = null;
let debugStream: fs.WriteStream | null = null;
let hasWarnedAboutLogFile = false;

// Rate limiter para evitar loop infinito de logs
const LOG_RATE_LIMIT = {
  count: 0,
  lastReset: Date.now(),
  maxPerSecond: 200, // Aumentado para suportar streaming com amostragem
  killed: false,
  killedAt: 0,
  cooldownMs: 5000, // Recuperação automática após 5 segundos sem excesso
};

function checkRateLimit(): boolean {
  const now = Date.now();

  // Cooldown: recuperar automaticamente após 5 segundos
  if (LOG_RATE_LIMIT.killed) {
    if (now - LOG_RATE_LIMIT.killedAt > LOG_RATE_LIMIT.cooldownMs) {
      LOG_RATE_LIMIT.killed = false;
      LOG_RATE_LIMIT.count = 0;
      LOG_RATE_LIMIT.lastReset = now;
      // Silenciosamente recuperado - não logar para evitar recursão
    } else {
      return false;
    }
  }

  // Reset contador a cada segundo
  if (now - LOG_RATE_LIMIT.lastReset > 1000) {
    LOG_RATE_LIMIT.count = 0;
    LOG_RATE_LIMIT.lastReset = now;
  }

  LOG_RATE_LIMIT.count++;

  if (LOG_RATE_LIMIT.count > LOG_RATE_LIMIT.maxPerSecond) {
    LOG_RATE_LIMIT.killed = true;
    LOG_RATE_LIMIT.killedAt = now;
    console.error(`\n🛑 LOOP DETECTADO: Logger pausado (>${LOG_RATE_LIMIT.maxPerSecond} logs/seg). Recuperação automática em ${LOG_RATE_LIMIT.cooldownMs/1000}s.\n`);
    return false;
  }

  return true;
}

function closeStream(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
  if (debugStream) {
    debugStream.end();
    debugStream = null;
  }
}

function ensureStream(targetPath: string, isDebug: boolean = false): void {
  if (!isDebug) {
    if (logFilePath === targetPath && logStream) {
      return;
    }
    if (logStream) {
      logStream.end();
      logStream = null;
    }
  } else {
    if (debugFilePath === targetPath && debugStream) {
      return;
    }
    if (debugStream) {
      debugStream.end();
      debugStream = null;
    }
  }

  try {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const stream = fs.createWriteStream(targetPath, { flags: "a" });
    stream.on("error", (error) => {
      if (!hasWarnedAboutLogFile) {
        console.warn(chalk.yellow(`⚠️  Falha ao escrever log em ${targetPath}: ${error}`));
        hasWarnedAboutLogFile = true;
      }
      if (!isDebug) {
        if (logStream) { logStream.end(); logStream = null; }
      } else {
        if (debugStream) { debugStream.end(); debugStream = null; }
      }
    });

    if (!isDebug) {
      logStream = stream;
      logFilePath = targetPath;
    } else {
      debugStream = stream;
      debugFilePath = targetPath;
    }
  } catch (error) {
    if (!hasWarnedAboutLogFile) {
      console.warn(chalk.yellow(`⚠️  Não foi possível criar diretório de log (${targetPath}): ${error}`));
      hasWarnedAboutLogFile = true;
    }
    if (!isDebug) {
      if (logStream) { logStream.end(); logStream = null; }
    } else {
      if (debugStream) { debugStream.end(); debugStream = null; }
    }
  }
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      return util.inspect(arg, { depth: 4, colors: chalk.level > 0 });
    })
    .join(" ");
}

function writeToFile(level: LogLevel, rawArgs: unknown[]): void {
  const stream = level === 'debug' ? debugStream : logStream;
  const filePath = level === 'debug' ? debugFilePath : logFilePath;

  if (!stream || !filePath) {
    return;
  }
  const timestamp = new Date().toISOString();

  // Structured Logging Logic
  let content = "";
  if (rawArgs.length === 1 && typeof rawArgs[0] === 'object' && rawArgs[0] !== null) {
    content = JSON.stringify(rawArgs[0]);
  } else {
    content = stripAnsi(formatArgs(rawArgs));
  }

  stream.write(`${timestamp} [${level.toUpperCase()}] ${content}\n`);
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[currentLevel];
}

function log(level: LogLevel, ...args: unknown[]): void {
  // Rate limit para evitar loop infinito consumir memória
  if (!checkRateLimit()) return;

  const message = formatArgs(args); // For console/tracker (human readable)
  writeToFile(level, args); // Pass raw args to file writer for structure check

  // BUGFIX: Captura erros reais no error-tracker
  if (level === "error") {
    try {
      // Import dinâmico para evitar dependência circular
      import("./error-tracker").then(({ errorTracker }) => {
        // Detecta tipo de erro pela mensagem
        let errorType: "api" | "cache" | "provider" | "system" | "network" | "validation" = "system";
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.includes("api") || lowerMsg.includes("cloudflare") || lowerMsg.includes("openai")) {
          errorType = "api";
        } else if (lowerMsg.includes("cache")) {
          errorType = "cache";
        } else if (lowerMsg.includes("provider") || lowerMsg.includes("ollama") || lowerMsg.includes("anthropic")) {
          errorType = "provider";
        } else if (lowerMsg.includes("network") || lowerMsg.includes("econnrefused") || lowerMsg.includes("timeout")) {
          errorType = "network";
        } else if (lowerMsg.includes("validation") || lowerMsg.includes("invalid")) {
          errorType = "validation";
        }

        errorTracker.captureError(errorType, message);
      }).catch(() => {
        // Silenciosamente falha se error-tracker não disponível
      });
    } catch {
      // Ignora erros no tracking
    }
  }

  if (!shouldLog(level)) {
    return;
  }

  switch (level) {
    case "error":
      console.error(message);
      break;
    case "warn":
      console.warn(message);
      break;
    case "info":
      console.log(message);
      break;
    case "debug":
      console.debug(message);
      break;
  }
}

export function initLogger(options: LoggerInitOptions = {}): void {
  const envLevel = parseLogLevel(process.env.FAZAI_LOG_LEVEL ?? null);
  const envLogPath = process.env.FAZAI_LOG_FILE?.trim();
  const configLevel = parseLogLevel(getConfigValue("LOG_LEVEL"));
  const configLogPath = getConfigValue("LOG_FILE_PATH")?.trim();

  const level = options.levelOverride ?? envLevel ?? configLevel ?? currentLevel;
  currentLevel = level;

  // Logs em arquivo fixo (facilita tracking do estado atual e diagnóstico)
  const defaultLogPath = `/var/log/fazai/fazai.log`;
  const fallbackLogPath = path.join(process.cwd(), `fazai.log`);
  const defaultDebugPath = `/var/log/fazai/fazai-debug.log`;
  const fallbackDebugPath = path.join(process.cwd(), `fazai-debug.log`);

  const logPathCandidate = options.logFilePathOverride ?? envLogPath ?? configLogPath ?? defaultLogPath;

  ensureStream(logPathCandidate, false);
  if (!logStream) {
    ensureStream(fallbackLogPath, false);
  }

  ensureStream(defaultDebugPath, true);
  if (!debugStream) {
    ensureStream(fallbackDebugPath, true);
  }
}

export const logger = {
  error: (...args: unknown[]) => log("error", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  info: (...args: unknown[]) => log("info", ...args),
  debug: (...args: unknown[]) => log("debug", ...args),
  getLevel: (): LogLevel => currentLevel,
};

// Inicializa com valores padrão ao importar o módulo.
initLogger();
