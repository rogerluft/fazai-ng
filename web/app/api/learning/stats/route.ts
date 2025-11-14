import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      total_learnings: 156,
      success_count: 142,
      error_count: 14,
      success_rate: 0.91,
      avg_confidence: 0.88,
      last_learning: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
