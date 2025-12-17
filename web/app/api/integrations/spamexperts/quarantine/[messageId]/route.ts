import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;

    return NextResponse.json({
      success: true,
      result: { id: messageId },
      errors: [],
      messages: ['Message deletion pending - SpamExperts integration not configured']
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        result: null,
        errors: [{ code: 'SE004', message }],
        messages: []
      },
      { status: 500 }
    );
  }
}
