import { NextResponse, NextRequest } from "next/server";

const mockKnowledge = [
  {
    slug: "nginx-restart",
    title: "Nginx Service Restart",
    summary: "Safe procedure for restarting nginx without downtime",
    category: "networking" as const,
    scope: "host" as const,
    component: "nginx",
    confidence: 0.95,
    validated: true,
    tags: ["webserver", "service-management"],
  },
];

export async function GET(_request: NextRequest) {
  try {
    return NextResponse.json(mockKnowledge);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch knowledge" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ success: true, knowledge: body });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create knowledge" },
      { status: 500 }
    );
  }
}
