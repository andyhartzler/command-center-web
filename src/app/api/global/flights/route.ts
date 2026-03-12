import { NextResponse } from 'next/server';

// adsb.lol - free global ADS-B data, no auth
const ADSB_URL = 'https://api.adsb.lol/v2/ladd';
const ADSB_MIL_URL = 'https://api.adsb.lol/v2/mil';
const ADSB_ALL_URL = 'https://api.adsb.lol/v2/all';

// Known military ICAO hex prefixes by country
const MIL_PREFIXES: Record<string, string> = {
  'AE': 'United States', 'AD': 'United States', '43C': 'United Kingdom',
  '3A': 'France', '3E': 'Germany', '300': 'Italy',
  '501': 'Israel', '738': 'Japan', '710': 'South Korea',
  'C0': 'Canada', '7C': 'Australia',
};

let flightCache: { data: any; ts: number } | null = null;
const TTL = 45_000; // 45 seconds

function classifyFlight(ac: any): 'commercial' | 'military' | 'private' | null {
  if (!ac.lat || !ac.lon) return null;
  const hex = (ac.hex || '').toUpperCase();
  const flight = (ac.flight || '').trim();
  const dbFlags = (ac.dbFlags || 0);
  const category = (ac.category || '').toUpperCase();

  // Military flag from adsb.lol
  if (dbFlags & 1) return 'military';
  // Military ICAO range
  for (const prefix of Object.keys(MIL_PREFIXES)) {
    if (hex.startsWith(prefix) && hex.length === 6) return 'military';
  }
  // Category A7 = rotorcraft (often military/police)
  if (category === 'A7' && !flight.match(/^[A-Z]{3}\d/)) return 'military';

  // Commercial: has airline-style callsign (3 letter + digits)
  if (flight.match(/^[A-Z]{3}\d/)) return 'commercial';

  // Everything else is private/general aviation
  return 'private';
}

export async function GET() {
  const now = Date.now();
  if (flightCache && now - flightCache.ts < TTL) {
    return NextResponse.json(flightCache.data);
  }

  try {
    // Fetch military endpoint (smaller, faster)
    const milRes = await fetch(ADSB_MIL_URL, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    const milData = milRes.ok ? await milRes.json() : { ac: [] };

    const milHexes = new Set<string>();
    const military: any[] = [];
    const commercial: any[] = [];
    const privateFl: any[] = [];

    for (const ac of (milData.ac || [])) {
      if (!ac.lat || !ac.lon) continue;
      milHexes.add((ac.hex || '').toLowerCase());
      military.push({
        icao24: ac.hex,
        callsign: (ac.flight || '').trim(),
        lat: ac.lat,
        lng: ac.lon,
        alt: ac.alt_baro || ac.alt_geom || 0,
        speed: ac.gs || 0,
        heading: ac.track || 0,
        model: ac.t || '',
        registration: ac.r || '',
        country: ac.cou || '',
        squawk: ac.squawk || '',
        category: 'military',
        seen: ac.seen || 0,
      });
    }

    // Fetch from adsb.lol v2/all for global aircraft coverage
    try {
      const allRes = await fetch('https://api.adsb.lol/v2/all', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(25000),
      });
      if (allRes.ok) {
        const allData = await allRes.json();
        const allAc = allData.ac || [];
        // Sample if too many aircraft (>20k)
        const step = allAc.length > 20000 ? Math.ceil(allAc.length / 20000) : 1;
        for (let i = 0; i < allAc.length; i += step) {
          const ac = allAc[i];
          if (!ac.lat || !ac.lon) continue;
          const hex = (ac.hex || '').toLowerCase();
          if (milHexes.has(hex)) continue;

          const cls = classifyFlight(ac);
          if (!cls) continue;

          const item = {
            icao24: ac.hex,
            callsign: (ac.flight || '').trim(),
            lat: ac.lat,
            lng: ac.lon,
            alt: ac.alt_baro || ac.alt_geom || 0,
            speed: ac.gs || 0,
            heading: ac.track || 0,
            model: ac.t || '',
            registration: ac.r || '',
            squawk: ac.squawk || '',
            seen: ac.seen || 0,
          };

          if (cls === 'commercial') commercial.push(item);
          else if (cls === 'private') privateFl.push(item);
          else if (cls === 'military' && !milHexes.has(hex)) {
            milHexes.add(hex);
            military.push({ ...item, country: ac.cou || '', category: 'military' });
          }
        }
      }
    } catch { /* fallback: just military data */ }

    const result = {
      commercial: commercial.slice(0, 8000),
      military,
      private: privateFl.slice(0, 5000),
      total: commercial.length + military.length + privateFl.length,
    };

    flightCache = { data: result, ts: now };
    return NextResponse.json(result);
  } catch (e: any) {
    if (flightCache) return NextResponse.json(flightCache.data);
    return NextResponse.json({ commercial: [], military: [], private: [], total: 0 }, { status: 502 });
  }
}
