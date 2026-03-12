import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const correctPassword = process.env.AUTH_PASSWORD || 'hope';
    const secret = process.env.AUTH_SECRET;

    if (!secret) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    if (password !== correctPassword) {
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set('cc-auth', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // 30 days
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
