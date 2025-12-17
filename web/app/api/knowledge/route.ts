import { NextResponse, NextRequest } from "next/server";
import { qdrant } from "@/lib/qdrant";

/**
 * GET /api/knowledge
 *
 * Fetch knowledge base entries from Qdrant collection fazai_kb
 *
 * Query params:
 * - limit: Maximum number of results (default: 100, max: 500)
 * - category: Filter by category (networking, security, troubleshooting, etc.)
 * - component: Filter by component (nginx, systemd, iptables, etc.)
 * - validated: Filter by validation status (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100"),
      500
    );
    const category = searchParams.get("category");
    const component = searchParams.get("component");
    const validated = searchParams.get("validated");

    // Build filter conditions
    const must: any[] = [];

    if (category) {
      must.push({
        key: "category",
        match: { value: category },
      });
    }

    if (component) {
      must.push({
        key: "component",
        match: { value: component },
      });
    }

    if (validated !== null) {
      must.push({
        key: "validated",
        match: { value: validated === "true" },
      });
    }

    // Query Qdrant
    const response = await qdrant.scroll("fazai_kb", {
      filter: must.length > 0 ? { must } : undefined,
      limit,
      with_payload: true,
      with_vector: false, // Don't return vectors (performance)
    });

    // Map points to knowledge entries
    const knowledge = response.points.map((point) => ({
      id: point.id,
      slug: point.payload?.slug,
      title: point.payload?.title,
      summary: point.payload?.summary,
      category: point.payload?.category,
      scope: point.payload?.scope,
      linux_distribution: point.payload?.linux_distribution,
      component: point.payload?.component,
      commands: point.payload?.commands,
      source: point.payload?.source,
      confidence: point.payload?.confidence,
      validated: point.payload?.validated,
      tags: point.payload?.tags,
    }));

    return NextResponse.json({
      knowledge,
      total: knowledge.length,
      limit,
    });
  } catch (error: any) {
    console.error("Failed to fetch knowledge:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch knowledge",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/knowledge
 *
 * Create new knowledge entry
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, title, summary, category, scope, linux_distribution, component, commands, source, confidence, validated, tags } = body;

    if (!slug || !title || !summary) {
      return NextResponse.json(
        { error: "Missing required fields: slug, title, summary" },
        { status: 400 }
      );
    }

    // Generate ID from slug hash
    const id = Math.abs(
      slug.split("").reduce((a: number, b: string) => a + b.charCodeAt(0), 0)
    );

    await qdrant.upsert("fazai_kb", {
      points: [
        {
          id,
          payload: {
            slug,
            title,
            summary,
            category: category || "networking",
            scope,
            linux_distribution,
            component,
            commands,
            source,
            confidence: confidence || 0.8,
            validated: validated || false,
            tags,
            created_at: new Date().toISOString(),
          },
          vector: [],
        },
      ],
    });

    return NextResponse.json({
      success: true,
      knowledge: { id, slug, title, summary, category, confidence },
    });
  } catch (error: any) {
    console.error("Failed to create knowledge:", error);
    return NextResponse.json(
      { error: "Failed to create knowledge", details: error.message },
      { status: 500 }
    );
  }
}
