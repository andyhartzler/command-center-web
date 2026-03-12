import { NextResponse } from 'next/server';

const PRIMARY_URL = 'https://raw.githubusercontent.com/telegeography/www.datacentermap.com/master/data/datacenters.json';
const FALLBACK_URL = 'https://raw.githubusercontent.com/thereisnotime/GeoIP-DBs/main/data/datacenters.json';

let cache: { data: any; ts: number } | null = null;
const TTL = 3_600_000; // 1 hour

const MAX_ENTRIES = 2000;

interface DataCenter {
  name: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
}

function parseDatacenters(raw: any): DataCenter[] {
  const results: DataCenter[] = [];
  const entries = Array.isArray(raw) ? raw : Object.values(raw);

  for (const entry of entries) {
    if (results.length >= MAX_ENTRIES) break;

    const e = entry as any;
    const lat = parseFloat(e.latitude ?? e.lat ?? e.Latitude ?? '');
    const lng = parseFloat(e.longitude ?? e.lng ?? e.lon ?? e.Longitude ?? '');
    if (isNaN(lat) || isNaN(lng)) continue;

    results.push({
      name: e.name || e.Name || e.title || 'Unknown',
      lat,
      lng,
      city: e.city || e.City || '',
      country: e.country || e.Country || '',
    });
  }

  return results;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(PRIMARY_URL, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Primary ${res.status}`);
    const raw = await res.json();
    const datacenters = parseDatacenters(raw);

    cache = { data: datacenters, ts: now };
    return NextResponse.json(datacenters);
  } catch {
    // Fallback source
    try {
      const res = await fetch(FALLBACK_URL, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`Fallback ${res.status}`);
      const raw = await res.json();
      const datacenters = parseDatacenters(raw);

      cache = { data: datacenters, ts: now };
      return NextResponse.json(datacenters);
    } catch {
      if (cache) return NextResponse.json(cache.data);
      return NextResponse.json([]);
    }
  }
}
