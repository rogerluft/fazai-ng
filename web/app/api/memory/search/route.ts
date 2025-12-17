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

    // Scroll memories with filters
    const response = await qdrant.scroll("fazai_memory", {
      filter: must.length > 0 ? { must } : undefined,
      limit,
      with_payload: true,
      with_vector: false,
    });

    interface MemoryPayload {
      conversation_id?: string;
      message_id?: string;
      role?: string;
      timestamp?: string;
      content?: string;
      summary?: string;
      emotional_context?: string;
      importance?: number;
      tags?: string[];
    }

    let memories = response.points.map((point) => {
      const payload = point.payload as MemoryPayload | undefined;
      return {
        id: point.id,
        conversation_id: payload?.conversation_id,
        message_id: payload?.message_id,
        role: payload?.role,
        timestamp: payload?.timestamp,
        content: payload?.content,
        summary: payload?.summary,
        emotional_context: payload?.emotional_context,
        importance: payload?.importance,
        tags: payload?.tags,
      };
    });

    // Basic text search if query provided
    if (query) {
      const queryLower = query.toLowerCase();
      memories = memories.filter(
        (m) =>
          m.content?.toLowerCase().includes(queryLower) ||
          m.summary?.toLowerCase().includes(queryLower) ||
          m.tags?.some((t: string) => t.toLowerCase().includes(queryLower))
      );
    }

    return NextResponse.json({
      memories,
      total: memories.length,
      query: query || null,
      semantic_search: false, // Note: Full semantic search requires embedding model
    });
  } catch (error: any) {
    console.error("Failed to search memory:", error);
    return NextResponse.json(
      { error: "Failed to search memory", details: error.message },
      { status: 500 }
    );
  }
}
