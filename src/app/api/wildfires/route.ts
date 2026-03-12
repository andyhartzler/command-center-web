import { NextResponse } from 'next/server';

export interface WildfireData {
  lat: number;
  lon: number;
  brightness: number;
  confidence: string;
  acqDate: string;
  acqTime: string;
  frp: number;
}

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

export async function GET() {
  const apiKey = process.env.NASA_FIRMS_KEY || '5568f3e7dfe8e988f3b0e2c2741e6278';

  try {
    const res = await fetch(
      `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${apiKey}/VIIRS_SNPP_NRT/USA/1`,
      { next: { revalidate: 600 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch wildfire data' },
        { status: res.status }
      );
    }

    const csvText = await res.text();
    const fires = parseCSV(csvText);

    return NextResponse.json(fires);
  } catch (err) {
    console.error('Wildfire API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
