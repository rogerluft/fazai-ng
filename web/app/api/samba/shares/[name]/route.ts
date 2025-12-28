import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SambaAPIResponse } from '@/types/samba.types';

// Samba Share Management - Individual Share
// DELETE - Remove a share by name

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: shareName } = await params;

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

    // Forward to backend API
    const backendUrl = process.env.FAZAI_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/samba/shares/${encodeURIComponent(shareName)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to delete share',
        } as SambaAPIResponse<null>,
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
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
