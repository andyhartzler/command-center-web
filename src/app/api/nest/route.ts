import { NextRequest, NextResponse } from 'next/server';
import { readTokens, saveTokens } from './token-store';

async function refreshNestToken(refreshToken: string) {
  const clientId = process.env.NEST_CLIENT_ID;
  const clientSecret = process.env.NEST_CLIENT_SECRET;

  const params = new URLSearchParams({
    client_id: clientId!,
    client_secret: clientSecret!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Refresh failed: ${data.error}`);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Refresh token might not be returned if unchanged
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function GET(req: NextRequest) {
  const projectId = process.env.NEST_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: 'NEST_PROJECT_ID not configured' }, { status: 500 });
  }

  let tokens = await readTokens(req);
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated', authUrl: '/api/nest/auth' }, { status: 401 });
  }

  // Refresh if expired (with 1 min buffer)
  if (Date.now() > tokens.expiresAt - 60000) {
    try {
      const newTokens = await refreshNestToken(tokens.refreshToken);
      await saveTokens(newTokens);
      tokens = newTokens;
    } catch (err) {
      return NextResponse.json({ error: 'Auth expired', authUrl: '/api/nest/auth' }, { status: 401 });
    }
  }

  try {
    const res = await fetch(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${projectId}/devices`,
      {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (res.status === 401) {
      return NextResponse.json({ error: 'Unauthorized', authUrl: '/api/nest/auth' }, { status: 401 });
    }

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || 'Failed to fetch from Nest API');
    }

    const data = await res.json();
    
    // Set cookie if tokens were refreshed in this request
    const response = NextResponse.json(data);
    // In a real app, we'd check if tokens actually changed
    return response;
  } catch (error) {
    console.error('[Nest API Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
