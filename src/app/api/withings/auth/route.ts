import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const clientId = process.env.WITHINGS_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'WITHINGS_CLIENT_ID not configured' }, { status: 500 });
  }

  // Pin to a stable public HTTPS callback (registered with Withings) so the
  // Cloudflare tunnel's internal http/localhost origin never leaks into redirect_uri.
  const publicBase = (process.env.PUBLIC_BASE_URL || 'https://hartzler.app').replace(/\/$/, '');
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'user.metrics,user.activity',
    redirect_uri: `${publicBase}/api/withings/callback`,
    state,
  });

  const authUrl = `https://account.withings.com/oauth2_user/authorize2?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('withings_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}
