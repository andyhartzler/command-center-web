import { NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';

interface ChartSong {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  artwork: string;
  url: string;
  durationMs: number;
  genreNames: string[];
}

// Cache the developer token (valid up to 6 months)
let cachedToken: { jwt: string; exp: number } | null = null;

async function getMusicToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 300_000) {
    return cachedToken.jwt;
  }

  const keyId = process.env.WEATHERKIT_KEY_ID; // Same key has MusicKit
  const teamId = process.env.WEATHERKIT_TEAM_ID;
  const privateKeyPem = process.env.WEATHERKIT_PRIVATE_KEY;

  if (!keyId || !teamId || !privateKeyPem) {
    throw new Error('Apple developer key env vars not configured');
  }

  const privateKey = await importPKCS8(privateKeyPem, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 15777000; // ~6 months (Apple max)

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(privateKey);

  cachedToken = { jwt, exp: exp * 1000 };
  return jwt;
}

// Cache chart results for 15 minutes
let chartCache: { data: ChartSong[]; ts: number } | null = null;
const CHART_CACHE_TTL = 15 * 60 * 1000;

export async function GET() {
  try {
    if (chartCache && Date.now() - chartCache.ts < CHART_CACHE_TTL) {
      return NextResponse.json({ songs: chartCache.data, cached: true });
    }

    const token = await getMusicToken();

    const res = await fetch(
      'https://api.music.apple.com/v1/catalog/us/charts?types=songs&limit=25',
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`[apple-music] API ${res.status}: ${text}`);
      // Return stale cache on error
      if (chartCache) {
        return NextResponse.json({ songs: chartCache.data, cached: true, stale: true });
      }
      return NextResponse.json({ error: `Apple Music API returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const chartData = data?.results?.songs?.[0]?.data || [];

    const songs: ChartSong[] = chartData.map((song: {
      id: string;
      attributes: {
        name: string;
        artistName: string;
        albumName: string;
        artwork: { url: string };
        url: string;
        durationInMillis: number;
        genreNames: string[];
      };
    }) => ({
      id: song.id,
      name: song.attributes.name,
      artistName: song.attributes.artistName,
      albumName: song.attributes.albumName,
      artwork: song.attributes.artwork.url
        .replace('{w}', '200')
        .replace('{h}', '200'),
      url: song.attributes.url,
      durationMs: song.attributes.durationInMillis,
      genreNames: song.attributes.genreNames || [],
    }));

    chartCache = { data: songs, ts: Date.now() };
    return NextResponse.json({ songs });
  } catch (err) {
    console.error('[apple-music] error:', err);
    if (chartCache) {
      return NextResponse.json({ songs: chartCache.data, cached: true, stale: true });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch charts' },
      { status: 500 }
    );
  }
}
