import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ikeid: string }> }
) {
  try {
    const { ikeid } = await params;

    return NextResponse.json({
      result: 'ok',
      data: { ikeid },
      message: 'VPN disconnect pending - OPNsense integration not configured'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        result: 'failed',
        data: null,
        message
      },
      { status: 500 }
    );
  }
}
