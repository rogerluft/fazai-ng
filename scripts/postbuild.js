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
    const generationSuccess = await new Promise((resolve, reject) => {
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

    // Auto-install bash completion if generation succeeded
    if (generationSuccess) {
      await installBashCompletion();
    }
  } else {
    console.log("[fazai] ℹ️  Completion generator script not found");
  }
} catch (error) {
  // Don't fail the build if completion generation fails
  console.warn(`[fazai] ⚠️  Could not regenerate completions: ${error instanceof Error ? error.message : String(error)}`);
}

/**
 * Auto-install bash completion to system directory
 * Detects CI environment and permission issues, with graceful fallback
 */
async function installBashCompletion() {
  const sourceFile = path.join(projectRoot, "completion/fazai-completion.bash");
  const targetDir = "/etc/bash_completion.d";
  const targetFile = path.join(targetDir, "fazai-completion.bash");

  // Skip installation in CI/CD environments
  if (process.env.CI === "true" || process.env.CONTINUOUS_INTEGRATION === "true") {
    console.log("[fazai] ℹ️  CI environment detected - skipping completion installation");
    return;
  }

  // Check if source file exists
  if (!fs.existsSync(sourceFile)) {
    console.warn("[fazai] ⚠️  Completion source file not found");
    return;
  }

  try {
    // Check if target directory exists and is writable
    let needsSudo = false;
    try {
      await fs.promises.access(targetDir, fs.constants.W_OK);
    } catch (permError) {
      needsSudo = true;
    }

    // Try to copy the file (with sudo if needed)
    console.log("[fazai] 📦 Installing bash completion...");

    if (needsSudo) {
      // Use sudo to copy - with non-interactive and timeout safeguards
      const { spawnSync } = await import("node:child_process");

      // Pre-check: verify passwordless sudo is available
      const sudoCheck = spawnSync("sudo", ["-n", "true"], {
        stdio: "ignore",
        timeout: 1000,
      });

      if (sudoCheck.status !== 0) {
        throw new Error("sudo requires password - use passwordless sudo or run manually");
      }

      // Copy file with sudo (non-interactive)
      const result = spawnSync("sudo", ["-n", "cp", sourceFile, targetFile], {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000, // 10s max
      });

      if (result.error?.code === "ETIMEDOUT") {
        throw new Error("sudo operation timed out");
      }

      if (result.status !== 0) {
        const stderr = result.stderr?.toString() || "unknown error";
        throw new Error(`sudo cp failed (exit ${result.status}): ${stderr}`);
      }

      // Set permissions with sudo
      const chmodResult = spawnSync("sudo", ["-n", "chmod", "644", targetFile], {
        stdio: "pipe",
        timeout: 5000,
      });

      if (chmodResult.status !== 0) {
        console.warn("[fazai] ⚠️  Could not set permissions (non-critical)");
      }
    } else {
      // Direct copy (we have permission)
      await fs.promises.copyFile(sourceFile, targetFile);
      await fs.promises.chmod(targetFile, 0o644);
    }

    console.log(`[fazai] ✅ Completion installed to ${targetFile}`);
    console.log("[fazai] 💡 Run 'exec bash' to reload completions");
  } catch (error) {
    // Don't fail the build, just show manual instructions
    console.warn(`[fazai] ⚠️  Could not auto-install completion: ${error.message}`);
    console.log("[fazai] 📝 To install manually, run:");
    console.log(`[fazai]    sudo cp ${sourceFile} ${targetFile}`);
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
