import { NextRequest, NextResponse } from 'next/server';

const SCRAPER_URL = process.env.FINDMY_SCRAPER_URL;

// In-memory cache
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds

interface Friend {
  handle: string;
  name: string;
  subtitle: string;
  address: string;
  lat: number;
  lng: number;
  lastUpdated: number;
  status: string;
}

/** Reverse-geocode coords to a city/area name using Open-Meteo geocoding (free, no key) */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
      { headers: { 'User-Agent': 'command-center-web/1.0' } }
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

/** Fill in missing address/subtitle for friends that have valid coords */
async function enrichFriends(friends: Friend[]): Promise<Friend[]> {
  const tasks = friends.map(async (f) => {
    if (f.address || (f.lat === 0 && f.lng === 0)) return f;
    const location = await reverseGeocode(f.lat, f.lng);
    if (!location) return f;
    return { ...f, address: location, subtitle: location };
  });
  return Promise.all(tasks);
}

async function fetchFromScraper() {
  if (!SCRAPER_URL) throw new Error('FINDMY_SCRAPER_URL not configured');
  const res = await fetch(`${SCRAPER_URL}/api/findmy`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Scraper returned ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data.friends)) {
    data.friends = await enrichFriends(data.friends);
  }
  return data;
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  try {
    const skipCache = action === 'refresh';

    if (!skipCache && cache && Date.now() - cache.ts < CACHE_TTL) {
      const data = cache.data as { friends: { handle: string; name: string }[] };
      if (action === 'friends-list') {
        return NextResponse.json({
          friends: data.friends.map(f => ({ handle: f.handle, name: f.name })),
        });
      }
      return NextResponse.json(data);
    }

    const data = await fetchFromScraper();
    cache = { data, ts: Date.now() };

    if (action === 'friends-list') {
      return NextResponse.json({
        friends: data.friends.map((f: { handle: string; name: string }) => ({
          handle: f.handle,
          name: f.name,
        })),
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[FindMy API] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch Find My data' },
      { status: 500 }
    );
  }
}
