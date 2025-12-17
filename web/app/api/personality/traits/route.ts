import { NextResponse } from "next/server";
import { qdrant, upsertPoint, deletePoint } from "@/lib/qdrant";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { trait_name, category, value, intensity, context, tags } = body;

    if (!trait_name || !category || !value) {
      return NextResponse.json(
        { error: "Missing required fields: trait_name, category, value" },
        { status: 400 }
      );
    }

    // Generate ID from trait name hash
    const id = Math.abs(
      trait_name.split("").reduce((a: number, b: string) => a + b.charCodeAt(0), 0)
    );

    await upsertPoint("fazai_personality", id, {
      trait_name,
      category,
      value,
      intensity: intensity || 0.5,
      context,
      tags,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      trait: { id, trait_name, category, value, intensity, context, tags },
    });
  } catch (error: any) {
    console.error("Failed to add trait:", error);
    return NextResponse.json(
      { error: "Failed to add trait", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trait_name = searchParams.get("trait_name");

    if (!trait_name) {
      return NextResponse.json(
        { error: "Missing trait_name parameter" },
        { status: 400 }
      );
    }

    const id = Math.abs(
      trait_name.split("").reduce((a: number, b: string) => a + b.charCodeAt(0), 0)
    );

    await deletePoint("fazai_personality", id);

    return NextResponse.json({ success: true, trait_name });
  } catch (error: any) {
    console.error("Failed to delete trait:", error);
    return NextResponse.json(
      { error: "Failed to delete trait", details: error.message },
      { status: 500 }
    );
  }
}
