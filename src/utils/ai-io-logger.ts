/**
 * AI Input/Output Logger
 * 
 * Logs detalhados de todas as interações com modelos AI
 * Salva em /var/log/fazai/ai-io-debug.log
 * 
 * Propósito: Diagnosticar problemas de JSON parsing, streaming infinito,
 * e fallback de providers.
 */

import fs from "fs";
import path from "path";

const AI_IO_LOG_PATH = "/var/log/fazai/ai-io-debug.log";

// Garantir que o diretório existe
const logDir = path.dirname(AI_IO_LOG_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true, mode: 0o777 });
}

// Stream para escrita assíncrona
let logStream: fs.WriteStream | null = null;

function getStream(): fs.WriteStream {
  if (!logStream) {
    logStream = fs.createWriteStream(AI_IO_LOG_PATH, { flags: "a" });
  }
  return logStream;
}

// Cleanup ao sair
process.on("exit", () => {
  if (logStream) {
    logStream.end();
  }
});

interface AIRequestLog {
  timestamp: string;
  provider: string;
  model: string;
  task: string;
  systemInfo?: string;
}

interface AIResponseLog {
  timestamp: string;
  provider: string;
  model: string;
  success: boolean;
  chunkCount?: number;
  totalChars?: number;
  validCommands?: number;
  invalidCommands?: number;
  parseErrors?: number;
  error?: string;
  rawJSON?: string; // Primeiros 2000 chars do JSON
}

interface AIChunkLog {
  timestamp: string;
  provider: string;
  chunkNumber: number;
  content: string; // Primeiros 200 chars
}

/**
 * Log de request enviado para AI
 */
export function logAIRequest(data: {
  provider: string;
  model: string;
  task: string;
  systemInfo?: string;
}): void {
  const log: AIRequestLog = {
    timestamp: new Date().toISOString(),
    provider: data.provider,
    model: data.model,
    task: data.task.substring(0, 500), // Limita task
    systemInfo: data.systemInfo?.substring(0, 300),
  };

  const line = `\n${"=".repeat(80)}\n[REQUEST] ${log.timestamp}\nProvider: ${log.provider} | Model: ${log.model}\nTask: ${log.task}\n${log.systemInfo ? `System: ${log.systemInfo}\n` : ""}`;
  
  getStream().write(line);
}

/**
 * Log de chunk recebido (amostragem: apenas chunks específicos)
 * 
 * @param sampleRate Log apenas a cada N chunks (default: 50)
 */
export function logAIChunk(
  provider: string,
  chunkNumber: number,
  content: string,
  sampleRate: number = 50
): void {
  // Log apenas primeiro chunk e depois a cada sampleRate
  if (chunkNumber !== 1 && chunkNumber % sampleRate !== 0) {
    return;
  }

  const log: AIChunkLog = {
    timestamp: new Date().toISOString(),
    provider,
    chunkNumber,
    content: content.substring(0, 200),
  };

  const line = `[CHUNK #${log.chunkNumber}] ${log.timestamp} | ${log.provider}\n${log.content}${content.length > 200 ? "..." : ""}\n`;
  
  getStream().write(line);
}

/**
 * Log de resposta completa da AI
 */
export function logAIResponse(data: {
  provider: string;
  model: string;
  success: boolean;
  chunkCount?: number;
  totalChars?: number;
  validCommands?: number;
  invalidCommands?: number;
  parseErrors?: number;
  error?: string;
  rawJSON?: string;
}): void {
  const log: AIResponseLog = {
    timestamp: new Date().toISOString(),
    ...data,
    rawJSON: data.rawJSON?.substring(0, 2000), // Limita JSON
  };

  let line = `[RESPONSE] ${log.timestamp} | ${log.provider}/${log.model}\n`;
  line += `Success: ${log.success} | Chunks: ${log.chunkCount || 0} | Chars: ${log.totalChars || 0}\n`;
  line += `Valid: ${log.validCommands || 0} | Invalid: ${log.invalidCommands || 0} | Errors: ${log.parseErrors || 0}\n`;
  
  if (log.error) {
    line += `ERROR: ${log.error}\n`;
  }
  
  if (log.rawJSON) {
    line += `JSON (first 2000 chars):\n${log.rawJSON}${(data.rawJSON?.length || 0) > 2000 ? "\n... (truncated)" : ""}\n`;
  }
  
  line += `${"-".repeat(80)}\n`;
  
  getStream().write(line);
}

/**
 * Log de erro crítico (JSON parsing, timeout, etc)
 */
export function logAIError(
  provider: string,
  model: string,
  error: Error | string,
  context?: string
): void {
  const timestamp = new Date().toISOString();
  const errorMsg = error instanceof Error ? error.message : error;
  
  let line = `[ERROR] ${timestamp} | ${provider}/${model}\n`;
  line += `Error: ${errorMsg}\n`;
  if (context) {
    line += `Context: ${context}\n`;
  }
  line += `${"-".repeat(80)}\n`;
  
  getStream().write(line);
}

/**
 * Log de fallback entre providers
 */
export function logProviderFallback(
  fromProvider: string,
  toProvider: string,
  reason: string
): void {
  const timestamp = new Date().toISOString();
  
  const line = `[FALLBACK] ${timestamp}\n${fromProvider} → ${toProvider}\nReason: ${reason}\n${"-".repeat(80)}\n`;
  
  getStream().write(line);
}

/**
 * Flush forçado (para testes síncronos)
 */
export function flushAILog(): void {
  if (logStream) {
    // WriteStream não tem flush direto, mas podemos fechar e reabrir
    logStream.end();
    logStream = null;
  }
}
