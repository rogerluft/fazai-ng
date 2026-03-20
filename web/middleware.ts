/**
 * Next.js Middleware for HTTP Basic Auth
 * Protects all pages and API routes (except health check and static assets)
 * Reads credentials from env vars (set from fazai.conf at server start)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Default credentials (overridden by env vars from fazai.conf)
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'fazai123';

function getCredentials(): { username: string; password: string } {
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
  // Allow health check without auth
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.next();
  }

  if (!validateBasicAuth(request)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="FazAI Web UI"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
