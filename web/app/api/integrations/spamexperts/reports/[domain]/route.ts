import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '24h';

    // Return empty report structure
    return NextResponse.json({
      success: true,
      result: {
        domain,
        period,
        total_emails: 0,
        spam_blocked: 0,
        clean_delivered: 0,
        quarantined: 0,
        virus_detected: 0,
        outgoing_emails: 0,
        statistics: {
          incoming: { total: 0, clean: 0, spam: 0, virus: 0, quarantined: 0 },
          outgoing: { total: 0, sent: 0, rejected: 0 }
        },
        top_senders: [],
        top_recipients: []
      },
      errors: [],
      messages: ['Report data pending - SpamExperts integration not configured']
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        result: null,
        errors: [{ code: 'SE006', message }],
        messages: []
      },
      { status: 500 }
    );
  }
}
