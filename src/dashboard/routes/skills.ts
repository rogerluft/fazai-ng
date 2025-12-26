/**
 * Skills API Routes
 *
 * Skill seeker and skill management endpoints
 */

import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { ApiError } from "../middleware/error-handler";
import { runSkillSeeker } from "../../agentic/genai-runner";
import { getQdrantClient } from "../../database/qdrant-pool";

export const skillsRouter = Router();

/**
 * POST /api/skills/seek
 * Trigger skill seeker for knowledge gap detection
 *
 * Body:
 * {
 *   "query": "nginx configuration",
 *   "mode": "detect", // detect | scrape | generate
 *   "model": "ollama:phi3", // optional
 *   "timeout": 120000 // optional
 * }
 */
skillsRouter.post(
  "/seek",
  asyncHandler(async (req, res) => {
    const { query, mode = "detect", model, timeout } = req.body;

    if (!query || typeof query !== "string") {
      throw new ApiError(400, "Query is required and must be a string");
    }

    const validModes = ["detect", "scrape", "generate"];
    if (!validModes.includes(mode)) {
      throw new ApiError(400, `Mode must be one of: ${validModes.join(", ")}`);
    }

    const result = await runSkillSeeker(query, mode as any, {
      model,
      timeout: timeout || 120000,
      verbose: false,
    });

    res.json({
      success: result.success,
      output: result.output,
      error: result.error,
      duration: result.duration,
      query,
      mode,
    });
  })
);

/**
 * GET /api/skills
 * List generated skills from knowledge base
 *
 * Query params:
 * - limit: number of skills to return (default 20)
 * - category: filter by category (optional)
 */
skillsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string;

    if (limit > 100) {
      throw new ApiError(400, "Limit cannot exceed 100");
    }

    const client = await getQdrantClient();

    try {
      // Search in fazai_kb for skills
      const filter = category
        ? {
            must: [
              {
                key: "category",
                match: { value: category },
              },
              {
                key: "type",
                match: { value: "skill" },
              },
            ],
          }
        : {
            must: [
              {
                key: "type",
                match: { value: "skill" },
              },
            ],
          };

      const response = await client.scroll("fazai_kb", {
        limit,
        filter: filter as any,
        with_payload: true,
        with_vector: false,
      });

      const skills = response.points.map((p) => ({
        id: p.id,
        title: p.payload?.title,
        category: p.payload?.category,
        description: p.payload?.description,
        source: p.payload?.source,
        createdAt: p.payload?.created_at,
      }));

      res.json({
        skills,
        total: skills.length,
        category: category || "all",
      });
    } catch (error: any) {
      if (error.message?.includes("Not found")) {
        throw new ApiError(404, "Knowledge base collection not found");
      }
      throw error;
    }
  })
);

/**
 * GET /api/skills/categories
 * List available skill categories
 */
skillsRouter.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const client = await getQdrantClient();

    try {
      // Get all skills and extract unique categories
      const response = await client.scroll("fazai_kb", {
        limit: 1000,
        filter: {
          must: [
            {
              key: "type",
              match: { value: "skill" },
            },
          ],
        } as any,
        with_payload: true,
        with_vector: false,
      });

      const categories = new Set<string>();
      for (const point of response.points) {
        if (point.payload?.category) {
          categories.add(point.payload.category as string);
        }
      }

      res.json({
        categories: Array.from(categories).sort(),
        total: categories.size,
      });
    } catch (error: any) {
      if (error.message?.includes("Not found")) {
        throw new ApiError(404, "Knowledge base collection not found");
      }
      throw error;
    }
  })
);

/**
 * GET /api/skills/:id
 * Get specific skill by ID
 */
skillsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const client = await getQdrantClient();

    try {
      const points = await client.retrieve("fazai_kb", {
        ids: [id],
        with_payload: true,
        with_vector: false,
      });

      if (points.length === 0) {
        throw new ApiError(404, `Skill with ID '${id}' not found`);
      }

      const skill = points[0];

      res.json({
        id: skill.id,
        ...skill.payload,
      });
    } catch (error: any) {
      if (error.message?.includes("Not found")) {
        throw new ApiError(404, "Knowledge base collection not found");
      }
      throw error;
    }
  })
);

/**
 * POST /api/skills/import
 * Import a skill manually
 *
 * Body:
 * {
 *   "title": "Skill title",
 *   "category": "linux-admin",
 *   "description": "Skill description",
 *   "content": "Full skill content",
 *   "source": "manual"
 * }
 */
skillsRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const { title, category, description, content, source = "manual" } = req.body;

    if (!title || !category || !content) {
      throw new ApiError(400, "Title, category, and content are required");
    }

    // This would integrate with the source indexer
    // For now, return a placeholder response
    res.json({
      success: true,
      message: "Skill import endpoint - implementation pending",
      skill: {
        title,
        category,
        description,
        source,
      },
    });
  })
);
