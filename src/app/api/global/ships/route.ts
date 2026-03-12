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

    // Fallback: known major shipping lanes with simulated traffic
    if (vessels.length === 0) {
      const majorRoutes = [
        // Strait of Malacca
        { lat: 1.3, lng: 103.8, name: 'EVER GIVEN', type: 'cargo', heading: 315, sog: 12 },
        { lat: 1.5, lng: 104.0, name: 'MSC OSCAR', type: 'cargo', heading: 135, sog: 14 },
        { lat: 1.1, lng: 103.5, name: 'MAERSK MAJESTIC', type: 'cargo', heading: 300, sog: 11 },
        // Suez Canal approach
        { lat: 30.0, lng: 32.4, name: 'COSCO SHIPPING', type: 'cargo', heading: 170, sog: 8 },
        { lat: 29.9, lng: 32.6, name: 'NS CHAMPION', type: 'tanker', heading: 350, sog: 6 },
        // Panama Canal approach
        { lat: 9.0, lng: -79.5, name: 'ONE INNOVATION', type: 'cargo', heading: 280, sog: 10 },
        { lat: 8.9, lng: -79.3, name: 'TORM HELLAS', type: 'tanker', heading: 100, sog: 9 },
        // English Channel
        { lat: 50.8, lng: -1.3, name: 'QUEEN MARY 2', type: 'passenger', heading: 250, sog: 22 },
        { lat: 51.0, lng: 1.5, name: 'SPIRIT OF DISCOVERY', type: 'passenger', heading: 70, sog: 16 },
        // Strait of Hormuz
        { lat: 26.5, lng: 56.2, name: 'FRONT ALTA', type: 'tanker', heading: 130, sog: 12 },
        { lat: 26.6, lng: 56.5, name: 'EAGLE PETROL', type: 'tanker', heading: 310, sog: 11 },
        // US East Coast
        { lat: 40.5, lng: -73.8, name: 'APL EAGLE', type: 'cargo', heading: 190, sog: 15 },
        { lat: 37.0, lng: -76.0, name: 'USS GERALD FORD', type: 'military_vessel', heading: 180, sog: 25 },
        // South China Sea
        { lat: 14.5, lng: 114.5, name: 'PACIFIC VENTURE', type: 'cargo', heading: 200, sog: 13 },
        { lat: 10.0, lng: 109.0, name: 'JADE GAS', type: 'tanker', heading: 45, sog: 10 },
        // Mediterranean
        { lat: 36.0, lng: 14.5, name: 'MSC BELLISSIMA', type: 'passenger', heading: 90, sog: 18 },
        { lat: 35.5, lng: 23.5, name: 'NISSOS SAMOS', type: 'passenger', heading: 270, sog: 14 },
        // Cape of Good Hope
        { lat: -34.5, lng: 18.5, name: 'CAPE TOWN EXPRESS', type: 'cargo', heading: 80, sog: 16 },
        // Baltic Sea
        { lat: 59.5, lng: 24.5, name: 'VIKING GRACE', type: 'passenger', heading: 200, sog: 20 },
        // Yellow Sea
        { lat: 35.5, lng: 125.5, name: 'HMM ALGECIRAS', type: 'cargo', heading: 180, sog: 17 },
      ];

      // Add slight random variation to simulate live data
      const now = Date.now();
      for (let i = 0; i < majorRoutes.length; i++) {
        const r = majorRoutes[i];
        const drift = Math.sin(now / 60000 + i) * 0.1;
        vessels.push({
          mmsi: 200000000 + i * 1000,
          name: r.name,
          type: r.type,
          lat: r.lat + drift,
          lng: r.lng + drift * 0.5,
          heading: r.heading,
          sog: r.sog,
          country: 'Various',
        });
      }
    }

    const isSimulated = vessels.length > 0 && vessels[0].country === 'Various';
    cache = { data: vessels, ts: Date.now() };
    return NextResponse.json({ vessels, total: vessels.length, simulated: isSimulated });
  } catch {
    return NextResponse.json({ vessels: [], total: 0 });
  }
}
