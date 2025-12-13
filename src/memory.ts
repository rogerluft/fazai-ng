import fs from "fs";
import path from "path";
import { logger } from "./logger";
import { FAZAI_PATHS, ensureFazaiDirectories } from "./utils/paths";

type ChatRole = "user" | "assistant";

export interface ConversationEntry {
  timestamp: string;
  role: ChatRole;
  content: string;
}

const DATA_DIR = FAZAI_PATHS.DATA;
const MEMORY_FILE = FAZAI_PATHS.MEMORY_FILE;
const COMMAND_HISTORY_FILE = FAZAI_PATHS.HISTORY_FILE;

function ensureDataDir(): void {
  ensureFazaiDirectories();
}

function readJsonFile<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) {
      return fallback;
    }
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn(`⚠️  Falha ao ler ${file}:`, error);
    return fallback;
  }
}

function writeJsonFile(file: string, value: unknown): void {
  try {
    ensureDataDir();
    fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf-8");
  } catch (error) {
    logger.warn(`⚠️  Falha ao salvar ${file}:`, error);
  }
}

export function loadConversationHistory(limit: number = 50): ConversationEntry[] {
  const entries = readJsonFile<ConversationEntry[]>(MEMORY_FILE, []);
  if (!Array.isArray(entries)) {
    return [];
  }
  if (limit <= 0) {
    return entries;
  }
  return entries.slice(-limit);
}

export function appendConversationEntry(entry: ConversationEntry): void {
  const entries = readJsonFile<ConversationEntry[]>(MEMORY_FILE, []);
  entries.push(entry);
  writeJsonFile(MEMORY_FILE, entries.slice(-500)); // Limita crescimento
}

export function loadCommandHistory(limit: number = 100): string[] {
  try {
    if (!fs.existsSync(COMMAND_HISTORY_FILE)) {
      return [];
    }
    const lines = fs.readFileSync(COMMAND_HISTORY_FILE, "utf-8").split(/\r?\n/).filter(Boolean);
    if (limit <= 0) {
      return lines;
    }
    return lines.slice(-limit);
  } catch (error) {
    logger.warn(`⚠️  Falha ao ler histórico de comandos:`, error);
    return [];
  }
}

export function appendCommandHistory(entry: string): void {
  try {
    ensureDataDir();
    fs.appendFileSync(COMMAND_HISTORY_FILE, `${entry}\n`, "utf-8");
  } catch (error) {
    logger.warn(`⚠️  Falha ao salvar histórico de comandos:`, error);
  }
}

export function clearPersistentMemory(): void {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      fs.unlinkSync(MEMORY_FILE);
    }
  } catch (error) {
    logger.warn(`⚠️  Falha ao limpar memória contextual:`, error);
  }
}

export function clearPersistentHistory(): void {
  try {
    if (fs.existsSync(COMMAND_HISTORY_FILE)) {
      fs.unlinkSync(COMMAND_HISTORY_FILE);
    }
  } catch (error) {
    logger.warn(`⚠️  Falha ao limpar histórico de comandos:`, error);
  }
}
