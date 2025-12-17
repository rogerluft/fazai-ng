import { NextResponse } from 'next/server';

export async function POST() {
  try {
    return NextResponse.json({
      result: 'ok',
      data: null,
      message: 'Firewall apply pending - OPNsense integration not configured'
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
