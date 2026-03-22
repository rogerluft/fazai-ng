/**
 * Prompts API Route
 * 
 * Allows managing system prompts (CRUD operations).
 * In FazAI, system prompts are usually stored in `system-prompts/` 
 * or directly in the configuration based on architecture.
 * 
 * @module dashboard/routes/prompts
 */

import { Router, Request, Response } from "express";
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "../../logger.js";

export const promptsRouter = Router();

const PROMPTS_DIR = path.resolve(process.cwd(), "system-prompts");

// Ensure directory exists on load
fs.mkdir(PROMPTS_DIR, { recursive: true }).catch(err => {
  logger.warn(`Failed to create prompts dir: ${err.message}`);
});

/**
 * GET /api/prompts
 * List all available system prompts
 */
promptsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const files = await fs.readdir(PROMPTS_DIR);
    const prompts = files.filter(f => f.endsWith(".md") || f.endsWith(".txt"));
    
    res.json({
      success: true,
      data: prompts
    });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return res.json({ success: true, data: [] });
    }
    logger.error(`[Dashboard] Prompts GET error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/prompts/:id
 * Get content of a specific prompt
 */
promptsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    // Basic path traversal prevention
    const safeId = path.basename(id);
    const promptPath = path.join(PROMPTS_DIR, safeId);
    
    const content = await fs.readFile(promptPath, "utf-8");
    
    res.json({
      success: true,
      data: {
        id: safeId,
        content
      }
    });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ success: false, error: "Prompt not found" });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/prompts
 * Create a new prompt
 */
promptsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { id, content } = req.body;
    
    if (!id || !content) {
      return res.status(400).json({ success: false, error: "Missing id or content" });
    }

    const safeId = path.basename(id) + (id.includes(".") ? "" : ".md");
    const promptPath = path.join(PROMPTS_DIR, safeId);
    
    const exists = await fs.stat(promptPath).catch(() => null);
    if (exists) {
      return res.status(409).json({ success: false, error: "Prompt already exists" });
    }

    await fs.writeFile(promptPath, content, "utf-8");
    logger.info(`[Dashboard] Created prompt: ${safeId}`);
    
    res.json({
      success: true,
      data: { id: safeId }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/prompts/:id
 * Update an existing prompt
 */
promptsRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { content } = req.body;
    
    if (content === undefined) {
      return res.status(400).json({ success: false, error: "Missing content" });
    }

    const safeId = path.basename(id);
    const promptPath = path.join(PROMPTS_DIR, safeId);
    
    await fs.writeFile(promptPath, content, "utf-8");
    logger.info(`[Dashboard] Updated prompt: ${safeId}`);
    
    res.json({
      success: true,
      message: "Updated successfully"
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/prompts/:id
 * Delete a prompt
 */
promptsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const safeId = path.basename(id);
    const promptPath = path.join(PROMPTS_DIR, safeId);
    
    await fs.unlink(promptPath);
    logger.info(`[Dashboard] Deleted prompt: ${safeId}`);
    
    res.json({
      success: true,
      message: "Deleted successfully"
    });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return res.status(404).json({ success: false, error: "Prompt not found" });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});
