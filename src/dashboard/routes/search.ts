/**
 * Search API Routes
 *
 * Semantic search across FazAI collections
 */

import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler";
import { getQdrantClient } from "../../database/qdrant-pool";
import { ApiError } from "../middleware/error-handler";
import { createEmbeddingService } from "../../services/embeddings-refactored";

export const searchRouter = Router();

/**
 * POST /api/search
 * Semantic search with fusion scoring
 *
 * Body:
 * {
 *   "query": "search text",
 *   "collections": ["fazai_kb", "fazai_learning"], // optional
 *   "limit": 5, // optional, default 5
 *   "threshold": 0.7 // optional, default 0.7
 * }
 */
searchRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { query, collections, limit = 5, threshold = 0.7 } = req.body;

    if (!query || typeof query !== "string") {
      throw new ApiError(400, "Query is required and must be a string");
    }

    if (limit > 50) {
      throw new ApiError(400, "Limit cannot exceed 50");
    }

    // Default FazAI collections for fusion search
    const targetCollections = collections || [
      "fazai_learning",
      "fazai_kb",
      "fazai_memory",
      "fazai_inference",
    ];

    // Validate collections
    for (const col of targetCollections) {
      if (!col.startsWith("fazai_")) {
        throw new ApiError(403, `Invalid collection: ${col}`);
      }
    }

    // Generate embedding for query
    const embeddingService = await createEmbeddingService();
    const embedding = await embeddingService.generate(query, "general");

    // Search across collections
    const client = await getQdrantClient();
    const searchPromises = targetCollections.map(async (collectionName) => {
      try {
        const results = await client.search(collectionName, {
          vector: embedding,
          limit,
          score_threshold: threshold,
          with_payload: true,
        });

        return {
          collection: collectionName,
          results: results.map((r) => ({
            id: r.id,
            score: r.score,
            payload: r.payload,
          })),
        };
      } catch (error: any) {
        // Collection might not exist, return empty results
        return {
          collection: collectionName,
          results: [],
          error: error.message,
        };
      }
    });

    const collectionResults = await Promise.all(searchPromises);

    // Apply fusion scoring weights
    const weights: Record<string, number> = {
      fazai_learning: 0.4,
      fazai_kb: 0.3,
      fazai_memory: 0.2,
      fazai_inference: 0.1,
    };

    // Combine and score results
    const fusedResults: any[] = [];
    for (const { collection, results, error } of collectionResults) {
      const weight = weights[collection] || 1.0;

      for (const result of results) {
        fusedResults.push({
          ...result,
          collection,
          fusionScore: result.score * weight,
          rawScore: result.score,
        });
      }
    }

    // Sort by fusion score
    fusedResults.sort((a, b) => b.fusionScore - a.fusionScore);

    // Limit final results
    const topResults = fusedResults.slice(0, limit);

    res.json({
      query,
      results: topResults,
      total: fusedResults.length,
      collections: collectionResults.map((c) => ({
        name: c.collection,
        count: c.results.length,
        error: c.error,
      })),
    });
  })
);

/**
 * POST /api/search/:collection
 * Search within a specific collection
 */
searchRouter.post(
  "/:collection",
  asyncHandler(async (req, res) => {
    const { collection } = req.params;
    const { query, limit = 5, threshold = 0.7, filter } = req.body;

    if (!collection.startsWith("fazai_")) {
      throw new ApiError(403, "Only FazAI collections are accessible");
    }

    if (!query || typeof query !== "string") {
      throw new ApiError(400, "Query is required and must be a string");
    }

    if (limit > 50) {
      throw new ApiError(400, "Limit cannot exceed 50");
    }

    // Generate embedding
    const embeddingService = await createEmbeddingService();
    const embedding = await embeddingService.generate(query, "general");

    // Search
    const client = await getQdrantClient();
    try {
      const results = await client.search(collection, {
        vector: embedding,
        limit,
        score_threshold: threshold,
        filter: filter || undefined,
        with_payload: true,
      });

      res.json({
        query,
        collection,
        results: results.map((r) => ({
          id: r.id,
          score: r.score,
          payload: r.payload,
        })),
        total: results.length,
      });
    } catch (error: any) {
      if (error.message?.includes("Not found")) {
        throw new ApiError(404, `Collection '${collection}' not found`);
      }
      throw error;
    }
  })
);
