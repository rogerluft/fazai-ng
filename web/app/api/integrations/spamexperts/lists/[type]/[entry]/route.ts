import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; entry: string }> }
) {
  try {
    const { type, entry } = await params;

    return NextResponse.json({
      success: true,
      result: { entry: decodeURIComponent(entry) },
      errors: [],
      messages: [`Remove from ${type} pending - SpamExperts integration not configured`]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        result: null,
        errors: [{ code: 'SE009', message }],
        messages: []
      },
      { status: 500 }
    );
  }
}
