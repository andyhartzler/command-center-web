import { NextResponse } from 'next/server';

let cache: { data: any[]; ts: number } | null = null;
const TTL = 300_000; // 5 min

// LiveUAMap regions
const REGIONS = [
  { name: 'Ukraine', url: 'https://liveuamap.com' },
  { name: 'Middle East', url: 'https://mideast.liveuamap.com' },
  { name: 'Israel-Palestine', url: 'https://israelpalestine.liveuamap.com' },
  { name: 'Syria', url: 'https://syria.liveuamap.com' },
];

async function fetchRegion(region: { name: string; url: string }): Promise<any[]> {
  try {
    const res = await fetch(region.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const markers: any[] = [];

    // Try to extract the 'ovens' variable from HTML (may be embedded directly)
    const ovensMatch = html.match(/var\s+ovens\s*=\s*(\[[\s\S]*?\]);/);
    if (ovensMatch) {
      try {
        // Try base64-encoded format first
        let jsonStr = ovensMatch[1].trim();
        if (jsonStr.startsWith('"') || jsonStr.startsWith("'")) {
          jsonStr = jsonStr.slice(1, -1);
          // URL decode then base64 decode
          const decoded = Buffer.from(decodeURIComponent(jsonStr), 'base64').toString('utf8');
          const data = JSON.parse(decoded);
          if (Array.isArray(data)) {
            for (const m of data) {
              if (m.lat && m.lng) {
                markers.push({
                  id: m.id || `${region.name}-${m.lat}-${m.lng}`,
                  title: m.s || m.title || 'Unknown Event',
                  lat: parseFloat(m.lat),
                  lng: parseFloat(m.lng),
                  timestamp: m.time || '',
                  region: region.name,
                  link: m.link || region.url,
                });
              }
            }
          }
        } else {
          // Try direct JSON parse
          const data = JSON.parse(jsonStr);
          if (Array.isArray(data)) {
            for (const m of data) {
              if (m.lat && m.lng) {
                markers.push({
                  id: m.id || `${region.name}-${m.lat}-${m.lng}`,
                  title: m.s || m.title || 'Unknown Event',
                  lat: parseFloat(m.lat),
                  lng: parseFloat(m.lng),
                  timestamp: m.time || '',
                  region: region.name,
                  link: m.link || region.url,
                });
              }
            }
          }
        }
      } catch { /* JSON parse failed */ }
    }

    // Alternative: Try to find events in script tags with coordinates
    if (markers.length === 0) {
      const coordPattern = /{"id":\d+[^}]*"lat":"?(-?\d+\.?\d*)"?[^}]*"lng":"?(-?\d+\.?\d*)"?[^}]*"s":"([^"]*)"[^}]*}/g;
      let match;
      while ((match = coordPattern.exec(html)) !== null) {
        markers.push({
          id: `${region.name}-${match[1]}-${match[2]}`,
          title: match[3] || 'Event',
          lat: parseFloat(match[1]),
          lng: parseFloat(match[2]),
          region: region.name,
          link: region.url,
        });
      }
    }

    return markers;
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < TTL) {
      return NextResponse.json({ events: cache.data, cached: true });
    }

    const results = await Promise.allSettled(REGIONS.map(r => fetchRegion(r)));
    const events: any[] = [];
    const seenIds = new Set<string>();

    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const e of r.value) {
          if (!seenIds.has(e.id)) {
            seenIds.add(e.id);
            events.push(e);
          }
        }
      }
    }

    cache = { data: events, ts: Date.now() };
    return NextResponse.json({ events, total: events.length });
  } catch {
    return NextResponse.json({ events: [], total: 0 });
  }
}
