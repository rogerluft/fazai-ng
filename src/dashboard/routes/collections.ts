/**
 * Collections API Routes
 *
 * Qdrant collection management endpoints
 */

import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { getQdrantClient } from "../../database/qdrant-pool";
import { ApiError } from "../middleware/error-handler";

export const collectionsRouter = Router();

/**
 * GET /api/collections
 * List all FazAI collections
 */
collectionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const client = await getQdrantClient();
    const response = await client.getCollections();

    // Filter FazAI collections (prefix: fazai_)
    const fazaiCollections = response.collections.filter((c) =>
      c.name.startsWith("fazai_")
    );

    res.json({
      total: fazaiCollections.length,
      collections: fazaiCollections.map((c) => ({
        name: c.name,
        vectorsCount: c.vectors_count,
        pointsCount: c.points_count,
        status: c.status,
      })),
    });
  })
);

/**
 * GET /api/collections/:name
 * Get detailed collection info
 */
collectionsRouter.get(
  "/:name",
  asyncHandler(async (req, res) => {
    const { name } = req.params;

    if (!name.startsWith("fazai_")) {
      throw new ApiError(403, "Only FazAI collections are accessible");
    }

    const client = await getQdrantClient();

    try {
      const info = await client.getCollection(name);
      res.json(info);
    } catch (error: any) {
      if (error.message?.includes("Not found")) {
        throw new ApiError(404, `Collection '${name}' not found`);
      }
      throw error;
    }
  })
);

/**
 * GET /api/collections/:name/points
 * List points in collection (paginated)
 */
collectionsRouter.get(
  "/:name/points",
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!name.startsWith("fazai_")) {
      throw new ApiError(403, "Only FazAI collections are accessible");
    }

    if (limit > 100) {
      throw new ApiError(400, "Limit cannot exceed 100");
    }

    const client = await getQdrantClient();

    try {
      const response = await client.scroll(name, {
        limit,
        offset,
        with_payload: true,
        with_vector: false,
      });

      res.json({
        points: response.points,
        nextOffset: response.next_page_offset,
        hasMore: response.next_page_offset !== null,
      });
    } catch (error: any) {
      if (error.message?.includes("Not found")) {
        throw new ApiError(404, `Collection '${name}' not found`);
      }
      throw error;
    }
  })
);

/**
 * DELETE /api/collections/:name
 * Delete a collection (admin only)
 */
collectionsRouter.delete(
  "/:name",
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    const confirm = req.query.confirm === "true";

    if (!name.startsWith("fazai_")) {
      throw new ApiError(403, "Only FazAI collections can be deleted");
    }

    if (!confirm) {
      throw new ApiError(400, "Confirmation required (add ?confirm=true)");
    }

    const client = await getQdrantClient();

    try {
      await client.deleteCollection(name);
      res.json({
        success: true,
        message: `Collection '${name}' deleted`,
      });
    } catch (error: any) {
      if (error.message?.includes("Not found")) {
        throw new ApiError(404, `Collection '${name}' not found`);
      }
      throw error;
    }
  })
);

/**
 * GET /api/collections/:name/count
 * Get point count for collection
 */
collectionsRouter.get(
  "/:name/count",
  asyncHandler(async (req, res) => {
    const { name } = req.params;

    if (!name.startsWith("fazai_")) {
      throw new ApiError(403, "Only FazAI collections are accessible");
    }

    const client = await getQdrantClient();

    try {
      const info = await client.getCollection(name);
      res.json({
        collection: name,
        count: info.points_count,
        vectorsCount: info.vectors_count,
      });
    } catch (error: any) {
      if (error.message?.includes("Not found")) {
        throw new ApiError(404, `Collection '${name}' not found`);
      }
      throw error;
    }
  })
);
