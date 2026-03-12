import { NextResponse } from 'next/server';

// KiwiSDR public receiver list - scrape kiwisdr.com
let cache: { data: any; ts: number } | null = null;
const TTL = 600_000; // 10 minutes

function parseComment(html: string, field: string): string {
  const m = html.match(new RegExp(`<!--\\s*${field}=(.*?)\\s*-->`));
  return m ? m[1].trim() : '';
}

function parseGPS(html: string): { lat: number; lng: number } | null {
  const m = html.match(/<!--\s*gps=\(([^,]+),\s*([^)]+)\)\s*-->/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch('https://kiwisdr.com/.public/', {
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'CommandCenter/1.0' },
    });

    if (!res.ok) {
      if (cache) return NextResponse.json(cache.data);
      return NextResponse.json({ nodes: [], total: 0 }, { status: 502 });
    }

    const html = await res.text();
    const entries = html.match(/<div class='cl-entry[^']*'>[\s\S]*?<\/div>\s*<\/div>/g) || [];

    const nodes: any[] = [];
    for (const entry of entries) {
      const gps = parseGPS(entry);
      if (!gps) continue;

      const offline = parseComment(entry, 'offline');
      if (offline === 'yes') continue;

      const name = parseComment(entry, 'name') || 'Unknown SDR';
      const users = parseInt(parseComment(entry, 'users')) || 0;
      const usersMax = parseInt(parseComment(entry, 'users_max')) || 0;
      const bands = parseComment(entry, 'bands');
      const antenna = parseComment(entry, 'antenna').slice(0, 200);
      const location = parseComment(entry, 'loc').slice(0, 100);

      const urlMatch = entry.match(/href='(https?:\/\/[^']+)'/);
      const url = urlMatch ? urlMatch[1] : '';

      nodes.push({
        name: name.slice(0, 120),
        lat: gps.lat,
        lng: gps.lng,
        url,
        users,
        usersMax,
        bands,
        antenna,
        location,
      });
    }

    const result = { nodes, total: nodes.length };
    cache = { data: result, ts: now };
    return NextResponse.json(result);
  } catch {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ nodes: [], total: 0 }, { status: 502 });
  }
}
