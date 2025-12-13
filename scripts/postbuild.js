#!/usr/bin/env node
/**
 * FazAI postbuild hook
 * 1. Cria / atualiza o diretório de logs padrão para evitar avisos na primeira execução
 * 2. Auto-gera completion scripts (Bash e Zsh) a partir de app.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

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

// Auto-generate completions
try {
  const { spawn } = await import("node:child_process");
  const completionGeneratorPath = path.join(projectRoot, "scripts/generate-completions.js");

  if (fs.existsSync(completionGeneratorPath)) {
    console.log("[fazai] 🔄 Regenerating completion scripts...");

    // Run the standalone generator
    await new Promise((resolve, reject) => {
      const generator = spawn("node", [completionGeneratorPath], {
        cwd: projectRoot,
        stdio: "pipe",
      });

      let stdout = "";
      let stderr = "";

      generator.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      generator.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      generator.on("close", (code) => {
        if (code === 0) {
          console.log(stdout);
          console.log("[fazai] ✅ Completion scripts regenerated successfully");
          resolve(true);
        } else {
          console.warn(`[fazai] ⚠️  Generator exited with code ${code}`);
          if (stderr) {
            console.warn(`[fazai]    ${stderr}`);
          }
          resolve(false); // Don't fail the build
        }
      });

      generator.on("error", (error) => {
        console.warn(`[fazai] ⚠️  Could not run completion generator: ${error.message}`);
        resolve(false); // Don't fail the build
      });
    });
  } else {
    console.log("[fazai] ℹ️  Completion generator script not found");
  }
} catch (error) {
  // Don't fail the build if completion generation fails
  console.warn(`[fazai] ⚠️  Could not regenerate completions: ${error instanceof Error ? error.message : String(error)}`);
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
