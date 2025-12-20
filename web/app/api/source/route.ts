import { NextResponse, NextRequest } from "next/server";
import { qdrant } from "@/lib/qdrant";

/**
 * GET /api/source
 *
 * Fetch source code chunks from Qdrant collection fazai_source
 *
 * Query params:
 * - limit: Maximum number of results (default: 100, max: 500)
 * - category: Filter by category (core, service, ui, etc.)
 * - path: Filter by file path prefix
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100"),
      500
    );
    const category = searchParams.get("category");
    const path = searchParams.get("path");

    // Build filter conditions
    const must: any[] = [];

    if (category) {
      must.push({
        key: "category",
        match: { value: category },
      });
    }

    if (path) {
      must.push({
        key: "path",
        match: { value: path },
      });
    }

    // Query Qdrant
    const response = await qdrant.scroll("fazai_source", {
      filter: must.length > 0 ? { must } : undefined,
      limit,
      with_payload: true,
      with_vector: false,
    });

    // Map points to source entries
    const sourceCode = response.points.map((point) => ({
      semantic_id: point.payload?.semantic_id,
      path: point.payload?.path,
      filename: point.payload?.filename,
      fazai_version: point.payload?.fazai_version,
      content: point.payload?.content,
      is_jsdoc: point.payload?.is_jsdoc,
      chunk_index: point.payload?.chunk_index,
      category: point.payload?.category,
      importance_weight: point.payload?.importance_weight,
      legitimate_contexts: point.payload?.legitimate_contexts,
      functions: point.payload?.functions,
      classes: point.payload?.classes,
      imports: point.payload?.imports,
      hash: point.payload?.hash,
      indexed_at: point.payload?.indexed_at,
    }));

    return NextResponse.json(sourceCode);
  } catch (error: any) {
    console.error("Failed to fetch source code:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch source code",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
