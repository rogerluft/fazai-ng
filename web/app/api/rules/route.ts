import { NextResponse, NextRequest } from "next/server";

const mockRules = [
  {
    rule_id: "rule_restart_nginx",
    title: "Auto Restart Nginx",
    description: "Automatically restart nginx if it becomes unresponsive",
    condition: "health_check(nginx) == false AND retry_count < 3",
    action: "restart_service(nginx)",
    priority: 8,
    enabled: true,
    created_by: "user" as const,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    apply_count: 5,
    last_applied: new Date(Date.now() - 3600000).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);

    return NextResponse.json(mockRules);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ success: true, rule: body });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create rule" },
      { status: 500 }
    );
  }
}
