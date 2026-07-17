import { NextResponse } from 'next/server';

// AIS vessel type classification
function classifyVessel(aisType: number): string {
  if (aisType >= 80 && aisType <= 89) return 'tanker';
  if (aisType >= 70 && aisType <= 79) return 'cargo';
  if (aisType >= 60 && aisType <= 69) return 'passenger';
  if (aisType === 35) return 'military_vessel';
  if (aisType === 36 || aisType === 37) return 'yacht';
  return 'other';
}

// MMSI MID -> Country
const MID_COUNTRY: Record<number, string> = {
  211: 'Germany', 219: 'Denmark', 220: 'Denmark', 224: 'Spain', 225: 'Spain',
  226: 'France', 227: 'France', 228: 'France', 232: 'United Kingdom', 233: 'United Kingdom',
  234: 'United Kingdom', 235: 'United Kingdom', 244: 'Netherlands', 245: 'Netherlands',
  246: 'Netherlands', 247: 'Italy', 257: 'Norway', 258: 'Norway', 265: 'Sweden',
  266: 'Sweden', 271: 'Turkey', 273: 'Russia', 338: 'United States',
  366: 'United States', 367: 'United States', 368: 'United States', 369: 'United States',
  412: 'China', 413: 'China', 431: 'Japan', 440: 'South Korea', 477: 'Hong Kong',
  503: 'Australia', 538: 'Marshall Islands', 548: 'Philippines', 563: 'Singapore',
  351: 'Panama', 352: 'Panama', 353: 'Panama', 354: 'Panama', 355: 'Panama',
  356: 'Panama', 370: 'Panama', 371: 'Panama', 372: 'Panama',
  308: 'Bahamas', 309: 'Bahamas', 311: 'Bahamas',
  215: 'Malta', 229: 'Malta', 248: 'Malta', 249: 'Malta', 256: 'Malta',
  633: 'Liberia', 634: 'Liberia', 635: 'Liberia', 636: 'Liberia',
};

function getCountryFromMMSI(mmsi: number): string {
  const s = String(mmsi);
  if (s.length === 9) {
    const mid = parseInt(s.slice(0, 3), 10);
    return MID_COUNTRY[mid] || 'Unknown';
  }
  return 'Unknown';
}

let cache: { data: any[]; ts: number } | null = null;
const TTL = 300_000; // 5 min

export async function GET() {
  try {
    if (cache && Date.now() - cache.ts < TTL) {
      return NextResponse.json({ vessels: cache.data, cached: true });
    }

    // Try fetching from free AIS sources
    // Method 1: Danish Maritime Authority's free AIS feed (public, no key)
    const vessels: any[] = [];

    // Use aisstream.io REST API if key available
    // Note: stream.aisstream.io/v0/stream is a WebSocket endpoint, not REST.
    // Use the REST snapshot endpoint instead.
    const aisKey = process.env.AIS_API_KEY;
    if (aisKey) {
      try {
        const res = await fetch('https://api.aisstream.io/v0/ships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            APIKey: aisKey,
            BoundingBoxes: [[[-90, -180], [90, 180]]],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data?.data || [];
          for (const msg of items.slice(0, 500)) {
            const meta = msg.MetaData || msg;
            const report = msg.Message?.PositionReport || msg;
            const lat = report.Latitude ?? meta.lat;
            const lng = report.Longitude ?? meta.lng ?? meta.lon;
            if (lat && lng) {
              vessels.push({
                mmsi: meta.MMSI ?? meta.mmsi,
                name: (meta.ShipName || meta.name || 'UNKNOWN').trim(),
                type: classifyVessel(meta.ShipType ?? meta.ship_type ?? 0),
                lat,
                lng,
                heading: (report.TrueHeading !== 511 ? report.TrueHeading : report.Cog) ?? meta.heading ?? 0,
                sog: report.Sog ?? meta.sog ?? 0,
                country: getCountryFromMMSI(meta.MMSI ?? meta.mmsi ?? 0),
              });
            }
          }
        }
      } catch { /* AIS API not available */ }
    }

    // No fabricated fallback: without an AIS key the layer is honestly empty.
    // The old code invented 20 named vessels with sine-wave drift, which
    // violates the never-render-unmeasured-data rule.
    cache = { data: vessels, ts: Date.now() };
    return NextResponse.json({
      vessels,
      total: vessels.length,
      sourceAvailable: Boolean(aisKey),
    });
  } catch {
    return NextResponse.json({ vessels: [], total: 0 });
  }
}
