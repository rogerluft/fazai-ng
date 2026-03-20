import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { execSync } from 'child_process';

export async function GET() {
  try {
    // List Samba users via pdbedit
    const output = execSync('pdbedit -L -v 2>/dev/null || pdbedit -L 2>/dev/null', {
      encoding: 'utf-8',
      timeout: 5000,
    });

    const users: Array<{ username: string; uid?: number; smbEnabled: boolean }> = [];
    for (const line of output.split('\n')) {
      // pdbedit -L format: username:uid:fullname
      const match = line.match(/^([^:]+):(\d+):/);
      if (match) {
        users.push({
          username: match[1],
          uid: parseInt(match[2], 10),
          smbEnabled: true,
        });
      }
    }

    return NextResponse.json({ success: true, users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'username and password are required' },
        { status: 400 }
      );
    }

    // Create system user if it doesn't exist, then add to Samba
    try {
      execSync(`id "${username}" 2>/dev/null`, { encoding: 'utf-8' });
    } catch {
      execSync(`useradd -M -s /sbin/nologin "${username}"`, { encoding: 'utf-8', timeout: 5000 });
    }

    // Add Samba password (echo password via stdin)
    execSync(
      `(echo "${password}"; echo "${password}") | smbpasswd -a -s "${username}"`,
      { encoding: 'utf-8', timeout: 5000 }
    );

    return NextResponse.json({
      success: true,
      message: `Samba user '${username}' created`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message, message: 'Failed to create user' },
      { status: 500 }
    );
  }
}
