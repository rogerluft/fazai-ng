import { NextResponse, NextRequest } from "next/server";

const mockMemories = [
  {
    conversation_id: "conv_001",
    message_id: 1,
    role: "user" as const,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    content: "Can you restart the nginx service?",
    importance: 0.8,
  },
  {
    conversation_id: "conv_001",
    message_id: 2,
    role: "assistant" as const,
    timestamp: new Date(Date.now() - 3595000).toISOString(),
    content: "I'll restart the nginx service for you.",
    summary: "Agreed to restart nginx",
    importance: 0.7,
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);

    // In production, would perform semantic search against Qdrant
    if (query) {
      return NextResponse.json(mockMemories.slice(0, limit));
    }
    return NextResponse.json([]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to search memory" },
      { status: 500 }
    );
  }
}
