import { NextResponse } from 'next/server';
import type { SambaStatus } from '@/types/samba.types';

// Samba Status API
// Returns current Samba service status and configured shares

export async function GET() {
  try {
    // Forward to backend API
    const backendUrl = process.env.FAZAI_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/samba/status`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to fetch status',
        },
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
        message: 'Failed to fetch Samba status'
      },
      { status: 500 }
    );
  }
}
