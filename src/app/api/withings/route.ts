import { NextRequest, NextResponse } from 'next/server';
import { getNonce, signRequest } from './signing';
import { readTokens, saveTokens, type StoredTokens } from './token-store';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

async function refreshAccessToken(tokens: StoredTokens): Promise<StoredTokens> {
  const clientId = process.env.WITHINGS_CLIENT_ID;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Withings credentials not configured');

  // Get nonce and sign the refresh request
  const nonce = await getNonce(clientId, clientSecret);
  const signature = signRequest('requesttoken', clientId, nonce, clientSecret);

  const body = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refreshToken,
    nonce,
    signature,
  });

  const res = await fetch('https://wbsapi.withings.net/v2/oauth2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await res.json();
  if (data.status !== 0) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  const updated: StoredTokens = {
    accessToken: data.body.access_token,
    refreshToken: data.body.refresh_token,
    expiresAt: Date.now() + data.body.expires_in * 1000,
    userId: data.body.userid || tokens.userId,
  };

  await saveTokens(updated);
  // Clear data cache after token refresh
  cache.clear();
  return updated;
}

// Dedup concurrent refresh requests to prevent race condition
let refreshPromise: Promise<StoredTokens> | null = null;

async function getValidToken(): Promise<{ token: string } | { error: string }> {
  let tokens = await readTokens();
  if (!tokens) return { error: 'not_connected' };

  // Refresh if expired or expiring within 5 minutes
  if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken(tokens).finally(() => { refreshPromise = null; });
    }
    try {
      tokens = await refreshPromise;
    } catch (err) {
      console.error('[Withings] Token refresh failed:', err);
      return { error: 'token_refresh_failed' };
    }
  }

  return { token: tokens.accessToken };
}

async function withingsPost(endpoint: string, token: string, params: Record<string, string>) {
  const body = new URLSearchParams(params);
  const res = await fetch(`https://wbsapi.withings.net${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${token}`,
    },
    body: body.toString(),
  });
  return res.json();
}

// Parse Withings measurement value: value * 10^unit
function parseMeasValue(value: number, unit: number): number {
  return Math.round(value * Math.pow(10, unit) * 100) / 100;
}

// Convert kg to lbs
function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

interface MeasureGroup {
  grpid: number;
  date: number;
  measures: { type: number; value: number; unit: number }[];
}

async function fetchMeasures(token: string) {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

  const data = await withingsPost('/measure', token, {
    action: 'getmeas',
    startdate: thirtyDaysAgo.toString(),
    enddate: now.toString(),
    meastypes: '1,5,6,8,9,10,11,54,76,77,88',
  });

  if (data.status !== 0) return null;

  const groups: MeasureGroup[] = data.body?.measuregrps || [];
  if (groups.length === 0) return null;

  // Extract latest of each type
  const typeMap: Record<number, { value: number; date: number }> = {};
  const weightHistory: { date: string; weight: number; timestamp: number }[] = [];

  for (const grp of groups) {
    for (const m of grp.measures) {
      const val = parseMeasValue(m.value, m.unit);
      if (!typeMap[m.type] || grp.date > typeMap[m.type].date) {
        typeMap[m.type] = { value: val, date: grp.date };
      }
      // Collect weight history
      if (m.type === 1) {
        weightHistory.push({
          date: new Date(grp.date * 1000).toISOString().slice(0, 10),
          weight: kgToLbs(val),
          timestamp: grp.date,
        });
      }
    }
  }

  // Dedupe weight history by date (keep most recent measurement per day)
  const historyByDate = new Map<string, { weight: number; timestamp: number }>();
  for (const h of weightHistory) {
    const existing = historyByDate.get(h.date);
    if (!existing || h.timestamp > existing.timestamp) {
      historyByDate.set(h.date, { weight: h.weight, timestamp: h.timestamp });
    }
  }

  const history = Array.from(historyByDate.entries())
    .map(([date, entry]) => ({ date, weight: entry.weight }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const get = (type: number) => typeMap[type]?.value ?? null;
  const latestDate = typeMap[1]?.date ? new Date(typeMap[1].date * 1000).toISOString() : null;

  return {
    latest: {
      weight: get(1) !== null ? kgToLbs(get(1)!) : null,
      fatRatio: get(6),
      fatMass: get(8) !== null ? kgToLbs(get(8)!) : null,
      muscleMass: get(76) !== null ? kgToLbs(get(76)!) : null,
      boneMass: get(88) !== null ? kgToLbs(get(88)!) : null,
      hydration: get(77),
      heartRate: get(11),
      systolic: get(10),
      diastolic: get(9),
      spo2: get(54),
      date: latestDate,
    },
    history,
  };
}

async function fetchSleep(token: string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const data = await withingsPost('/v2/sleep', token, {
    action: 'getsummary',
    startdateymd: fmt(yesterday),
    enddateymd: fmt(today),
    data_fields: 'nb_rem_episodes,sleep_efficiency,sleep_latency,total_sleep_time,total_timeinbed,wakeup_latency,waso,deepsleepduration,lightsleepduration,remsleepduration,sleep_score,hr_average,hr_min,rr_average',
  });

  if (data.status !== 0) return null;

  const series = data.body?.series;
  if (!series || series.length === 0) return null;

  // Use most recent night
  const night = series[series.length - 1];
  const d = night.data || night;

  return {
    lastNight: {
      totalSleep: d.total_sleep_time ?? null,
      deepSleep: d.deepsleepduration ?? null,
      lightSleep: d.lightsleepduration ?? null,
      remSleep: d.remsleepduration ?? null,
      awake: d.waso ?? null,
      sleepScore: d.sleep_score ?? null,
      hrAvg: d.hr_average ?? null,
      hrMin: d.hr_min ?? null,
      rrAvg: d.rr_average ?? null,
      date: night.date ?? fmt(yesterday),
    },
  };
}

async function fetchActivity(token: string) {
  const today = new Date().toISOString().slice(0, 10);

  const data = await withingsPost('/v2/measure', token, {
    action: 'getactivity',
    startdateymd: today,
    enddateymd: today,
    data_fields: 'steps,distance,calories,elevation',
  });

  if (data.status !== 0) return null;

  const activities = data.body?.activities;
  if (!activities || activities.length === 0) return null;

  const a = activities[0];
  return {
    today: {
      steps: a.steps ?? 0,
      distance: a.distance ? Math.round(a.distance) : 0,
      calories: a.calories ? Math.round(a.calories) : 0,
      elevation: a.elevation ? Math.round(a.elevation) : 0,
    },
  };
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'all';

  // Status check - no token needed for this response shape
  if (action === 'status') {
    const tokens = await readTokens();
    return NextResponse.json({ connected: !!tokens });
  }

  const tokenResult = await getValidToken();
  if ('error' in tokenResult) {
    if (tokenResult.error === 'not_connected') {
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json({ error: tokenResult.error }, { status: 500 });
  }

  const token = tokenResult.token;

  try {
    if (action === 'measures') {
      const cached = getCached('measures');
      if (cached) return NextResponse.json(cached);
      const measures = await fetchMeasures(token);
      if (measures) setCache('measures', measures);
      return NextResponse.json(measures);
    }

    if (action === 'sleep') {
      const cached = getCached('sleep');
      if (cached) return NextResponse.json(cached);
      const sleep = await fetchSleep(token);
      if (sleep) setCache('sleep', sleep);
      return NextResponse.json(sleep);
    }

    if (action === 'activity') {
      const cached = getCached('activity');
      if (cached) return NextResponse.json(cached);
      const activity = await fetchActivity(token);
      if (activity) setCache('activity', activity);
      return NextResponse.json(activity);
    }

    // Default: fetch all
    const cached = getCached('all');
    if (cached) return NextResponse.json(cached);

    const [measures, sleep, activity] = await Promise.all([
      fetchMeasures(token),
      fetchSleep(token),
      fetchActivity(token),
    ]);

    const result = {
      connected: true,
      measures,
      sleep,
      activity,
    };

    setCache('all', result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[Withings] API error:', err);
    return NextResponse.json({ error: 'Failed to fetch Withings data' }, { status: 500 });
  }
}
