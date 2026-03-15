import { NextRequest, NextResponse } from 'next/server';

const SCRAPER_URL = process.env.FINDMY_SCRAPER_URL;

// In-memory cache
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds

async function fetchFromScraper() {
  if (!SCRAPER_URL) throw new Error('FINDMY_SCRAPER_URL not configured');
  const res = await fetch(`${SCRAPER_URL}/api/findmy`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Scraper returned ${res.status}`);
  return res.json();
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
