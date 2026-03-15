import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getNonce, signRequest } from '../signing';

const TOKENS_PATH = path.join(process.cwd(), 'data', 'withings-tokens.json');

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

  const origin = req.nextUrl.origin;

  // Get nonce and sign the request
  const nonce = await getNonce(clientId, clientSecret);
  const signature = signRequest('requesttoken', clientId, nonce, clientSecret);

  const body = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/api/withings/callback`,
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
    console.error('[Withings] Token exchange failed:', tokenData);
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
  }

  const { access_token, refresh_token, expires_in, userid } = tokenData.body;

  const tokens = {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: Date.now() + expires_in * 1000,
    userId: userid,
  };

  // Ensure data directory exists
  await fs.mkdir(path.dirname(TOKENS_PATH), { recursive: true });
  await fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2));

  const response = NextResponse.redirect(new URL('/editor', origin));
  response.cookies.delete('withings_state');
  return response;
}
