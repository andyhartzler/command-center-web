import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const clientId = process.env.NEST_CLIENT_ID;
  const projectId = process.env.NEST_PROJECT_ID;
  
  if (!clientId || !projectId) {
    return NextResponse.json({ error: 'Nest credentials not configured' }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    access_type: 'offline',
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${origin}/api/nest/callback`,
    scope: 'https://www.googleapis.com/auth/sdm.service',
    state,
    prompt: 'consent',
  });

  // Use the Nest-specific Partner Connections Manager URL
  const authUrl = `https://nestservices.google.com/partnerconnections/${projectId}/auth?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('nest_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}
