import { NextRequest, NextResponse } from 'next/server';

// iCloud Shared Album proxy.
// Asset URLs are signed and expire after a while, and the webstream endpoint
// lives on a per-album partition host, so we cache the resolved URL list per
// token server-side and let every wall client share one upstream fetch.

const CACHE_TTL = 15 * 60 * 1000;
const MAX_PHOTOS = 40;

interface CacheEntry {
  ts: number;
  urls: string[];
}

const albumCache = new Map<string, CacheEntry>();

const BASE_62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function base62ToInt(s: string): number {
  let n = 0;
  for (const ch of s) n = n * 62 + BASE_62.indexOf(ch);
  return n;
}

// The shared-album partition host is encoded in the token itself.
function partitionHost(token: string): string {
  const t = token.split(';')[0];
  const partition = t[0] === 'A' ? base62ToInt(t[1]) : base62ToInt(t.substring(1, 3));
  return `p${partition < 10 ? `0${partition}` : partition}-sharedstreams.icloud.com`;
}

interface Derivative {
  checksum?: string;
  fileSize?: string;
  width?: string;
}

interface StreamPhoto {
  photoGuid?: string;
  mediaAssetType?: string;
  derivatives?: Record<string, Derivative>;
}

async function postStream(host: string, token: string, path: string, body: string) {
  return fetch(`https://${host}/${token}/sharedstreams/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
  });
}

// The webstream endpoint answers 330 with the real host when the guessed
// partition is wrong; follow that hop once.
async function postStreamFollowing(host: string, token: string, path: string, body: string) {
  let res = await postStream(host, token, path, body);
  if (res.status === 330) {
    const redirect = (await res.json()) as { 'X-Apple-MMe-Host'?: string };
    const nextHost = redirect['X-Apple-MMe-Host'];
    if (!nextHost) throw new Error('iCloud redirect without host');
    res = await postStream(nextHost, token, path, body);
  }
  return res;
}

async function fetchAlbumUrls(token: string): Promise<string[]> {
  const host = partitionHost(token);

  const webstreamRes = await postStreamFollowing(host, token, 'webstream', '{"streamCtag":null}');
  if (!webstreamRes.ok) throw new Error(`webstream HTTP ${webstreamRes.status}`);
  const streamData = (await webstreamRes.json()) as { photos?: StreamPhoto[] };

  // Photo frame: still photos only, newest slice for performance.
  const photos = (streamData.photos ?? [])
    .filter(p => p.photoGuid && p.mediaAssetType !== 'video')
    .slice(0, MAX_PHOTOS);
  if (photos.length === 0) return [];

  // Pick the largest derivative per photo so we request one asset URL each
  // instead of every thumbnail size.
  const checksums: string[] = [];
  for (const photo of photos) {
    let best: Derivative | null = null;
    let bestScore = -1;
    for (const d of Object.values(photo.derivatives ?? {})) {
      const score = Number(d.width ?? 0) || Number(d.fileSize ?? 0);
      if (d.checksum && score > bestScore) {
        best = d;
        bestScore = score;
      }
    }
    if (best?.checksum) checksums.push(best.checksum);
  }

  const guids = photos.map(p => p.photoGuid);
  const assetRes = await postStreamFollowing(
    host,
    token,
    'webasseturls',
    JSON.stringify({ photoGuids: guids }),
  );
  if (!assetRes.ok) throw new Error(`webasseturls HTTP ${assetRes.status}`);
  const assetData = (await assetRes.json()) as {
    items?: Record<string, { url_location?: string; url_path?: string }>;
  };
  const items = assetData.items ?? {};

  const urls: string[] = [];
  for (const checksum of checksums) {
    const item = items[checksum];
    if (item?.url_location && item.url_path) {
      urls.push(`https://${item.url_location}${item.url_path}`);
    }
  }
  return urls;
}

async function handle(token: string | null) {
  if (!token) {
    return NextResponse.json({ error: 'Missing iCloud token' }, { status: 400 });
  }

  const cached = albumCache.get(token);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ urls: cached.urls, cached: true });
  }

  try {
    const urls = await fetchAlbumUrls(token);
    albumCache.set(token, { ts: Date.now(), urls });
    return NextResponse.json({ urls });
  } catch (error) {
    console.error('icloud-album fetch failed:', error);
    // Serve the expired list rather than nothing; signed URLs often outlive
    // the cache window and the wall should never go blank on a blip.
    if (cached) {
      return NextResponse.json({ urls: cached.urls, cached: true, stale: true });
    }
    return NextResponse.json({ error: 'Failed to fetch iCloud album' }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request.nextUrl.searchParams.get('token'));
}

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token?: string };
    return handle(token ?? null);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
