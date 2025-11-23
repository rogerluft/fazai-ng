import { NextResponse } from "next/server";

const mockMemories = [
  {
    conversation_id: "conv_001",
    message_id: 1,
    role: "user" as const,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    content: "Can you restart the nginx service?",
    importance: 0.8,
  },
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ role: string }> }
) {
  try {
    const { role } = await params;

    if (role === "all") {
      return NextResponse.json(mockMemories);
    }

    // Filter by role
    const filtered = mockMemories.filter((m) => m.role === role);
    return NextResponse.json(filtered);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch memory" },
      { status: 500 }
    );
  }
}
