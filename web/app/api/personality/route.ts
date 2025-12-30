import { NextResponse } from "next/server";
import { qdrant } from "@/lib/qdrant";
import type { Personality } from "@/types/fazai";

export async function GET() {
  try {
    // Query fazai_personality collection
    const response = await qdrant.scroll("fazai_personality", {
      limit: 100,
      with_payload: true,
      with_vector: false,
    });

    const points = response.points || [];

    if (points.length === 0) {
      return NextResponse.json(
        { error: "No personality traits found" },
        { status: 404 }
      );
    }

    // Format traits
    const traits = points.map((point: any) => ({
      trait_name: point.payload?.trait_name || "Unknown",
      category: point.payload?.category || "general",
      value: point.payload?.value || "",
      intensity: point.payload?.intensity || 0.5,
      context: point.payload?.context,
      tags: point.payload?.tags || [],
    }));

    const personality: Personality = {
      id: "personality_001",
      traits,
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(personality);
  } catch (error: any) {
    console.error("Failed to fetch personality:", error);
    // @todo: Consider exposing error details only in dev/debug mode.
    return NextResponse.json(
      { error: "Failed to fetch personality" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Update personality traits in Qdrant
    // (Implementation depends on update strategy)

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update personality:", error);
    // @todo: Consider exposing error details only in dev/debug mode.
    return NextResponse.json(
      { error: "Failed to update personality" },
      { status: 500 }
    );
  }
}
