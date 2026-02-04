import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SpamExpertsManager } from '@/lib/managers/spamexperts-manager';

export async function GET() {
  try {
    const manager = new SpamExpertsManager();
    const domains = await manager.getDomains();

    return NextResponse.json({
      success: true,
      result: domains,
      errors: [],
      messages: []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        result: null,
        errors: [{ code: 'SE001', message }],
        messages: []
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, deliveryHost } = body;

    if (!domain) {
      return NextResponse.json(
        {
          success: false,
          result: null,
          errors: [{ code: 'SE004', message: 'Domain is required' }],
          messages: []
        },
        { status: 400 }
      );
    }

    const manager = new SpamExpertsManager();
    const result = await manager.addDomain(domain, deliveryHost || '');

    return NextResponse.json({
      success: true,
      result: result,
      errors: [],
      messages: []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        result: null,
        errors: [{ code: 'SE002', message }],
        messages: []
      },
      { status: 500 }
    );
  }
}
