import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;

    return NextResponse.json({
      success: true,
      result: [],
      errors: [],
      messages: [`${type} data pending - SpamExperts integration not configured`]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        result: null,
        errors: [{ code: 'SE007', message }],
        messages: []
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const body = await request.json();

    return NextResponse.json({
      success: true,
      result: { ...body, id: 'pending', created_at: new Date().toISOString(), created_by: 'system' },
      errors: [],
      messages: [`Add to ${type} pending - SpamExperts integration not configured`]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        result: null,
        errors: [{ code: 'SE008', message }],
        messages: []
      },
      { status: 500 }
    );
  }
}
