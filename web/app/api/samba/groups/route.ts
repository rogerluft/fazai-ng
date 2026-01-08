import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { SambaAPIResponse } from '@/types/samba.types';

// Samba Groups Management API
// POST - Create Samba group

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward to backend API
    const backendUrl = process.env.FAZAI_BACKEND_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/api/samba/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Failed to create group',
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
        message: 'Failed to create group'
      } as SambaAPIResponse<null>,
      { status: 500 }
    );
  }
}
