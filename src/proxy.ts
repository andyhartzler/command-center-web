import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const AUTH_COOKIE = 'cc-auth';

async function isAuthed(cookieValue: string, secret: string): Promise<boolean> {
  // Signed session token (current format)
  try {
    await jwtVerify(cookieValue, new TextEncoder().encode(secret));
    return true;
  } catch { /* fall through to legacy */ }
  // Legacy raw-secret cookie: accepted during transition so the wall display
  // does not get logged out by a deploy. New logins always mint signed tokens.
  return cookieValue === secret;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/opengraph-image' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE);
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    // No AUTH_SECRET configured: open access (dev mode)
    return NextResponse.next();
  }

  if (!authCookie || !(await isAuthed(authCookie.value, secret))) {
    // APIs get a proper 401 instead of a 302 HTML redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image).*)',
  ],
};
