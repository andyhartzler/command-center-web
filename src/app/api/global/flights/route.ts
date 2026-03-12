import { NextResponse } from 'next/server';

// adsb.lol - free global ADS-B data, no auth
const ADSB_MIL_URL = 'https://api.adsb.lol/v2/mil';
// LADD (Limited Aircraft Data Displayed) for notable aircraft
const ADSB_LADD_URL = 'https://api.adsb.lol/v2/ladd';
// Use PIA (Privacy ICAO Address) for interesting blocked flights
const ADSB_PIA_URL = 'https://api.adsb.lol/v2/pia';
// Regional sampling via point queries for major air traffic regions
const REGIONS = [
  { name: 'N.America', url: 'https://api.adsb.lol/v2/point/40/-95/500' },
  { name: 'Europe', url: 'https://api.adsb.lol/v2/point/50/10/500' },
  { name: 'E.Asia', url: 'https://api.adsb.lol/v2/point/35/120/500' },
  { name: 'MidEast', url: 'https://api.adsb.lol/v2/point/28/45/400' },
  { name: 'S.Asia', url: 'https://api.adsb.lol/v2/point/20/78/400' },
  { name: 'S.America', url: 'https://api.adsb.lol/v2/point/-15/-55/500' },
  { name: 'Africa', url: 'https://api.adsb.lol/v2/point/5/20/500' },
  { name: 'Oceania', url: 'https://api.adsb.lol/v2/point/-25/135/500' },
];

let flightCache: { data: any; ts: number } | null = null;
const TTL = 55_000; // ~1 minute

function classifyFlight(ac: any): 'commercial' | 'military' | 'private' | null {
  if (!ac.lat || !ac.lon) return null;
  const flight = (ac.flight || '').trim();
  const dbFlags = (ac.dbFlags || 0);

  if (dbFlags & 1) return 'military';
  if (flight.match(/^[A-Z]{3}\d/)) return 'commercial';
  return 'private';
}

function toItem(ac: any) {
  return {
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
}

async function fetchJson(url: string, timeout = 12000): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(timeout),
    });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export async function GET() {
  const now = Date.now();
  if (flightCache && now - flightCache.ts < TTL) {
    return NextResponse.json(flightCache.data);
  }

  const seenHex = new Set<string>();
  const military: any[] = [];
  const commercial: any[] = [];
  const privateFl: any[] = [];

  // Fetch military first (always needed, relatively small ~2-5k)
  const milData = await fetchJson(ADSB_MIL_URL, 15000);
  if (milData?.ac) {
    for (const ac of milData.ac) {
      if (!ac.lat || !ac.lon) continue;
      const hex = (ac.hex || '').toLowerCase();
      if (seenHex.has(hex)) continue;
      seenHex.add(hex);
      military.push({
        ...toItem(ac),
        country: ac.cou || '',
        category: 'military',
      });
    }
  }

  // Fetch regions in parallel for commercial + private coverage
  const regionResults = await Promise.allSettled(
    REGIONS.map(r => fetchJson(r.url, 12000))
  );

  for (const result of regionResults) {
    if (result.status !== 'fulfilled' || !result.value?.ac) continue;
    for (const ac of result.value.ac) {
      if (!ac.lat || !ac.lon) continue;
      const hex = (ac.hex || '').toLowerCase();
      if (seenHex.has(hex)) continue;
      seenHex.add(hex);

      const cls = classifyFlight(ac);
      if (cls === 'commercial') commercial.push(toItem(ac));
      else if (cls === 'private') privateFl.push(toItem(ac));
      else if (cls === 'military') {
        military.push({ ...toItem(ac), country: ac.cou || '', category: 'military' });
      }
    }
  }

  const result = {
    commercial: commercial.slice(0, 10000),
    military,
    private: privateFl.slice(0, 5000),
    total: commercial.length + military.length + privateFl.length,
  };

  flightCache = { data: result, ts: now };
  return NextResponse.json(result);
}
