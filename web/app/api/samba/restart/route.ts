import { NextResponse } from 'next/server';
import type { SambaAPIResponse } from '@/types/samba.types';

// Samba Service Management API
// POST - Restart Samba service

export async function POST() {
  try {
    // Forward to backend API
    const backendUrl = process.env.FAZAI_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/samba/restart`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to restart service',
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
        message: 'Failed to restart Samba service'
      } as SambaAPIResponse<null>,
      { status: 500 }
    );
  }
}
