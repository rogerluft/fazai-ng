/**
 * Next.js Middleware for HTTP Basic Auth on API routes
 * Reads credentials from fazai.conf via config-loader
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Default credentials (will be overridden by fazai.conf at runtime)
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'fazai123';

function getCredentials(): { username: string; password: string } {
  // In middleware, we can't use fs directly, so use env vars
  // The config-loader will set these from fazai.conf when the server starts
  return {
    username: process.env.WEB_UI_USERNAME || DEFAULT_USERNAME,
    password: process.env.WEB_UI_PASSWORD || DEFAULT_PASSWORD,
  };
}

function validateBasicAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');

    const validCreds = getCredentials();
    return username === validCreds.username && password === validCreds.password;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  // Only protect /api/integrations/* routes
  if (request.nextUrl.pathname.startsWith('/api/integrations')) {
    if (!validateBasicAuth(request)) {
      return new NextResponse('Unauthorized', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="FazAI Web UI"',
        },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/integrations/:path*',
};
