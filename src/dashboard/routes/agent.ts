/**
 * Agent API Routes
 *
 * GenAIScript agent execution endpoints
 */

import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { ApiError } from "../middleware/error-handler";
import {
  runGenAIScript,
  runAgenticLoop,
  runReflection,
  listAvailableScripts,
  getGenAIScriptInfo,
} from "../../agentic/genai-runner";

export const agentRouter = Router();

/**
 * POST /api/agent/run
 * Execute a GenAIScript agent
 *
 * Body:
 * {
 *   "query": "configure nginx",
 *   "script": "fazai-core.genai.mjs", // optional
 *   "model": "ollama:phi3", // optional
 *   "timeout": 120000, // optional
 *   "vars": { "key": "value" } // optional
 * }
 */
agentRouter.post(
  "/run",
  asyncHandler(async (req, res) => {
    const { query, script, model, timeout, vars } = req.body;

    if (!query || typeof query !== "string") {
      throw new ApiError(400, "Query is required and must be a string");
    }

    // Use agentic loop by default
    const scriptName = script || "fazai-core.genai.mjs";

    const result = await runGenAIScript({
      script: scriptName,
      vars: { query, ...vars },
      model,
      timeout: timeout || 120000,
      verbose: false,
    });

    res.json({
      success: result.success,
      output: result.output,
      error: result.error,
      duration: result.duration,
      exitCode: result.exitCode,
      retries: result.retries,
      script: scriptName,
      model: model || "default",
    });
  })
);

/**
 * POST /api/agent/loop
 * Execute agentic loop specifically
 */
agentRouter.post(
  "/loop",
  asyncHandler(async (req, res) => {
    const { query, model, timeout } = req.body;

    if (!query || typeof query !== "string") {
      throw new ApiError(400, "Query is required and must be a string");
    }

    const result = await runAgenticLoop(query, {
      model,
      timeout: timeout || 180000,
      verbose: false,
    });

    res.json({
      success: result.success,
      output: result.output,
      error: result.error,
      duration: result.duration,
      query,
    });
  })
);

/**
 * POST /api/agent/reflect
 * Trigger autonomous reflection
 */
agentRouter.post(
  "/reflect",
  asyncHandler(async (req, res) => {
    const { model, timeout } = req.body;

    const result = await runReflection({
      model,
      timeout: timeout || 60000,
      verbose: false,
    });

    res.json({
      success: result.success,
      output: result.output,
      error: result.error,
      duration: result.duration,
    });
  })
);

/**
 * GET /api/agent/scripts
 * List available GenAIScript scripts
 */
agentRouter.get(
  "/scripts",
  asyncHandler(async (req, res) => {
    const scripts = await listAvailableScripts();

    res.json({
      scripts,
      total: scripts.length,
      scriptsDir: "genaisrc/",
    });
  })
);

/**
 * GET /api/agent/info
 * Get GenAIScript environment info
 */
agentRouter.get(
  "/info",
  asyncHandler(async (req, res) => {
    const info = await getGenAIScriptInfo();
    res.json(info);
  })
);

/**
 * GET /api/agent/status
 * Get agent system status
 */
agentRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    const info = await getGenAIScriptInfo();

    res.json({
      genaiscript: {
        installed: info.installed,
        scriptsCount: info.scriptsCount,
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd(),
      },
      timestamp: new Date().toISOString(),
    });
  })
);
