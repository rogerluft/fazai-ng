import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      result: 'ok',
      data: [],
      message: 'VPN tunnels pending - OPNsense integration not configured'
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
