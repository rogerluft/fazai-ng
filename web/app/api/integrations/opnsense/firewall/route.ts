import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { OPNsenseManager } from '@/lib/managers/opnsense-manager';

// OPNsense Firewall API
// Returns data compatible with OPNsense API response structure

export async function GET() {
  try {
    const manager = new OPNsenseManager();
    const rules = await manager.getFirewallRules();

    return NextResponse.json({
      result: 'ok',
      data: rules,
      message: 'Firewall rules retrieved successfully'
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
    const manager = new OPNsenseManager();
    const rule = await manager.createFirewallRule(body);

    return NextResponse.json({
      result: 'ok',
      data: rule,
      message: 'Firewall rule created successfully'
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
