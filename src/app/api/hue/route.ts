import { NextRequest, NextResponse } from 'next/server';

// Talks to the actual Hue bridge on the local network. The application key
// never travels in a query string: GET reads it from the
// `x-hue-application-key` header, PUT reads it from the JSON body.

const BRIDGE_HOST_RE = /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/;
const APP_KEY_RE = /^[a-zA-Z0-9-]{10,}$/;
const LIGHT_ID_RE = /^[a-zA-Z0-9_-]+$/;

const BRIDGE_TIMEOUT_MS = 5000;

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const bridgeIp = request.nextUrl.searchParams.get('bridgeIp');
  const applicationKey = request.headers.get('x-hue-application-key');

  if (!bridgeIp || !applicationKey) {
    return validationError('Missing Hue bridge credentials');
  }
  if (!BRIDGE_HOST_RE.test(bridgeIp)) return validationError('Invalid bridge address');
  if (!APP_KEY_RE.test(applicationKey)) return validationError('Invalid application key');

  try {
    const res = await fetch(`http://${bridgeIp}/api/${applicationKey}/lights`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Bridge returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    // The bridge signals auth/validation failures as [{ error: {...} }]
    if (Array.isArray(data) && data[0]?.error) {
      return NextResponse.json(
        { error: data[0].error.description || 'Bridge rejected the request' },
        { status: 502 },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('[hue] bridge fetch error', err);
    return NextResponse.json({ error: 'Failed to reach Hue bridge' }, { status: 502 });
  }
}

interface HueStatePatch {
  on?: boolean;
  bri?: number;
  hue?: number;
  sat?: number;
  xy?: [number, number];
  transitiontime?: number;
}

const ALLOWED_STATE_KEYS = new Set(['on', 'bri', 'hue', 'sat', 'xy', 'transitiontime']);

export async function PUT(request: NextRequest) {
  let body: {
    bridgeIp?: string;
    applicationKey?: string;
    lightId?: string;
    state?: HueStatePatch;
  };
  try {
    body = await request.json();
  } catch {
    return validationError('Invalid JSON body');
  }

  const { bridgeIp, applicationKey, lightId, state } = body;
  if (!bridgeIp || !applicationKey || !lightId || !state || typeof state !== 'object') {
    return validationError('Missing bridgeIp, applicationKey, lightId, or state');
  }
  if (!BRIDGE_HOST_RE.test(bridgeIp)) return validationError('Invalid bridge address');
  if (!APP_KEY_RE.test(applicationKey)) return validationError('Invalid application key');
  if (!LIGHT_ID_RE.test(lightId)) return validationError('Invalid light id');

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (ALLOWED_STATE_KEYS.has(key)) patch[key] = value;
  }
  if (Object.keys(patch).length === 0) return validationError('Empty state change');

  try {
    const res = await fetch(
      `http://${bridgeIp}/api/${applicationKey}/lights/${lightId}/state`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
        cache: 'no-store',
        signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      return NextResponse.json({ error: `Bridge returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    if (Array.isArray(data) && data.some(entry => entry?.error)) {
      const failed = data.find(entry => entry?.error);
      return NextResponse.json(
        { error: failed.error.description || 'Bridge rejected the state change' },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, result: data });
  } catch (err) {
    console.error('[hue] bridge state error', err);
    return NextResponse.json({ error: 'Failed to reach Hue bridge' }, { status: 502 });
  }
}
