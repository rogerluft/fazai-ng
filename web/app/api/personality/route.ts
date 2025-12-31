import { NextResponse } from "next/server";
import { qdrant } from "@/lib/qdrant";
import { generateEmbedding } from "@/lib/embeddings";

export async function GET() {
  try {
    // Query fazai_personality collection
    const response = await qdrant.scroll("fazai_personality", {
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

    const personality = {
      id: "personality_001",
      traits,
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(personality);
  } catch (error: any) {
    console.error("Failed to fetch personality:", error);
    return NextResponse.json(
      { error: "Failed to fetch personality", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Simple retry wrapper
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
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
    const validatedTraits: any[] = [];
    for (let index = 0; index < traits.length; index++) {
      const trait = traits[index];
      if (!trait.trait_name || typeof trait.trait_name !== 'string') {
        return NextResponse.json(
          { error: `Trait at index ${index} missing required 'trait_name' field` },
          { status: 400 }
        );
      }
      
      validatedTraits.push({
        trait_name: trait.trait_name,
        category: trait.category || "general",
        value: trait.value || "",
        intensity: typeof trait.intensity === 'number' ? trait.intensity : 0.5,
        context: trait.context,
        tags: Array.isArray(trait.tags) ? trait.tags : [],
      });
    }

    // Generate real embeddings
    const points = await Promise.all(
      validatedTraits.map(async (trait, index) => {
        // Create semantic text for embedding
        const semanticText = `${trait.trait_name}: ${trait.value}. ${trait.context || ''}`.trim();
        const vector = await generateEmbedding(semanticText);
        
        return {
          id: `${Date.now()}_${index}`, // Use timestamp-based ID for uniqueness
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
      () => qdrant.upsert("fazai_personality", { points }),
      3
    );

    // Trigger cache clear via environment variable flag
    // The main service checks this flag and clears cache on next load
    process.env.FAZAI_PERSONALITY_CACHE_INVALIDATE = Date.now().toString();

    console.log(`✅ Updated ${points.length} personality traits in Qdrant`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully updated ${points.length} personality traits`,
      updated_count: points.length,
    });

  } catch (error: any) {
    console.error(`Failed to update personality traits: ${error.message}`);
    return NextResponse.json(
      { 
        error: "Failed to update personality traits",
        details: error.message 
      },
      { status: 500 }
    );
  }
}
