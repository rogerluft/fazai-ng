import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return mock system status for demo purposes
    return NextResponse.json({
      result: 'ok',
      data: {
        uptime: 0,
        uptime_text: 'N/A',
        cpu_usage: 0,
        memory_usage: 0,
        disk_usage: 0,
        load_average: {
          one: 0,
          five: 0,
          fifteen: 0
        }
      },
      message: 'System status pending - OPNsense integration not configured'
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
