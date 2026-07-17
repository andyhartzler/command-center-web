import { NextRequest, NextResponse } from 'next/server';

const SCRAPER_URL = process.env.FINDMY_SCRAPER_URL;

interface FriendLocation {
  handle: string;
  name: string;
  subtitle: string;
  address: string;
  lat: number;
  lng: number;
  lastUpdated: number;
  status: string;
}

interface FindMyPayload {
  friends: FriendLocation[];
  avatars: Record<string, string>;
}

// In-memory cache of the enriched payload
let cache: { data: FindMyPayload; ts: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds

// Reverse-geocode cache keyed by coordinates rounded to 2 decimal places
// (~1km); friends rarely cross cells, so this stays tiny and stable.
const geocodeCache = new Map<string, string>();
const GEOCODE_CACHE_MAX = 500;

/** Format coords as a readable fallback location (e.g. "39.1 N, 94.6 W") */
function coordsToLabel(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)} ${latDir}, ${Math.abs(lng).toFixed(1)} ${lngDir}`;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
      {
        headers: { 'User-Agent': 'CommandCenterWall/1.0 (dashboard kiosk)' },
        signal: AbortSignal.timeout(4000),
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address;
    if (!addr) return null;
    const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
    const state = addr.state || '';
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
    return data.display_name?.split(',').slice(0, 2).join(',').trim() || null;
  } catch {
    return null;
  }
}

async function geocodeLabel(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = geocodeCache.get(key);
  if (cached) return cached;

  const label = (await reverseGeocode(lat, lng)) || coordsToLabel(lat, lng);
  if (geocodeCache.size >= GEOCODE_CACHE_MAX) {
    const oldest = geocodeCache.keys().next().value;
    if (oldest !== undefined) geocodeCache.delete(oldest);
  }
  geocodeCache.set(key, label);
  return label;
}

/** Fill missing addresses server-side and normalize status */
async function enrichFriends(friends: FriendLocation[]): Promise<FriendLocation[]> {
  return Promise.all(
    friends.map(async f => {
      const hasCoords = Number.isFinite(f.lat) && Number.isFinite(f.lng) && (f.lat !== 0 || f.lng !== 0);
      const status = hasCoords && f.status !== 'live' && f.status !== 'legacy' ? 'live' : f.status;
      if (f.address) return status !== f.status ? { ...f, status } : f;
      if (!hasCoords) return f;
      const label = await geocodeLabel(f.lat, f.lng);
      return { ...f, address: label, subtitle: label, status };
    }),
  );
}

async function fetchFromScraper(): Promise<FindMyPayload> {
  if (!SCRAPER_URL) throw new Error('FINDMY_SCRAPER_URL not configured');
  const res = await fetch(`${SCRAPER_URL}/api/findmy`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Scraper returned ${res.status}`);
  return res.json();
}

function friendsList(data: FindMyPayload) {
  return NextResponse.json({
    friends: data.friends.map(f => ({ handle: f.handle, name: f.name })),
  });
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  try {
    const skipCache = action === 'refresh';

    if (!skipCache && cache && Date.now() - cache.ts < CACHE_TTL) {
      if (action === 'friends-list') return friendsList(cache.data);
      return NextResponse.json(cache.data);
    }

    const raw = await fetchFromScraper();
    const data: FindMyPayload = {
      friends: await enrichFriends(raw.friends ?? []),
      avatars: raw.avatars ?? {},
    };
    cache = { data, ts: Date.now() };

    if (action === 'friends-list') return friendsList(data);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[FindMy API] error:', err);
    // Serve the last-good payload rather than an error when we have one
    if (cache) {
      if (action === 'friends-list') return friendsList(cache.data);
      return NextResponse.json({ ...cache.data, stale: true });
    }
    return NextResponse.json(
      { error: 'Failed to fetch Find My data' },
      { status: 500 },
    );
  }
}
