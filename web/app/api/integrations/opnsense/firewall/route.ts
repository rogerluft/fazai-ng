import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// OPNsense Firewall API
// Returns data compatible with OPNsense API response structure

export async function GET() {
  try {
    // TODO: Replace with actual OPNsenseManager integration
    // const manager = await createOPNsenseManager();
    // const rules = await manager.listFirewallRules();

    return NextResponse.json({
      result: 'ok',
      data: [],
      message: 'OPNsense integration pending - configure OPNSENSE_API credentials'
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

    // TODO: Replace with actual OPNsenseManager integration
    // const manager = await createOPNsenseManager();
    // const rule = await manager.addFirewallRule(body);

    return NextResponse.json({
      result: 'ok',
      data: { uuid: 'pending-' + Date.now(), ...body },
      message: 'Firewall rule add pending - OPNsense integration not configured'
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
