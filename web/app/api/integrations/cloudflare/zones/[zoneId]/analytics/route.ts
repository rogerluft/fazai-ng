import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CloudflareManager } from '@/lib/managers/cloudflare-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await params;
    const manager = new CloudflareManager();
    const analytics = await manager.getAnalytics(zoneId);

    return NextResponse.json({
      success: true,
      result: analytics,
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
