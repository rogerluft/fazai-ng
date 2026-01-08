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

// Setup log directory with proper permissions
await setupLogDirectory();

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

// Auto-Index Source Code (Metacognition)
try {
  const { execSync } = await import("node:child_process");
  console.log("[fazai] 📚 Indexando código fonte (Metacognição)...");
  
  // Executa o indexador (non-blocking para o usuário final seria melhor, mas aqui garantimos consistência)
  // O indexador é incremental, então deve ser rápido na maioria das vezes
  // [SAFETY] Desabilitado temporariamente para evitar bloqueio no build inicial.
  // Execute manualmente: fazai index
  // execSync("node dist/app.cjs index", { 
  //   cwd: projectRoot,
  //   stdio: "inherit", // Mostra logs do indexador
  //   timeout: 60000 // 1 min timeout para não travar build
  // });
  console.log("[fazai] ℹ️  Auto-indexação pausada. Execute 'fazai index' para atualizar a Metacognição.");
  
} catch (error) {
  // Não falha o build se o Qdrant estiver offline ou não configurado
  console.warn(`[fazai] ⚠️  Indexação falhou ou foi pulada: ${error.message}`);
}

/**
 * Auto-install bash completion to system directory
 * Detects CI environment and permission issues, with graceful fallback
 */
async function installBashCompletion() {
  const sourceFile = path.join(projectRoot, "completion/fazai-completion.bash");
  const targetDir = "/etc/bash_completion.d";
  // Use simple name 'fazai' to avoid duplicates with completion-sync.mjs
  const targetFile = path.join(targetDir, "fazai");

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


/**
 * Setup log directory with proper permissions
 * Automatic setup - no manual steps required
 * Uses sudo with password prompt if needed
 */
async function setupLogDirectory() {
  const { spawnSync } = await import("node:child_process");

  // Skip in CI environment
  if (process.env.CI === "true" || process.env.CONTINUOUS_INTEGRATION === "true") {
    console.log("[fazai] ℹ️  CI environment - skipping log directory setup");
    return;
  }

  // First, check if we can write to the directory
  try {
    if (fs.existsSync(LOG_DIR)) {
      // Directory exists, check if writable
      fs.accessSync(LOG_DIR, fs.constants.W_OK);
      // Try to touch a test file
      const testFile = path.join(LOG_DIR, ".write-test");
      fs.writeFileSync(testFile, "");
      fs.unlinkSync(testFile);
      console.log(`[fazai] ✅ Log directory ${LOG_DIR} is writable`);
      return;
    }
  } catch (e) {
    // Need to fix permissions
  }

  // Setup with sudo (will prompt for password if needed)
  console.log("[fazai] 🔧 Setting up log directory with proper permissions...");

  try {
    const currentUser = process.env.USER || process.env.LOGNAME || "root";

    // Create directory
    let result = spawnSync("sudo", ["mkdir", "-p", LOG_DIR], {
      stdio: "inherit",
      timeout: 30000,
    });
    if (result.status !== 0) {
      throw new Error("mkdir failed");
    }

    // Create fazai group if it doesn't exist
    spawnSync("sudo", ["groupadd", "-f", "fazai"], {
      stdio: "pipe",
      timeout: 10000,
    });

    // Add current user to fazai group
    spawnSync("sudo", ["usermod", "-aG", "fazai", currentUser], {
      stdio: "pipe",
      timeout: 10000,
    });

    // Set ownership: $USER:fazai
    result = spawnSync("sudo", ["chown", `${currentUser}:fazai`, LOG_DIR], {
      stdio: "pipe",
      timeout: 10000,
    });

    // Set permissions: 774 (rwxrwxr--)
    result = spawnSync("sudo", ["chmod", "774", LOG_DIR], {
      stdio: "pipe",
      timeout: 10000,
    });

    console.log(`[fazai] ✅ Log directory configured: ${LOG_DIR} (${currentUser}:fazai 774)`);
    console.log(`[fazai] ✅ User ${currentUser} added to group 'fazai'`);

  } catch (error) {
    console.warn(`[fazai] ⚠️  Log directory setup failed: ${error.message}`);
  }
}
