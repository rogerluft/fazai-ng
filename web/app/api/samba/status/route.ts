import { NextResponse } from 'next/server';
import type { SambaStatus } from '@/types/samba.types';

// Samba Status API
// Returns current Samba service status and configured shares

export async function GET() {
  try {
    // TODO: Integrate with actual fzsamba script from /opt/fazai/bin/fzsamba
    // const exec = require('child_process').execSync;
    // const status = exec('sudo /opt/fazai/bin/fzsamba status').toString();
    // const shares = exec('sudo /opt/fazai/bin/fzsamba list').toString();

    const mockStatus: SambaStatus = {
      running: true,
      version: '4.19.2',
      shares: [
        {
          name: 'public',
          path: '/srv/samba/public',
          comment: 'Public shared folder',
          validUsers: [],
          readonly: false,
          browseable: true,
          guestOk: true,
        },
        {
          name: 'fazai',
          path: '/opt/fazai/data',
          comment: 'FazAI data directory',
          validUsers: ['rluft', '@fazai'],
          readonly: false,
          browseable: true,
          guestOk: false,
        }
      ],
      activeConnections: 2,
    };

    return NextResponse.json(mockStatus);
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
