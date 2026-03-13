import { NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';

let cachedToken: { jwt: string; exp: number } | null = null;

export async function GET() {
  try {
    // Return cached token if valid (with 1 hour buffer)
    if (cachedToken && Date.now() < cachedToken.exp - 3600_000) {
      return NextResponse.json({ token: cachedToken.jwt });
    }

    const keyId = process.env.WEATHERKIT_KEY_ID; // Same key
    const teamId = process.env.WEATHERKIT_TEAM_ID;
    const privateKeyPem = process.env.WEATHERKIT_PRIVATE_KEY;

    if (!keyId || !teamId || !privateKeyPem) {
      return NextResponse.json({ error: 'MapKit not configured' }, { status: 500 });
    }

    const privateKey = await importPKCS8(privateKeyPem, 'ES256');
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7 * 24 * 3600; // 7 days (Apple max for MapKit)

    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
      .setIssuer(teamId)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(privateKey);

    cachedToken = { jwt, exp: exp * 1000 };
    return NextResponse.json({ token: jwt });
  } catch (err) {
    console.error('[mapkit-token] error:', err);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
