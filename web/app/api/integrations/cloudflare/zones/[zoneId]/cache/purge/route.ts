import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CloudflareManager } from '@/lib/managers/cloudflare-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await params;
    const body = await request.json();
    const manager = new CloudflareManager();
    const result = await manager.purgeCache(zoneId, body);

    return NextResponse.json({
      success: true,
      result,
      errors: [],
      messages: ['Cache purged successfully']
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
