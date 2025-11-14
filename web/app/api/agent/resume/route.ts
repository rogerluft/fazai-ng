import { NextResponse } from "next/server";

export async function POST() {
  try {
    return NextResponse.json({ success: true, message: "Agent resumed" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to resume agent" },
      { status: 500 }
    );
  }
}
