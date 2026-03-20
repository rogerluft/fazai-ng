import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

function getServiceStatus(service: string): string {
  try {
    const result = execSync(`systemctl is-active ${service} 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    return result; // "active", "inactive", "failed"
  } catch {
    return 'inactive';
  }
}

export async function GET() {
  try {
    const smbStatus = getServiceStatus('smb');
    const nmbStatus = getServiceStatus('nmb');

    const running = smbStatus === 'active';

    // Get version
    let version = 'unknown';
    try {
      const versionOutput = execSync('smbd --version 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
      version = versionOutput.trim();
    } catch { /* ignore */ }

    // Get active connections count
    let activeConnections = 0;
    try {
      const smbstatusOutput = execSync('smbstatus --brief 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
      // Count lines that look like connections (skip header lines)
      const lines = smbstatusOutput.split('\n').filter(l => l.trim() && !l.startsWith('Service') && !l.startsWith('---'));
      activeConnections = lines.length;
    } catch { /* ignore */ }

    return NextResponse.json({
      status: running ? 'running' : 'stopped',
      services: {
        smb: smbStatus,
        nmb: nmbStatus,
      },
      version,
      activeConnections,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message, message: 'Failed to fetch Samba status' },
      { status: 500 }
    );
  }
}
