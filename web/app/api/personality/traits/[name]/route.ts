import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    // In production, would delete from Qdrant
    return NextResponse.json({ success: true, deleted: name });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete trait" },
      { status: 500 }
    );
  }
}
