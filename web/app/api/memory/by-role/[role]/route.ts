import { NextResponse } from "next/server";
import { qdrant } from "@/lib/qdrant";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ role: string }> }
) {
  try {
    const { role } = await params;

    const must: any[] = [];
    if (role !== "all") {
      must.push({ key: "role", match: { value: role } });
    }

    const response = await qdrant.scroll("fazai_memory", {
      filter: must.length > 0 ? { must } : undefined,
      limit: 50,
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

    return NextResponse.json(memories);
  } catch (error: any) {
    console.error("Failed to fetch memory by role:", error);
    return NextResponse.json(
      { error: "Failed to fetch memory", details: error.message },
      { status: 500 }
    );
  }
}
