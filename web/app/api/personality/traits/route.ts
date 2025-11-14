import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // In production, would add to Qdrant
    return NextResponse.json({ success: true, trait: body });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add trait" },
      { status: 500 }
    );
  }
}
