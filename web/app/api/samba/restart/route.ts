import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST() {
  try {
    execSync('systemctl restart smb nmb', { encoding: 'utf-8', timeout: 10000 });

    return NextResponse.json({
      success: true,
      message: 'Samba services restarted (smb + nmb)',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message, message: 'Failed to restart Samba service' },
      { status: 500 }
    );
  }
}
