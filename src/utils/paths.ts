/**
 * Centralized Path Management - Single Source of Truth
 *
 * Arquitetura Simples e Portátil:
 * - /opt/fazai/          → Tudo da aplicação (binários, dados, scripts)
 * - /var/log/fazai/      → Logs do sistema
 * - /etc/fazai/          → Configuração global
 *
 * Dois modos de instalação:
 * 1. Produção (curl | bash): Instalação standalone em /opt/fazai
 * 2. Desenvolvimento (git clone): Links simbólicos para o repo
 */

import fs from "fs";
import path from "path";
import { logger } from "../logger";

/**
 * Detect if running in development mode (symlinked /opt/fazai)
 * Development: /opt/fazai/* are symlinks to ~/fazai-ng/*
 * Production: /opt/fazai/* are real directories
 */
function getInstallDir(): string {
  const optFazai = "/opt/fazai";

  try {
    // Check if /opt/fazai/dist is a symlink (development mode)
    const distPath = path.join(optFazai, "dist");
    const stats = fs.lstatSync(distPath);

    if (stats.isSymbolicLink()) {
      // Development mode: resolve symlink to get real repo path
      const realDist = fs.realpathSync(distPath);
      const repoPath = path.dirname(realDist); // Go up from dist to repo root
      return repoPath;
    }
  } catch {
    // /opt/fazai/dist doesn't exist or not accessible
  }

  // Production mode or fallback
  return process.env.FAZAI_INSTALL_DIR || optFazai;
}

/**
 * Base installation directory
 * Auto-detects development vs production mode
 */
const INSTALL_DIR = getInstallDir();

/**
 * All FazAI paths in one place
 */
export const FAZAI_PATHS = {
  // Base directories
  INSTALL: INSTALL_DIR,
  DATA: path.join(INSTALL_DIR, "data"),

  // Configuration (system-wide)
  CONFIG_DIR: "/etc/fazai",
  CONFIG_FILE: "/etc/fazai/fazai.conf",
  ALIASES_FILE: "/etc/fazai/fzalias",

  // Logs (system-wide)
  LOG_DIR: "/var/log/fazai",

  // Data files (portable - inside /opt/fazai)
  MEMORY_FILE: path.join(INSTALL_DIR, "data", "memory.json"),
  HISTORY_FILE: path.join(INSTALL_DIR, "data", "history.log"),
  API_CACHE_FILE: path.join(INSTALL_DIR, "data", "api-cache.json"),
  EMBEDDING_CACHE_FILE: path.join(INSTALL_DIR, "data", "embedding-cache.json"),
  RESEARCH_CACHE_FILE: path.join(INSTALL_DIR, "data", "research-cache.json"),
} as const;

/**
 * Ensure all required directories exist
 * Creates with proper permissions
 */
export function ensureFazaiDirectories(): void {
  const dirs = [FAZAI_PATHS.DATA];

  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        logger.debug(`Created directory: ${dir}`);
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Failed to create ${dir}: ${err.message}`);
    }
  }
}

/**
 * Get current date-based log file path
 */
export function getCurrentLogPath(): string {
  const logDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(FAZAI_PATHS.LOG_DIR, `${logDate}.log`);
}

/**
 * Check if running in development mode
 * (when cloned with git clone)
 */
export function isDevelopmentMode(): boolean {
  // Check if we're in a git repo
  const gitDir = path.join(process.cwd(), ".git");
  return fs.existsSync(gitDir);
}

/**
 * Get appropriate data directory based on mode
 * Development: use repo directory
 * Production: use /opt/fazai/data
 */
export function getDataDir(): string {
  if (isDevelopmentMode() && process.env.FAZAI_DEV_MODE === "1") {
    return path.join(process.cwd(), "data");
  }
  return FAZAI_PATHS.DATA;
}
