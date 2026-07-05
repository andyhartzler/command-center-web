import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const clientId = process.env.NEST_CLIENT_ID;
  const projectId = process.env.NEST_PROJECT_ID;
  
  if (!clientId || !projectId) {
    return NextResponse.json({ error: 'Nest credentials not configured' }, { status: 500 });
  }

  // Google OAuth (Web client) rejects private-IP / http redirect URIs, so the
  // callback must be a stable, pre-registered HTTPS URL regardless of whether
  // the dashboard was opened on the LAN IP, localhost, or the public domain.
  const publicBase = (process.env.PUBLIC_BASE_URL || 'https://hartzler.app').replace(/\/$/, '');
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    access_type: 'offline',
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${publicBase}/api/nest/callback`,
    scope: 'https://www.googleapis.com/auth/sdm.service',
    state,
    prompt: 'consent',
  });

  // Use the Nest-specific Partner Connections Manager URL
  const authUrl = `https://nestservices.google.com/partnerconnections/${projectId}/auth?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('nest_state', state, {
    httpOnly: true,
    // Match the cc-auth policy so LAN-http-initiated connects can set the state cookie.
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== '1',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}
