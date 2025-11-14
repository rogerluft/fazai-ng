import { NextResponse } from "next/server";
import type { Personality } from "@/types/jarvis";

const mockPersonality: Personality = {
  id: "personality_001",
  traits: [
    {
      trait_name: "Autonomy",
      category: "decisão",
      value: "High",
      intensity: 0.8,
      context: "Agent can make decisions without human intervention",
    },
    {
      trait_name: "Transparency",
      category: "comunicação",
      value: "Critical",
      intensity: 0.95,
      context: "Always explain actions and decisions",
    },
    {
      trait_name: "Caution",
      category: "ética",
      value: "High",
      intensity: 0.85,
      context: "Avoid risky operations without validation",
    },
  ],
  updated_at: new Date().toISOString(),
};

export async function GET() {
  try {
    return NextResponse.json(mockPersonality);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch personality" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ ...mockPersonality, ...body });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update personality" },
      { status: 500 }
    );
  }
}
