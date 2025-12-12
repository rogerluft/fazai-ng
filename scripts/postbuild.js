#!/usr/bin/env node
/**
 * FazAI postbuild hook
 * Cria / atualiza o diretório de logs padrão para evitar avisos na primeira execução.
 */
import fs from "node:fs";
import path from "node:path";

const LOG_DIR = process.env.FAZAI_LOG_DIR ?? "/var/log/fazai";
const LOG_FILE = path.join(LOG_DIR, "fazai.log");

if (process.platform === "win32") {
  process.exit(0);
}

try {
  ensureDir(LOG_DIR);
  ensureFile(LOG_FILE);
} catch (error) {
  if (isPermissionError(error)) {
    console.warn(`[fazai] ⚠️  Não foi possível preparar ${LOG_DIR}: ${error.message}`);
    console.warn("[fazai]     Execute manualmente: sudo mkdir -p /var/log/fazai && sudo chmod 775 /var/log/fazai");
  } else {
    console.warn(`[fazai] ⚠️  Postbuild não conseguiu preparar logs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function ensureDir(target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
    fs.chmodSync(target, 0o775);
    console.log(`[fazai] Diretório de log preparado em ${target}`);
    return;
  }

  try {
    const stats = fs.statSync(target);
    if (!stats.isDirectory()) {
      throw new Error(`${target} existe, mas não é um diretório`);
    }
  } catch (error) {
    throw error;
  }
}

function ensureFile(target) {
  try {
    if (!fs.existsSync(target)) {
      fs.closeSync(fs.openSync(target, "a"));
    }
  } catch (error) {
    if (!isPermissionError(error)) {
      throw error;
    }
  }
}

function isPermissionError(error) {
  return !!error && typeof error === "object" && "code" in error && error.code === "EACCES";
}

// Install bash completion
const COMPLETION_SOURCE = path.join(process.cwd(), "completion/fazai-completion.bash");
const COMPLETION_TARGET = "/etc/bash_completion.d/fazai";

try {
  if (fs.existsSync(COMPLETION_SOURCE)) {
    // Try to copy completion file
    fs.copyFileSync(COMPLETION_SOURCE, COMPLETION_TARGET);
    fs.chmodSync(COMPLETION_TARGET, 0o644);
    console.log(`[fazai] ✅ Bash completion instalado em ${COMPLETION_TARGET}`);
  } else {
    console.warn(`[fazai] ⚠️  Arquivo de completion não encontrado: ${COMPLETION_SOURCE}`);
  }
} catch (error) {
  if (isPermissionError(error)) {
    console.warn(`[fazai] ⚠️  Não foi possível instalar completion: permissão negada`);
    console.warn(`[fazai]     Execute manualmente: sudo cp ${COMPLETION_SOURCE} ${COMPLETION_TARGET}`);
  } else {
    console.warn(`[fazai] ⚠️  Erro ao instalar completion: ${error instanceof Error ? error.message : String(error)}`);
  }
}
