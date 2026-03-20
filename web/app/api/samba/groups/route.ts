import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { execSync } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupname, users } = body;

    if (!groupname) {
      return NextResponse.json(
        { success: false, error: 'groupname is required' },
        { status: 400 }
      );
    }

    // Create system group if it doesn't exist
    try {
      execSync(`getent group "${groupname}" 2>/dev/null`, { encoding: 'utf-8' });
    } catch {
      execSync(`groupadd "${groupname}"`, { encoding: 'utf-8', timeout: 5000 });
    }

    // Add users to group if specified
    if (users && Array.isArray(users)) {
      for (const user of users) {
        try {
          execSync(`usermod -aG "${groupname}" "${user}"`, { encoding: 'utf-8', timeout: 5000 });
        } catch { /* user may not exist, skip */ }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Group '${groupname}' created`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message, message: 'Failed to create group' },
      { status: 500 }
    );
  }
}
