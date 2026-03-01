/**
 * Status API Routes
 *
 * System health monitoring endpoints
 */

import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { qdrantPool } from "../../database/qdrant-pool";
import { CircuitState } from "../../resilience/circuit-breaker";
import { getGenAIScriptInfo } from "../../agentic/genai-runner";
import axios from "axios";
import { getConfigValue } from "../../config";

export const statusRouter = Router();

/**
 * GET /api/status
 * Complete system status
 */
statusRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [qdrantStatus, ollamaStatus, genaiStatus] = await Promise.allSettled([
      checkQdrantStatus(),
      checkOllamaStatus(),
      getGenAIScriptInfo(),
    ]);

    const status = {
      timestamp: new Date().toISOString(),
      qdrant: qdrantStatus.status === "fulfilled" ? qdrantStatus.value : { available: false, error: (qdrantStatus as PromiseRejectedResult).reason?.message },
      ollama: ollamaStatus.status === "fulfilled" ? ollamaStatus.value : { available: false, error: (ollamaStatus as PromiseRejectedResult).reason?.message },
      genaiscript: genaiStatus.status === "fulfilled" ? genaiStatus.value : { installed: false, error: (genaiStatus as PromiseRejectedResult).reason?.message },
      system: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
        },
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    res.json(status);
  })
);

/**
 * GET /api/status/qdrant
 * Detailed Qdrant status
 */
statusRouter.get(
  "/qdrant",
  asyncHandler(async (req, res) => {
    const status = await checkQdrantStatus();
    res.json(status);
  })
);

/**
 * GET /api/status/ollama
 * Ollama service status
 */
statusRouter.get(
  "/ollama",
  asyncHandler(async (req, res) => {
    const status = await checkOllamaStatus();
    res.json(status);
  })
);

/**
 * Check Qdrant status
 */
async function checkQdrantStatus() {
  const metrics = qdrantPool.getMetrics();
  const circuitState = qdrantPool.getCircuitState();
  const available = qdrantPool.isAvailable();

  let collections: any[] = [];
  let version: string | undefined;

  if (available) {
    try {
      const client = await qdrantPool.getClient();
      const collectionsResponse = await client.getCollections();
      collections = collectionsResponse.collections;

      // Get version if available
      try {
        version = (await client.api("/")).version;
      } catch {
        // Version endpoint might not be available
      }
    } catch (error) {
      // If we can't get collections, mark as unavailable
      return {
        available: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metrics,
        circuitState: CircuitState[circuitState],
      };
    }
  }

  return {
    available,
    url: getConfigValue("QDRANT_URL") || "http://localhost:6333",
    version,
    collections: collections.map((c) => ({
      name: c.name,
      vectorsCount: c.vectors_count,
      pointsCount: c.points_count,
    })),
    metrics: {
      ...metrics,
      state: metrics.state,
    },
    circuitState: CircuitState[circuitState],
  };
}

/**
 * Check Ollama status
 */
async function checkOllamaStatus() {
  const ollamaUrl = getConfigValue("OLLAMA_BASE_URL") || "http://localhost:11434";

  try {
    const response = await axios.get(`${ollamaUrl}/api/tags`, {
      timeout: 5000,
    });

    return {
      available: true,
      url: ollamaUrl,
      models: response.data.models?.map((m: any) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
      })) || [],
    };
  } catch (error) {
    return {
      available: false,
      url: ollamaUrl,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}
