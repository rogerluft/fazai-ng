import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { CreateSharePayload, SambaAPIResponse } from '@/types/samba.types';

// Samba Shares Management API
// POST - Create new share
// GET - List all shares (handled by /status route)

export async function POST(request: NextRequest) {
  try {
    const body: CreateSharePayload = await request.json();

    // Validate required fields
    if (!body.name || !body.path) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name and path',
        } as SambaAPIResponse<null>,
        { status: 400 }
      );
    }

    // TODO: Integrate with actual fzsamba script
    // const exec = require('child_process').execSync;
    // const validUsers = body.validUsers || '';
    // const readonly = body.readonly ? 'yes' : 'no';
    // const browseable = body.browseable ? 'yes' : 'no';
    // const guestOk = body.guestOk ? 'yes' : 'no';
    //
    // const command = `sudo /opt/fazai/bin/fzsamba add-share "${body.name}" "${body.path}" "${body.comment || ''}" "${validUsers}" "${readonly}" "${browseable}" "${guestOk}"`;
    // exec(command);

    return NextResponse.json({
      success: true,
      message: `Share '${body.name}' created successfully (mock)`,
      data: {
        name: body.name,
        path: body.path,
        comment: body.comment,
        validUsers: body.validUsers ? body.validUsers.split(',').map(u => u.trim()) : [],
        readonly: body.readonly || false,
        browseable: body.browseable !== false,
        guestOk: body.guestOk || false,
      }
    } as SambaAPIResponse<any>);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: message,
        message: 'Failed to create share'
      } as SambaAPIResponse<null>,
      { status: 500 }
    );
  }
}
