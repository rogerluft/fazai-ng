import { NextResponse } from "next/server";

export async function POST() {
  try {
    // In production, this would pause the actual agent
    return NextResponse.json({ success: true, message: "Agent paused" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to pause agent" },
      { status: 500 }
    );
  }
}
