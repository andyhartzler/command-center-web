import { NextRequest, NextResponse } from 'next/server';

interface FindMyLocationItem {
  handle: string;
  coordinates: [number, number];
  status: 'live' | 'legacy' | 'shallow';
  last_updated: number;
  title: string;
  subtitle?: string;
  address?: string;
}

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
let locationCache: { data: FriendLocation[]; ts: number } | null = null;
const avatarCache = new Map<string, { dataUrl: string; ts: number }>();

const LOCATION_TTL = 60_000; // 1 minute
const AVATAR_TTL = 86_400_000; // 24 hours

function getCredentials() {
  const url = process.env.BLUEBUBBLES_URL;
  const pw = process.env.BLUEBUBBLES_PASSWORD;
  if (!url || !pw) return null;
  return { url: url.replace(/\/$/, ''), pw };
}

async function fetchFriends(creds: { url: string; pw: string }): Promise<FriendLocation[]> {
  const res = await fetch(`${creds.url}/api/v1/icloud/findmy/friends?password=${encodeURIComponent(creds.pw)}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`BlueBubbles returned ${res.status}`);
  const json = await res.json();
  const items: FindMyLocationItem[] = json.data || [];

  return items.map(item => ({
    handle: item.handle,
    name: item.title || item.handle,
    subtitle: item.subtitle || '',
    address: item.address || '',
    lat: item.coordinates[0],
    lng: item.coordinates[1],
    lastUpdated: item.last_updated,
    status: item.status,
  }));
}

async function fetchAvatar(handle: string, creds: { url: string; pw: string }): Promise<string | null> {
  // Check cache first
  const cached = avatarCache.get(handle);
  if (cached && Date.now() - cached.ts < AVATAR_TTL) return cached.dataUrl;

  try {
    const res = await fetch(
      `${creds.url}/api/v1/icloud/contact?password=${encodeURIComponent(creds.pw)}&address=${encodeURIComponent(handle)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const avatar = json.data?.avatar;
    if (!avatar) return null;

    const dataUrl = avatar.startsWith('data:') ? avatar : `data:image/png;base64,${avatar}`;
    avatarCache.set(handle, { dataUrl, ts: Date.now() });
    return dataUrl;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const creds = getCredentials();
  if (!creds) {
    return NextResponse.json({ error: 'BlueBubbles not configured' }, { status: 503 });
  }

  const action = req.nextUrl.searchParams.get('action');

  try {
    // Friends list for config picker
    if (action === 'friends-list') {
      const friends = await fetchFriends(creds);
      return NextResponse.json({
        friends: friends.map(f => ({ handle: f.handle, name: f.name })),
      });
    }

    // Refresh locations
    if (action === 'refresh') {
      await fetch(`${creds.url}/api/v1/icloud/findmy/friends/refresh?password=${encodeURIComponent(creds.pw)}`, {
        method: 'POST',
        cache: 'no-store',
      });
      locationCache = null;
    }

    // Get friends with cached data
    let friends: FriendLocation[];
    if (locationCache && Date.now() - locationCache.ts < LOCATION_TTL) {
      friends = locationCache.data;
    } else {
      friends = await fetchFriends(creds);
      locationCache = { data: friends, ts: Date.now() };
    }

    // Fetch avatars in parallel
    const avatarEntries = await Promise.all(
      friends.map(async f => {
        const dataUrl = await fetchAvatar(f.handle, creds);
        return [f.handle, dataUrl] as const;
      })
    );

    const avatars: Record<string, string> = {};
    for (const [handle, dataUrl] of avatarEntries) {
      if (dataUrl) avatars[handle] = dataUrl;
    }

    return NextResponse.json({ friends, avatars });
  } catch (err) {
    console.error('[FindMy API] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch Find My data' },
      { status: 500 }
    );
  }
}
