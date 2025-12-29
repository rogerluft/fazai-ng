import fs from "fs";
import path from "path";

export const CONFIG_FILE_NAME = "fazai.conf";
const CONFIG_ENV_PATH = "FAZAI_CONFIG_PATH";

// ============================================================================
// CONFIGURATION POLICY (v3.4.3-beta)
// ============================================================================
//
// CENTRALIZED CONFIG: /etc/fazai/fazai.conf ONLY
//
// Previous versions supported ~/.config/fazai/fazai.conf (user-local config)
// This has been REMOVED to prevent "2 owners, dog dies hungry" syndrome:
//   - Eliminates config conflicts and confusion
//   - Single source of truth for all users
//   - Simpler troubleshooting and maintenance
//
// Migration: install.sh handles automatic migration from old location
//
// Why /etc/fazai/ instead of ~/.config/?
//   1. FazAI is a system administration tool (needs root context)
//   2. Configuration should be global (all users share same providers/keys)
//   3. Professional deployment standard (/etc for system services)
//   4. Easier backup and version control
//
// Permissions: chmod 644 /etc/fazai/fazai.conf (readable by all, writable by root)
// Owner: root:root (or your user for development environments)
// ============================================================================

// System-wide configuration directory (standard Linux location)
const SYSTEM_CONFIG_DIR = "/etc/fazai";
const SYSTEM_CONFIG_PATH = path.join(SYSTEM_CONFIG_DIR, CONFIG_FILE_NAME);

// Fallback apenas para desenvolvimento (se /etc/fazai não existir)
const DEFAULT_WRITE_PATH = path.join(process.cwd(), CONFIG_FILE_NAME);

function getExplicitPath(): string | undefined {
  const explicitPath = process.env[CONFIG_ENV_PATH];
  if (explicitPath && explicitPath.trim().length > 0) {
    return path.resolve(explicitPath.trim());
  }
  return undefined;
}

/**
 * Get search paths for configuration file
 *
 * Search order (priority descending):
 * 1. /etc/fazai/fazai.conf (SYSTEM - primary location)
 * 2. ./fazai.conf (CURRENT DIRECTORY - local development override)
 * 3. <script-dir>/fazai.conf (SCRIPT DIRECTORY - development)
 *
 * REMOVED: ~/.config/fazai/fazai.conf (eliminated to prevent conflicts)
 * REMOVED: ~/fazai.conf (eliminated to prevent conflicts)
 */
function getSearchPaths(): string[] {
  const paths: string[] = [];

  // Prioridade 1: System-wide config (/etc/fazai/fazai.conf)
  // Este é o local oficial para produção
  paths.push(SYSTEM_CONFIG_PATH);

  // Prioridade 2: Current working directory (./fazai.conf)
  // Útil para desenvolvimento e testes locais
  const cwdPath = path.resolve(process.cwd(), CONFIG_FILE_NAME);
  paths.push(cwdPath);

  // Prioridade 3: Script directory (desenvolvimento com npm link)
  // Permite testar durante desenvolvimento antes de instalar
  if (process.argv[1]) {
    const scriptPath = path.resolve(process.argv[1]);
    const scriptDir = path.dirname(scriptPath);
    paths.push(path.join(scriptDir, CONFIG_FILE_NAME));
    paths.push(path.join(path.resolve(scriptDir, ".."), CONFIG_FILE_NAME));
  }

  // Deduplicate preserving order
  return Array.from(new Set(paths));
}

function findExistingConfigPath(): string | undefined {
  const explicit = getExplicitPath();
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }

  for (const candidate of getSearchPaths()) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function resolveConfigPath(): string {
  const explicit = getExplicitPath();
  const existing = findExistingConfigPath();

  if (existing) {
    return existing;
  }

  if (explicit) {
    return explicit;
  }

  return DEFAULT_WRITE_PATH;
}

function readConfigLines(): string[] {
  const configPath = resolveConfigPath();
  if (!fs.existsSync(configPath)) {
    return [];
  }

  const content = fs.readFileSync(configPath, "utf-8");
  return content.split(/\r?\n/);
}

function writeConfigLines(lines: string[]): void {
  const configPath = resolveConfigPath();
  const content = lines.join("\n").replace(/\n+$/g, "\n");
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configPath, content.endsWith("\n") ? content : `${content}\n`, { encoding: "utf-8" });
}

export function getConfigValue(key: string): string | undefined {
  const lines = readConfigLines();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const [entryKey, ...rest] = line.split("=");
    if (entryKey === key) {
      return rest.join("=").trim();
    }
  }
  return undefined;
}

export function setConfigValue(key: string, value: string): void {
  const lines = readConfigLines();
  const filtered = lines.filter((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      return true;
    }
    return !line.startsWith(`${key}=`);
  });

  filtered.push(`${key}=${value}`);
  writeConfigLines(filtered);
}

export function listConfigEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  const lines = readConfigLines();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const [entryKey, ...rest] = line.split("=");
    if (entryKey) {
      entries[entryKey] = rest.join("=").trim();
    }
  }
  return entries;
}

export function getConfigFilePath(): string {
  return resolveConfigPath();
}

export function configFileExists(): boolean {
  return findExistingConfigPath() !== undefined;
}

export function getConfigSearchPaths(): string[] {
  return getSearchPaths();
}

export function getSystemConfigDir(): string {
  return SYSTEM_CONFIG_DIR;
}

export function getSystemConfigPath(): string {
  return SYSTEM_CONFIG_PATH;
}

export function getLocalInferenceModel(): string {
  return getConfigValue("LOCAL_INFERENCE_MODEL") || "ollama:llama3";
}

/**
 * Get Ollama base URL from config or environment
 * Priority: OLLAMA_BASE_URL from config > env > default (localhost:11434)
 */
export function getOllamaUrl(): string {
  return (
    getConfigValue("OLLAMA_BASE_URL") ||
    process.env.OLLAMA_BASE_URL ||
    "http://localhost:11434"
  );
}

/**
 * Get Qdrant URL from config or environment
 * Priority: QDRANT_URL from config > env > default (localhost:6333)
 */
export function getQdrantUrl(): string {
  return (
    getConfigValue("QDRANT_URL") ||
    process.env.QDRANT_URL ||
    "http://localhost:6333"
  );
}

/**
 * Load all config values as an object with camelCase keys
 */
export function loadConfig(): Record<string, string> {
  const raw = listConfigEntries();
  const config: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(raw)) {
    // Convert SCREAMING_SNAKE_CASE to camelCase
    const camelKey = key
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    config[camelKey] = value;
  }
  
  return config;
}
