import { NextRequest, NextResponse } from 'next/server';
import { getNonce, signRequest } from '../signing';
import { saveTokens, setTokensCookie } from '../token-store';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const storedState = req.cookies.get('withings_state')?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.json({ error: 'Invalid state or missing code' }, { status: 400 });
  }

  const clientId = process.env.WITHINGS_CLIENT_ID;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Withings credentials not configured' }, { status: 500 });
  }

  // Public HTTPS base for both the token-exchange redirect_uri and all user-facing
  // redirects (req.nextUrl.origin is https://localhost:3001 behind the tunnel).
  const publicBase = (process.env.PUBLIC_BASE_URL || 'https://hartzler.app').replace(/\/$/, '');

  // Get nonce and sign the request
  const nonce = await getNonce(clientId, clientSecret);
  const signature = signRequest('requesttoken', clientId, nonce, clientSecret);

  const body = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${publicBase}/api/withings/callback`,
    nonce,
    signature,
  });

  const tokenRes = await fetch('https://wbsapi.withings.net/v2/oauth2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.status !== 0) {
    console.error('[Withings] Token exchange failed:', JSON.stringify(tokenData));
    const redirectUrl = new URL('/', publicBase);
    redirectUrl.searchParams.set('withings_error', `status_${tokenData.status}`);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('withings_state');
    return response;
  }

  const { access_token, refresh_token, expires_in, userid } = tokenData.body;

  const tokens = {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: Date.now() + expires_in * 1000,
    userId: userid,
  };

  await saveTokens(tokens);

  const redirectUrl = new URL('/', publicBase);
  redirectUrl.searchParams.set('withings', 'connected');
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete('withings_state');
  setTokensCookie(response, tokens);
  return response;
}
