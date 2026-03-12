import { NextResponse } from 'next/server';

// NASA FIRMS VIIRS active fire data - free, open CSV
// Using the open fire map CSV endpoint (last 24h, global)
const FIRMS_URL = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv';
// Fallback: MODIS
const FIRMS_MODIS_URL = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv';

let cache: { data: any; ts: number } | null = null;
const TTL = 300_000; // 5 minutes

function parseCSV(text: string, limit = 10000): any[] {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const latIdx = headers.indexOf('latitude');
  const lonIdx = headers.indexOf('longitude');
  const frpIdx = headers.indexOf('frp');
  const confIdx = headers.indexOf('confidence');
  const dateIdx = headers.indexOf('acq_date');
  const timeIdx = headers.indexOf('acq_time');
  const brightIdx = headers.indexOf('bright_ti4') >= 0 ? headers.indexOf('bright_ti4') : headers.indexOf('brightness');

  if (latIdx < 0 || lonIdx < 0) return [];

  const fires: any[] = [];
  // Skip low-confidence and sample for performance
  for (let i = 1; i < lines.length && fires.length < limit; i++) {
    const cols = lines[i].split(',');
    if (cols.length < headers.length) continue;

    const conf = cols[confIdx]?.trim();
    // Skip low confidence for VIIRS (values: low, nominal, high)
    if (conf === 'low' || conf === 'l') continue;

    const lat = parseFloat(cols[latIdx]);
    const lon = parseFloat(cols[lonIdx]);
    if (isNaN(lat) || isNaN(lon)) continue;

    fires.push({
      lat,
      lng: lon,
      frp: parseFloat(cols[frpIdx]) || 0,
      confidence: conf || 'nominal',
      brightness: brightIdx >= 0 ? parseFloat(cols[brightIdx]) || 0 : 0,
      date: cols[dateIdx]?.trim() || '',
      time: cols[timeIdx]?.trim() || '',
    });
  }
  return fires;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(FIRMS_URL, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`FIRMS ${res.status}`);
    const text = await res.text();
    const fires = parseCSV(text, 10000);

    cache = { data: fires, ts: now };
    return NextResponse.json(fires);
  } catch {
    // Fallback to MODIS
    try {
      const res = await fetch(FIRMS_MODIS_URL, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`FIRMS MODIS ${res.status}`);
      const text = await res.text();
      const fires = parseCSV(text, 10000);
      cache = { data: fires, ts: now };
      return NextResponse.json(fires);
    } catch {
      if (cache) return NextResponse.json(cache.data);
      return NextResponse.json([], { status: 502 });
    }
  }
}
