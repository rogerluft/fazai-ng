import { NextResponse } from "next/server";

// Mock agent status - in production, this would fetch from actual agent
const mockStatus = {
  status: "online" as const,
  uptime_seconds: 86400,
  actions_per_minute: 12.5,
  success_rate: 0.96,
  last_action: "Restarted nginx service",
  total_actions: 1250,
  errors_count: 45,
  memory_usage_mb: 256,
  cpu_usage_percent: 18.5,
};

export async function GET() {
  try {
    return NextResponse.json(mockStatus);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch agent status" },
      { status: 500 }
    );
  }
}
