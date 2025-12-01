import { QdrantClient } from "@qdrant/js-client-rest";

const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
const qdrantApiKey = process.env.QDRANT_API_KEY;

export const qdrant = new QdrantClient({
  url: qdrantUrl,
  ...(qdrantApiKey && { apiKey: qdrantApiKey }),
});

/**
 * Collection names (corrected from jarvis_* to fazai_*)
 */
export const COLLECTIONS = [
  "fazai_personality",
  "fazai_memory",
  "fazai_learning",
  "fazai_kb",
  "fazai_inference",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

/**
 * Get all points from a collection
 */
export async function getCollectionPoints(
  collectionName: CollectionName,
  limit: number = 100
) {
  try {
    const response = await qdrant.scroll(collectionName, {
      limit: Math.min(limit, 100),
      with_payload: true,
      with_vector: false,
    });

    return response.points || [];
  } catch (error) {
    console.error(`Error fetching points from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Search in a collection using semantic similarity
 */
export async function searchCollection(
  collectionName: CollectionName,
  query: string,
  limit: number = 10
) {
  try {
    // This is a simplified search - in production, you'd need to embed the query
    const response = await qdrant.scroll(collectionName, {
      limit: Math.min(limit, 100),
      with_payload: true,
      with_vector: false,
    });

    return response.points || [];
  } catch (error) {
    console.error(`Error searching ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Get collection stats
 */
export async function getCollectionStats(collectionName: CollectionName) {
  try {
    const collection = await qdrant.getCollection(collectionName);
    return collection;
  } catch (error) {
    console.error(`Error getting stats for ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Create or update a point in a collection
 */
export async function upsertPoint(
  collectionName: CollectionName,
  id: number | string,
  payload: Record<string, any>,
  vector?: number[]
) {
  try {
    const pointId = typeof id === "string" ? parseInt(id) : id;

    await qdrant.upsert(collectionName, {
      points: [
        {
          id: pointId,
          payload,
          vector: vector || [],
        },
      ],
    });

    return { success: true, id: pointId };
  } catch (error) {
    console.error(`Error upserting point in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Delete a point from a collection
 */
export async function deletePoint(
  collectionName: CollectionName,
  id: number | string
) {
  try {
    const pointId = typeof id === "string" ? parseInt(id) : id;

    await qdrant.delete(collectionName, {
      points: [pointId],
    });

    return { success: true, id: pointId };
  } catch (error) {
    console.error(`Error deleting point from ${collectionName}:`, error);
    throw error;
  }
}
