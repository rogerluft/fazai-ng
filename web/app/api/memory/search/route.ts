import { NextResponse, NextRequest } from "next/server";
import { qdrant } from "@/lib/qdrant";

/**
 * GET /api/memory/search
 *
 * Search conversation memories (semantic search requires embeddings)
 *
 * Query params:
 * - query: Search query (currently returns recent memories)
 * - limit: Maximum results (default: 10, max: 100)
 * - role: Filter by role (user/assistant/system/autonomous)
 * - conversation_id: Filter by conversation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
    const role = searchParams.get("role");
    const conversation_id = searchParams.get("conversation_id");

    // Build filters
    const must: any[] = [];
    if (role) {
      must.push({ key: "role", match: { value: role } });
    }
    if (conversation_id) {
      must.push({ key: "conversation_id", match: { value: conversation_id } });
    }

    // TODO: Implement semantic search when query is provided
    // For now, just scroll recent memories
    const response = await qdrant.scroll("fazai_memory", {
      filter: must.length > 0 ? { must } : undefined,
      limit,
      with_payload: true,
      with_vector: false,
    });

    const memories = response.points.map((point) => ({
      id: point.id,
      conversation_id: point.payload?.conversation_id,
      message_id: point.payload?.message_id,
      role: point.payload?.role,
      timestamp: point.payload?.timestamp,
      content: point.payload?.content,
      summary: point.payload?.summary,
      emotional_context: point.payload?.emotional_context,
      importance: point.payload?.importance,
      tags: point.payload?.tags,
    }));

    return NextResponse.json({
      memories,
      total: memories.length,
      query: query || null,
      semantic_search: false, // TODO: Enable when embeddings are integrated
    });
  } catch (error: any) {
    console.error("Failed to search memory:", error);
    return NextResponse.json(
      { error: "Failed to search memory", details: error.message },
      { status: 500 }
    );
  }
}
