import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { execSync } from 'child_process';

/**
 * Parse testparm -s output into structured shares array
 */
function parseTestparm(): Array<{
  name: string;
  path: string | null;
  validUsers: string[];
  writable: boolean;
  browseable: boolean;
  forceGroup: string | null;
  comment: string | null;
}> {
  try {
    const output = execSync('testparm -s 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
    const shares: Array<{
      name: string;
      path: string | null;
      validUsers: string[];
      writable: boolean;
      browseable: boolean;
      forceGroup: string | null;
      comment: string | null;
    }> = [];

    let currentShare: string | null = null;
    let currentProps: Record<string, string> = {};

    for (const line of output.split('\n')) {
      const trimmed = line.trim();

      // Section header: [sharename]
      const sectionMatch = trimmed.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        // Save previous share
        if (currentShare && currentShare !== 'global') {
          shares.push({
            name: currentShare,
            path: currentProps['path'] || null,
            validUsers: currentProps['valid users']
              ? currentProps['valid users'].split(/\s+/).filter(Boolean)
              : [],
            writable: currentProps['read only'] === 'No',
            browseable: currentProps['browseable'] !== 'No',
            forceGroup: currentProps['force group'] || null,
            comment: currentProps['comment'] || null,
          });
        }
        currentShare = sectionMatch[1];
        currentProps = {};
        continue;
      }

      // Property: key = value
      const propMatch = trimmed.match(/^(.+?)\s*=\s*(.+)$/);
      if (propMatch && currentShare) {
        currentProps[propMatch[1].trim()] = propMatch[2].trim();
      }
    }

    // Save last share
    if (currentShare && currentShare !== 'global') {
      shares.push({
        name: currentShare,
        path: currentProps['path'] || null,
        validUsers: currentProps['valid users']
          ? currentProps['valid users'].split(/\s+/).filter(Boolean)
          : [],
        writable: currentProps['read only'] === 'No',
        browseable: currentProps['browseable'] !== 'No',
        forceGroup: currentProps['force group'] || null,
        comment: currentProps['comment'] || null,
      });
    }

    return shares;
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const shares = parseTestparm();
    return NextResponse.json({
      total: shares.length,
      shares,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message, message: 'Failed to fetch shares' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, path: sharePath, comment, validUsers, writable } = body;

    if (!name || !sharePath) {
      return NextResponse.json(
        { success: false, error: 'name and path are required' },
        { status: 400 }
      );
    }

    // Build net conf addshare command
    const writableFlag = writable ? 'writeable=y' : 'writeable=n';
    const shareComment = comment || name;
    const output = execSync(
      `net conf addshare "${name}" "${sharePath}" ${writableFlag} "${shareComment}"`,
      { encoding: 'utf-8', timeout: 5000 }
    );

    // Add valid users if specified
    if (validUsers) {
      execSync(
        `net conf setparm "${name}" "valid users" "${validUsers}"`,
        { encoding: 'utf-8', timeout: 5000 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Share '${name}' created`,
      output: output.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message, message: 'Failed to create share' },
      { status: 500 }
    );
  }
}
