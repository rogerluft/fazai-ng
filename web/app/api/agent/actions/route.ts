import { NextResponse, NextRequest } from "next/server";

// Mock actions data
const mockActions = [
  {
    action_id: "act_001",
    timestamp: new Date(Date.now() - 60000).toISOString(),
    type: "system_check",
    description: "Performed system health check",
    status: "completed" as const,
    result: "System is healthy",
    duration_ms: 1500,
  },
  {
    action_id: "act_002",
    timestamp: new Date(Date.now() - 120000).toISOString(),
    type: "package_update",
    description: "Updated system packages",
    status: "completed" as const,
    result: "45 packages updated",
    duration_ms: 8500,
  },
  {
    action_id: "act_003",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    type: "log_rotation",
    description: "Rotated application logs",
    status: "completed" as const,
    result: "3 logs rotated",
    duration_ms: 2100,
  },
  {
    action_id: "act_004",
    timestamp: new Date(Date.now() - 450000).toISOString(),
    type: "service_restart",
    description: "Restarted nginx service",
    status: "completed" as const,
    result: "Service restarted successfully",
    duration_ms: 3200,
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    return NextResponse.json(mockActions.slice(0, limit));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch actions" },
      { status: 500 }
    );
  }
}
