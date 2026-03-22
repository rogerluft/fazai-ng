/**
 * Terminal API Route
 * 
 * Provides endpoints to interact with ttyd (Terminal over HTTP).
 * The web UI can embed ttyd via an iframe to provide web shell access.
 * 
 * @module dashboard/routes/terminal
 */

import { Router, Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../../logger.js";

const execAsync = promisify(exec);
export const terminalRouter = Router();

// Default ttyd port
const TTYD_PORT = process.env.TTYD_PORT || 7681;

/**
 * GET /api/terminal/status
 * Check if the ttyd service is running
 */
terminalRouter.get("/status", async (req: Request, res: Response) => {
  try {
    // Check via systemctl (assuming it runs as a service, e.g. ttyd.service)
    // or simply check if port 7681 is actively listening
    let isRunning = false;
    
    try {
      // Netstat trick to check if port is bound
      await execAsync(`ss -tln | grep :${TTYD_PORT}`);
      isRunning = true;
    } catch {
      isRunning = false;
    }

    res.json({
      success: true,
      data: {
        running: isRunning,
        port: TTYD_PORT
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/terminal/url
 * Get the iframe URL for embedding
 */
terminalRouter.get("/url", (req: Request, res: Response) => {
  // Return the inferred URL based on the incoming request host
  const host = req.hostname || "localhost";
  
  res.json({
    success: true,
    data: {
      url: `http://${host}:${TTYD_PORT}`
    }
  });
});

/**
 * POST /api/terminal/start
 * Attempt to start ttyd dynamically if not running
 */
terminalRouter.post("/start", async (req: Request, res: Response) => {
  try {
    // Basic check first
    try {
      await execAsync(`ss -tln | grep :${TTYD_PORT}`);
      return res.json({ success: true, message: "Terminal is already running" });
    } catch {
      // Port not in use, try to start
    }
    
    logger.info("[Dashboard] Attempting to start ttyd terminal");
    
    // Attempt systemctl start if service exists:
    try {
      await execAsync("systemctl is-active ttyd.service");
      await execAsync("sudo systemctl start ttyd.service");
    } catch {
      // If no service, attempt direct execution (in background)
      // Note: This relies on ttyd being installed in PATH
      exec(`ttyd -p ${TTYD_PORT} bash`);
    }

    // Wait a brief moment to let port open
    await new Promise(r => setTimeout(r, 1000));
    
    res.json({
      success: true,
      message: `Terminal startup initiated on port ${TTYD_PORT}`
    });
  } catch (err: any) {
    logger.error(`[Dashboard] Terminal start error: ${err.message}`);
    res.status(500).json({ success: false, error: `Failed to start terminal: ${err.message}` });
  }
});
