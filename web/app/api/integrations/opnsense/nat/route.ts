import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      result: 'ok',
      data: [],
      message: 'NAT rules pending - OPNsense integration not configured'
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return NextResponse.json({
      result: 'ok',
      data: { uuid: 'pending-' + Date.now(), ...body },
      message: 'NAT rule add pending - OPNsense integration not configured'
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
