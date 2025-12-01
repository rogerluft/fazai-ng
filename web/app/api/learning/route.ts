import { NextResponse, NextRequest } from "next/server";
import { qdrant } from "@/lib/qdrant";

/**
 * GET /api/learning
 *
 * Fetch learned patterns from fazai_learning collection
 *
 * Query params:
 * - limit: Maximum results (default: 100, max: 500)
 * - type: Filter by learning type (erro, acerto, padrão, otimização)
 * - category: Filter by category (linux, network, security, social)
 * - min_confidence: Minimum confidence score (0-1)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100"),
      500
    );
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const minConfidence = searchParams.get("min_confidence");

    // Build filters
    const must: any[] = [];
    if (type) {
      must.push({ key: "type", match: { value: type } });
    }
    if (category) {
      must.push({ key: "category", match: { value: category } });
    }
    if (minConfidence) {
      must.push({
        key: "confidence",
        range: { gte: parseFloat(minConfidence) },
      });
    }

    // Query Qdrant
    const response = await qdrant.scroll("fazai_learning", {
      filter: must.length > 0 ? { must } : undefined,
      limit,
      with_payload: true,
      with_vector: false,
    });

    const learnings = response.points.map((point) => ({
      id: point.id,
      learning_id: point.payload?.learning_id,
      type: point.payload?.type,
      title: point.payload?.title,
      description: point.payload?.description,
      context: point.payload?.context,
      action_taken: point.payload?.action_taken,
      outcome: point.payload?.outcome,
      confidence: point.payload?.confidence,
      category: point.payload?.category,
      timestamp: point.payload?.timestamp,
      applied_count: point.payload?.applied_count,
      tags: point.payload?.tags,
    }));

    return NextResponse.json({
      learnings,
      total: learnings.length,
      limit,
    });
  } catch (error: any) {
    console.error("Failed to fetch learning:", error);
    return NextResponse.json(
      { error: "Failed to fetch learning", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/learning
 *
 * Create new learning entry (not implemented - requires embedding)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    return NextResponse.json(
      {
        error: "Learning creation not implemented yet",
        message: "Requires embedding generation integration",
      },
      { status: 501 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create learning", details: error.message },
      { status: 500 }
    );
  }
}
