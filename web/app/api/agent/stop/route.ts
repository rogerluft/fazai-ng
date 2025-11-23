import { NextResponse } from "next/server";

export async function POST() {
  try {
    return NextResponse.json({ success: true, message: "Agent stopped" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to stop agent" },
      { status: 500 }
    );
  }
}
