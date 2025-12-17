import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CloudflareManager } from '@/lib/managers/cloudflare-manager';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string; recordId: string }> }
) {
  try {
    const { zoneId, recordId } = await params;
    const manager = new CloudflareManager();
    await manager.deleteDNSRecord(zoneId, recordId);

    return NextResponse.json({
      success: true,
      result: { id: recordId },
      errors: [],
      messages: ['DNS record deleted successfully']
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
