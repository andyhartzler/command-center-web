import { NextRequest, NextResponse } from 'next/server';

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

// In-memory caches
let locationCache: { data: { friends: FriendLocation[]; avatars: Record<string, string> }; ts: number } | null = null;
const LOCATION_TTL = 60_000; // 1 minute

function getScraperUrl() {
  const url = process.env.FINDMY_SCRAPER_URL;
  if (!url) return null;
  return url.replace(/\/$/, '');
}

async function fetchFromScraper(scraperUrl: string, action?: string) {
  const url = action
    ? `${scraperUrl}/api/findmy?action=${action}`
    : `${scraperUrl}/api/findmy`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Scraper returned ${res.status}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  const scraperUrl = getScraperUrl();
  if (!scraperUrl) {
    return NextResponse.json({ error: 'Find My scraper not configured' }, { status: 503 });
  }

  const action = req.nextUrl.searchParams.get('action');

  try {
    if (action === 'friends-list') {
      const data = await fetchFromScraper(scraperUrl, 'friends-list');
      return NextResponse.json(data);
    }

    // Get friends with cached data
    if (locationCache && Date.now() - locationCache.ts < LOCATION_TTL) {
      return NextResponse.json(locationCache.data);
    }

    const data = await fetchFromScraper(scraperUrl);
    locationCache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    console.error('[FindMy API] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch Find My data' },
      { status: 500 }
    );
  }
}
