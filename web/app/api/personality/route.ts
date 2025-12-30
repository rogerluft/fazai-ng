import { NextResponse } from "next/server";
import { getQdrantClient } from "../../../database/qdrant-pool";
import { withRetry } from "../../../utils/retry";
import { clearPersonalityCache } from "../../../services/personality-loader";
import { logger } from "../../../logger";
import { generateEmbedding } from "../../../services/embeddings";
import type { Personality as FazaiPersonality, PersonalityTrait } from "../../../services/personality-loader";
import type { Personality as JarvisPersonality } from "@/types/jarvis";
import crypto from 'crypto';


export async function GET() {
  try {
    const client = await getQdrantClient();
    // Query fazai_personality collection
    const response = await client.scroll("fazai_personality", {
      limit: 100,
      with_payload: true,
      with_vector: false,
    });

    const points = response.points || [];

    if (points.length === 0) {
      return NextResponse.json(
        { error: "No personality traits found" },
        { status: 404 }
      );
    }

    // Format traits
    const traits = points.map((point: any) => ({
      trait_name: point.payload?.trait_name || "Unknown",
      category: point.payload?.category || "general",
      value: point.payload?.value || "",
      intensity: point.payload?.intensity || 0.5,
      context: point.payload?.context,
      tags: point.payload?.tags || [],
    }));

    const personality: FazaiPersonality = {
      traits,
      expertise: [], // Note: These are not stored directly in this structure
      style: [],     // They are derived in the personality-loader service
      loadedAt: new Date(),
    };

    return NextResponse.json(personality);
  } catch (error: any) {
    console.error("Failed to fetch personality:", error);
    // @todo: Consider exposing error details only in dev/debug mode.
    return NextResponse.json(
      { error: "Failed to fetch personality" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Validate request body
    const { traits } = body;
    if (!Array.isArray(traits) || traits.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: 'traits' array is required and cannot be empty" },
        { status: 400 }
      );
    }

    // Validate each trait structure
    const validatedTraits: PersonalityTrait[] = traits.map((trait: any, index: number) => {
      if (!trait.trait_name || typeof trait.trait_name !== 'string') {
        throw new Error(`Trait at index ${index} missing required 'trait_name' field`);
      }
      return {
        trait_name: trait.trait_name,
        category: trait.category || "general",
        value: trait.value || "",
        intensity: typeof trait.intensity === 'number' ? trait.intensity : 0.5,
        context: trait.context,
        tags: Array.isArray(trait.tags) ? trait.tags : [],
      };
    });

    const client = await getQdrantClient();

    const points = await Promise.all(
      validatedTraits.map(async (trait, index) => {
        // Create semantic text for embedding
        const semanticText = `${trait.trait_name}: ${trait.value}. ${trait.context || ''}`.trim();
        const vector = await generateEmbedding(semanticText);

        return {
          id: crypto.randomUUID(),
          vector,
          payload: {
            ...trait,
            updated_at: new Date().toISOString(),
          },
        };
      })
    );

    // Upsert to Qdrant with retry
    await withRetry(
      () => client.upsert("fazai_personality", { points }),
      { provider: "qdrant", maxRetries: 3 }
    );

    // Clear cache to force reload on next request
    clearPersonalityCache();

    logger.info(`✅ Updated ${points.length} personality traits in Qdrant`);

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${points.length} personality traits`,
      updated_count: points.length,
    });

  } catch (error: any) {
    logger.error(`Failed to update personality traits: ${error.message}`);
    return NextResponse.json(
      { error: "Failed to update personality traits" },
      { status: 500 }
    );
  }
}
