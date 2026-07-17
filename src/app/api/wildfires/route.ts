import { NextRequest, NextResponse } from 'next/server';

// NASA FIRMS active fire detections via the public keyless 24h CSV exports.
// The map-key API was dropped after the bundled key expired ("Invalid
// MAP_KEY"); these public files carry the same VIIRS columns.

export interface WildfireData {
  lat: number;
  lon: number;
  brightness: number;
  confidence: string;
  acqDate: string;
  acqTime: string;
  frp: number;
}

const US_SOURCES = [
  'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv',
  'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv',
  'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Alaska_24h.csv',
];

const WORLD_SOURCES = [
  'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv',
];

function parseCSV(csv: string): WildfireData[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const latIdx = headers.indexOf('latitude');
  const lonIdx = headers.indexOf('longitude');
  const brightIdx = headers.indexOf('bright_ti4');
  const confIdx = headers.indexOf('confidence');
  const dateIdx = headers.indexOf('acq_date');
  const timeIdx = headers.indexOf('acq_time');
  const frpIdx = headers.indexOf('frp');

  if (latIdx === -1 || lonIdx === -1) return [];

  const results: WildfireData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < Math.max(latIdx, lonIdx) + 1) continue;

    const lat = parseFloat(cols[latIdx]);
    const lon = parseFloat(cols[lonIdx]);
    if (isNaN(lat) || isNaN(lon)) continue;

    results.push({
      lat,
      lon,
      brightness: brightIdx !== -1 ? parseFloat(cols[brightIdx]) || 300 : 300,
      confidence: confIdx !== -1 ? cols[confIdx] : 'nominal',
      acqDate: dateIdx !== -1 ? cols[dateIdx] : '',
      acqTime: timeIdx !== -1 ? cols[timeIdx] : '',
      frp: frpIdx !== -1 ? parseFloat(cols[frpIdx]) || 0 : 0,
    });
  }

  return results;
}

let cache: { key: string; data: WildfireData[]; ts: number } | null = null;
const TTL = 10 * 60_000;

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get('region') === 'world' ? 'world' : 'us';

  if (cache && cache.key === region && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const sources = region === 'world' ? WORLD_SOURCES : US_SOURCES;
    const results = await Promise.allSettled(
      sources.map(url =>
        fetch(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' }).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        }),
      ),
    );

    const fires: WildfireData[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const f of parseCSV(r.value)) {
        const key = `${f.lat.toFixed(3)},${f.lon.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        fires.push(f);
      }
    }

    if (fires.length === 0 && results.every(r => r.status === 'rejected')) {
      // All sources down: serve stale if any, else a real error
      if (cache?.key === region) return NextResponse.json(cache.data);
      return NextResponse.json({ error: 'FIRMS sources unavailable' }, { status: 502 });
    }

    cache = { key: region, data: fires, ts: Date.now() };
    return NextResponse.json(fires);
  } catch (err) {
    console.error('Wildfire API error:', err);
    if (cache?.key === region) return NextResponse.json(cache.data);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
