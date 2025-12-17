import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;

    return NextResponse.json({
      success: true,
      result: [],
      errors: [],
      messages: [`Quarantine for ${domain} pending - SpamExperts integration not configured`]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        result: null,
        errors: [{ code: 'SE010', message }],
        messages: []
      },
      { status: 500 }
    );
  }
}
