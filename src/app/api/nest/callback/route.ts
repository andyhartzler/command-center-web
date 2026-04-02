import { NextRequest, NextResponse } from 'next/server';
import { saveTokens, setTokensCookie } from '../token-store';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const storedState = req.cookies.get('nest_state')?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.json({ error: 'Invalid state or missing code' }, { status: 400 });
  }

  const clientId = process.env.NEST_CLIENT_ID;
  const clientSecret = process.env.NEST_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Nest credentials not configured' }, { status: 500 });
  }

  const origin = req.nextUrl.origin;

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/api/nest/callback`,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    console.error('[Nest] Token exchange failed:', JSON.stringify(tokenData));
    const redirectUrl = new URL('/', origin);
    redirectUrl.searchParams.set('nest_error', tokenData.error);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('nest_state');
    return response;
  }

  const tokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  };

  await saveTokens(tokens);

  const redirectUrl = new URL('/', origin);
  redirectUrl.searchParams.set('nest', 'connected');
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete('nest_state');
  setTokensCookie(response, tokens);
  return response;
}
