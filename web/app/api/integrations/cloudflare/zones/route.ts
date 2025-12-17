import { NextResponse } from 'next/server';
import { CloudflareManager } from '@/lib/managers/cloudflare-manager';

export async function GET() {
  try {
    const manager = new CloudflareManager();
    const zones = await manager.listZones();

    return NextResponse.json({
      success: true,
      result: zones,
      errors: [],
      messages: []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        result: null,
        errors: [{ code: 500, message }],
        messages: []
      },
      { status: 500 }
    );
  }
}
