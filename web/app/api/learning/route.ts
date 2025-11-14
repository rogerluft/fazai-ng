import { NextResponse, NextRequest } from "next/server";

const mockLearnings = [
  {
    learning_id: "learn_001",
    type: "acerto" as const,
    title: "Service Restart Success",
    description: "Successfully restarted nginx without downtime",
    context: "nginx service recovery",
    action_taken: "restart_service(nginx)",
    outcome: "sucesso" as const,
    confidence: 0.95,
    category: "linux" as const,
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    applied_count: 3,
  },
];

export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json(mockLearnings);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch learning" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ success: true, learning: body });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create learning" },
      { status: 500 }
    );
  }
}
