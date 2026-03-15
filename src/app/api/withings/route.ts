import { NextRequest, NextResponse } from 'next/server';
import { getNonce, signRequest } from './signing';
import { readTokens, saveTokens, setTokensCookie, type StoredTokens } from './token-store';

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

async function getValidToken(req: NextRequest): Promise<{ token: string; refreshed?: StoredTokens } | { error: string }> {
  let tokens = await readTokens(req);
  if (!tokens) return { error: 'not_connected' };

  // Refresh if expired or expiring within 5 minutes
  if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken(tokens).finally(() => { refreshPromise = null; });
    }
    try {
      tokens = await refreshPromise;
      return { token: tokens.accessToken, refreshed: tokens };
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

// Withings measure type IDs
const MEAS_TYPES = [
  1,   // Weight (kg)
  5,   // Fat Free Mass (kg)
  6,   // Fat Ratio (%)
  8,   // Fat Mass Weight (kg)
  9,   // Diastolic BP (mmHg)
  10,  // Systolic BP (mmHg)
  11,  // Heart Pulse (bpm)
  54,  // SpO2 (%)
  71,  // Body Temperature (°C)
  73,  // Skin Temperature (°C)
  76,  // Muscle Mass (kg)
  77,  // Hydration (%)
  88,  // Bone Mass (kg)
  91,  // Pulse Wave Velocity (m/s)
  123, // VO2max (ml/min/kg)
  155, // Vascular Age
].join(',');

function celsiusToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

async function fetchMeasures(token: string) {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

  const data = await withingsPost('/measure', token, {
    action: 'getmeas',
    startdate: thirtyDaysAgo.toString(),
    enddate: now.toString(),
    meastypes: MEAS_TYPES,
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
      fatFreeMass: get(5) !== null ? kgToLbs(get(5)!) : null,
      muscleMass: get(76) !== null ? kgToLbs(get(76)!) : null,
      boneMass: get(88) !== null ? kgToLbs(get(88)!) : null,
      hydration: get(77),
      heartRate: get(11),
      systolic: get(10),
      diastolic: get(9),
      spo2: get(54),
      bodyTemp: get(71) !== null ? celsiusToF(get(71)!) : null,
      skinTemp: get(73) !== null ? celsiusToF(get(73)!) : null,
      pulseWaveVelocity: get(91),
      vo2max: get(123),
      vascularAge: get(155),
      date: latestDate,
    },
    history,
  };
}

const SLEEP_FIELDS = [
  'total_sleep_time', 'total_timeinbed', 'sleep_efficiency', 'sleep_latency',
  'wakeup_latency', 'waso', 'deepsleepduration', 'lightsleepduration',
  'remsleepduration', 'nb_rem_episodes', 'sleep_score',
  'hr_average', 'hr_min', 'hr_max', 'rr_average', 'rr_min', 'rr_max',
  'breathing_disturbances_intensity', 'snoring', 'snoringepisodecount',
  'wakeupcount', 'wakeupduration', 'out_of_bed_count', 'night_events',
  'apnea_hypopnea_index',
].join(',');

async function fetchSleep(token: string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const data = await withingsPost('/v2/sleep', token, {
    action: 'getsummary',
    startdateymd: fmt(yesterday),
    enddateymd: fmt(today),
    data_fields: SLEEP_FIELDS,
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
      timeInBed: d.total_timeinbed ?? null,
      sleepEfficiency: d.sleep_efficiency ?? null,
      sleepLatency: d.sleep_latency ?? null,
      wakeupLatency: d.wakeup_latency ?? null,
      deepSleep: d.deepsleepduration ?? null,
      lightSleep: d.lightsleepduration ?? null,
      remSleep: d.remsleepduration ?? null,
      awake: d.waso ?? null,
      remEpisodes: d.nb_rem_episodes ?? null,
      sleepScore: d.sleep_score ?? null,
      wakeupCount: d.wakeupcount ?? null,
      wakeDuration: d.wakeupduration ?? null,
      outOfBedCount: d.out_of_bed_count ?? null,
      hrAvg: d.hr_average ?? null,
      hrMin: d.hr_min ?? null,
      hrMax: d.hr_max ?? null,
      rrAvg: d.rr_average ?? null,
      rrMin: d.rr_min ?? null,
      rrMax: d.rr_max ?? null,
      breathingDisturbances: d.breathing_disturbances_intensity ?? null,
      snoring: d.snoring ?? null,
      snoringEpisodes: d.snoringepisodecount ?? null,
      nightEvents: d.night_events ?? null,
      apneaIndex: d.apnea_hypopnea_index ?? null,
      date: night.date ?? fmt(yesterday),
    },
  };
}

const ACTIVITY_FIELDS = [
  'steps', 'distance', 'elevation', 'calories', 'totalcalories',
  'soft', 'moderate', 'intense', 'active',
  'hr_average', 'hr_min', 'hr_max',
  'hr_zone_0', 'hr_zone_1', 'hr_zone_2', 'hr_zone_3',
].join(',');

async function fetchActivity(token: string) {
  const today = new Date().toISOString().slice(0, 10);

  const data = await withingsPost('/v2/measure', token, {
    action: 'getactivity',
    startdateymd: today,
    enddateymd: today,
    data_fields: ACTIVITY_FIELDS,
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
      totalCalories: a.totalcalories ? Math.round(a.totalcalories) : 0,
      elevation: a.elevation ? Math.round(a.elevation) : 0,
      softMinutes: a.soft ?? 0,
      moderateMinutes: a.moderate ?? 0,
      intenseMinutes: a.intense ?? 0,
      activeMinutes: a.active ?? 0,
      hrAvg: a.hr_average ?? null,
      hrMin: a.hr_min ?? null,
      hrMax: a.hr_max ?? null,
      hrZone0: a.hr_zone_0 ?? 0,
      hrZone1: a.hr_zone_1 ?? 0,
      hrZone2: a.hr_zone_2 ?? 0,
      hrZone3: a.hr_zone_3 ?? 0,
    },
  };
}

// Helper to attach refreshed token cookie to any response
function withRefreshedCookie(response: NextResponse, refreshed?: StoredTokens): NextResponse {
  if (refreshed) {
    setTokensCookie(response, refreshed);
  }
  return response;
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') || 'all';

  // Status check
  if (action === 'status') {
    const tokens = await readTokens(req);
    return NextResponse.json({ connected: !!tokens });
  }

  const tokenResult = await getValidToken(req);
  if ('error' in tokenResult) {
    if (tokenResult.error === 'not_connected') {
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json({ error: tokenResult.error }, { status: 500 });
  }

  const { token, refreshed } = tokenResult;

  try {
    if (action === 'measures') {
      const cached = getCached('measures');
      if (cached) return withRefreshedCookie(NextResponse.json(cached), refreshed);
      const measures = await fetchMeasures(token);
      if (measures) setCache('measures', measures);
      return withRefreshedCookie(NextResponse.json(measures), refreshed);
    }

    if (action === 'sleep') {
      const cached = getCached('sleep');
      if (cached) return withRefreshedCookie(NextResponse.json(cached), refreshed);
      const sleep = await fetchSleep(token);
      if (sleep) setCache('sleep', sleep);
      return withRefreshedCookie(NextResponse.json(sleep), refreshed);
    }

    if (action === 'activity') {
      const cached = getCached('activity');
      if (cached) return withRefreshedCookie(NextResponse.json(cached), refreshed);
      const activity = await fetchActivity(token);
      if (activity) setCache('activity', activity);
      return withRefreshedCookie(NextResponse.json(activity), refreshed);
    }

    // Default: fetch all
    const cached = getCached('all');
    if (cached) return withRefreshedCookie(NextResponse.json(cached), refreshed);

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
    return withRefreshedCookie(NextResponse.json(result), refreshed);
  } catch (err) {
    console.error('[Withings] API error:', err);
    return NextResponse.json({ error: 'Failed to fetch Withings data' }, { status: 500 });
  }
}
