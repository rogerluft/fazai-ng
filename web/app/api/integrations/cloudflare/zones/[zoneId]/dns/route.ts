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
    const records = await manager.listDNSRecords(zoneId);

    return NextResponse.json({
      success: true,
      result: records,
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await params;
    const body = await request.json();
    const manager = new CloudflareManager();
    const record = await manager.createDNSRecord(zoneId, body);

    return NextResponse.json({
      success: true,
      result: record,
      errors: [],
      messages: ['DNS record created successfully']
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
