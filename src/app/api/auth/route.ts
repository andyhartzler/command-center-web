import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { COOKIE_NAME, SESSION_DAYS, createSessionToken } from '@/lib/session';

function constantTimeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Compare against self to keep timing flat, then fail
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.AUTH_PASSWORD;
    const secret = process.env.AUTH_SECRET;

    if (!secret || !correctPassword) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    if (typeof password !== 'string' || !constantTimeMatch(password, correctPassword)) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      // Secure cookies require HTTPS. When self-hosted on the LAN over plain
      // http:// (e.g. the Frame TV pointing at http://192.168.4.21:3001), set
      // COOKIE_INSECURE=1 so the auth cookie is allowed to stick.
      secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== '1',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * SESSION_DAYS,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
