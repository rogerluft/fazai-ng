/**
 * Config API Route
 * 
 * Allows listing and updating configuration values in fazai.conf
 * 
 * @module dashboard/routes/config
 */

import { Router, Request, Response } from "express";
import { getConfigValue } from "../../config.js";
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../../logger.js";

export const configRouter = Router();

// Paths are derived from how config.ts finds them
const CONFIG_PATH = "/etc/fazai/fazai.conf";
const LOCAL_CONFIG_PATH = path.join(process.cwd(), "fazai.conf");

// List of allowed configuration keys that can be viewed/edited via Dashboard
// Sensitive keys (tokens, passwords) are intentionally excluded or masked
const SECURE_KEYS = [
  "QDRANT_URL",
  "QDRANT_API_KEY", // Will be masked
  "OLLAMA_HOST",
  "LLAMACPP_HOST",
  "EMBEDDING_MODEL",
  "INFERENCE_MODEL",
  "MAX_ITERATIONS",
  "MAX_MEMORY_AGE_DAYS",
  "LOG_LEVEL",
  "LOG_PATH_MAESTRO",
  "LOG_PATH_QDRANT",
  "LOG_PATH_FAZAI",
  "SQLITE_VECTOR_PATH",
  "TELEGRAM_BOT_TOKEN", // Will be masked
  "TELEGRAM_ALLOWED_USERS",
  "WHISPER_CPP_PATH",
  "TTS_LANG"
];

const MASKED_KEYS = new Set(["QDRANT_API_KEY", "TELEGRAM_BOT_TOKEN"]);

/**
 * GET /api/config
 * List current safe configuration values
 */
configRouter.get("/", (req: Request, res: Response) => {
  try {
    const configData: Record<string, string> = {};
    
    for (const key of SECURE_KEYS) {
      let val = getConfigValue(key) || "";
      if (val && MASKED_KEYS.has(key)) {
        val = "********" + val.slice(-4); // mask all but last 4 chars
      }
      configData[key] = val;
    }
    
    res.json({
      success: true,
      data: configData
    });
  } catch (err: any) {
    logger.error(`[Dashboard] Config GET error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/config
 * Update configuration keys (writes to local fazai.conf)
 */
configRouter.put("/", async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ success: false, error: "Invalid payload, expected object" });
    }

    // Read current local config
    let content = "";
    try {
      content = await fs.readFile(LOCAL_CONFIG_PATH, "utf-8");
    } catch {
      // Create if it doesn't exist
      content = "# FazAI User Configuration\n\n";
    }

    let modified = false;

    for (const [key, value] of Object.entries(updates)) {
      if (!SECURE_KEYS.includes(key)) continue; // ignore unknown keys
      if (typeof value !== "string") continue; // only strings
      
      // If client sends masked value back, ignore it
      if (MASKED_KEYS.has(key) && value.startsWith("********")) continue;

      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
      } else {
        content += `\n${key}=${value}`;
      }
      modified = true;
    }

    if (modified) {
      await fs.writeFile(LOCAL_CONFIG_PATH, content.trim() + "\n", "utf-8");
      logger.info("[Dashboard] Updated configuration values");
    }

    res.json({
      success: true,
      message: modified ? "Configuration updated successfully" : "No changes applied",
      restartedRequired: modified
    });
  } catch (err: any) {
    logger.error(`[Dashboard] Config PUT error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});
