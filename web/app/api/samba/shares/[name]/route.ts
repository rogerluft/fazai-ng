import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SambaAPIResponse } from '@/types/samba.types';

// Samba Share Management - Individual Share
// DELETE - Remove a share by name

export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const shareName = params.name;

    if (!shareName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Share name is required',
        } as SambaAPIResponse<null>,
        { status: 400 }
      );
    }

    // Prevent deletion of system shares
    const protectedShares = ['homes', 'printers', 'print$', 'IPC$'];
    if (protectedShares.includes(shareName)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete protected share: ${shareName}`,
        } as SambaAPIResponse<null>,
        { status: 403 }
      );
    }

    // TODO: Integrate with actual fzsamba script
    // const exec = require('child_process').execSync;
    // exec(`sudo /opt/fazai/bin/fzsamba remove-share "${shareName}"`);

    return NextResponse.json({
      success: true,
      message: `Share '${shareName}' deleted successfully (mock)`,
    } as SambaAPIResponse<null>);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: message,
        message: 'Failed to delete share'
      } as SambaAPIResponse<null>,
      { status: 500 }
    );
  }
}
