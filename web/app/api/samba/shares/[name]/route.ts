import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { execSync } from 'child_process';
import type { SambaAPIResponse } from '@/types/samba.types';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: shareName } = await params;

    if (!shareName) {
      return NextResponse.json(
        { success: false, error: 'Share name is required' } as SambaAPIResponse<null>,
        { status: 400 }
      );
    }

    // Prevent deletion of system shares
    const protectedShares = ['homes', 'printers', 'print$', 'IPC$'];
    if (protectedShares.includes(shareName)) {
      return NextResponse.json(
        { success: false, error: `Cannot delete protected share: ${shareName}` } as SambaAPIResponse<null>,
        { status: 403 }
      );
    }

    const output = execSync(
      `net conf delshare "${shareName}"`,
      { encoding: 'utf-8', timeout: 5000 }
    );

    return NextResponse.json({
      success: true,
      message: `Share '${shareName}' deleted`,
      output: output.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message, message: 'Failed to delete share' } as SambaAPIResponse<null>,
      { status: 500 }
    );
  }
}
