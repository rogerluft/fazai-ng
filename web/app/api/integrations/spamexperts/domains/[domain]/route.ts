import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SpamExpertsManager } from '@/lib/managers/spamexperts-manager';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;

    const manager = new SpamExpertsManager();
    await manager.deleteDomain(domain);

    return NextResponse.json({
      success: true,
      result: { domain },
      errors: [],
      messages: [`Domain ${domain} removed successfully from SpamExperts`]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        result: null,
        errors: [{ code: 'SE003', message }],
        messages: []
      },
      { status: 500 }
    );
  }
}
