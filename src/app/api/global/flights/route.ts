import { NextResponse } from 'next/server';

// adsb.lol - free global ADS-B data, no auth
const ADSB_MIL_URL = 'https://api.adsb.lol/v2/mil';
const ADSB_LADD_URL = 'https://api.adsb.lol/v2/ladd';
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

// POTUS Fleet ICAO hex overrides (from Shadowbroker data_fetcher.py)
const POTUS_HEX: Record<string, string> = {
  'ae4a54': 'AF1 (VC-25A)', 'ae4a55': 'AF1 (VC-25A)',
  'ae222c': 'AF2 (C-32A)', 'ae2229': 'AF2 (C-32A)', 'ae222a': 'AF2 (C-32A)', 'ae222b': 'AF2 (C-32A)',
  'ae0441': 'Marine One', 'ae0442': 'Marine One', 'ae0443': 'Marine One', 'ae0444': 'Marine One',
  'ae01cb': 'E-4B Nightwatch', 'ae01cc': 'E-4B Nightwatch', 'ae01cd': 'E-4B Nightwatch', 'ae01ce': 'E-4B Nightwatch',
};

// Private jet ICAO type designators (from Shadowbroker data_fetcher.py)
const PRIVATE_JET_TYPES = new Set([
  'GLF6', 'GLF5', 'GLF4', 'GLEX', 'GL7T', 'GL5T', 'GA7T', 'G280', 'G150',
  'CL60', 'CL35', 'CL30', 'BD70', 'GL60', 'BALL',
  'C700', 'C750', 'C680', 'C68A', 'C56X', 'C560', 'C550', 'C525', 'C510',
  'FA8X', 'FA7X', 'FA50', 'F900', 'F2TH', 'ASTR',
  'LJ75', 'LJ70', 'LJ60', 'LJ45', 'LJ40', 'LJ35', 'LJ31',
  'E55P', 'E550', 'E545', 'E50P', 'E35L', 'E190',
  'HDJT', 'HA4T', 'H25B', 'H25A', 'H25C', 'HA4T',
  'PRM1', 'EA50', 'SF50', 'PC24',
  'B737', 'B738', 'A319', 'B752', 'B763', 'MD83',
  'GALX', 'BE40', 'P180', 'MU30',
]);

// Helicopter type codes
const HELI_TYPES = new Set([
  'R22', 'R44', 'R66', 'EC35', 'EC45', 'EC55', 'EC30', 'EC20',
  'S76', 'S92', 'S70', 'A139', 'A169', 'A189', 'B06', 'B212',
  'B407', 'B429', 'B412', 'B505', 'BK17', 'EC75',
  'UH60', 'AH64', 'CH47', 'V22', 'MH60', 'UH1',
]);

let flightCache: { data: any; ts: number } | null = null;
const TTL = 55_000;

// GPS jamming tracking from NACp values
const gpsJammingGrid: Record<string, { count: number; avgNacp: number }> = {};

function classifyFlight(ac: any): 'commercial' | 'military' | 'private' | 'tracked' | null {
  if (!ac.lat || !ac.lon) return null;
  const hex = (ac.hex || '').toLowerCase();
  const flight = (ac.flight || '').trim();
  const dbFlags = (ac.dbFlags || 0);
  const typeCode = (ac.t || '').toUpperCase();

  // POTUS fleet check
  if (POTUS_HEX[hex]) return 'tracked';

  // Military
  if (dbFlags & 1) return 'military';

  // Private jet by type code
  if (PRIVATE_JET_TYPES.has(typeCode)) return 'private';

  // Helicopter
  if (HELI_TYPES.has(typeCode)) return 'private';

  // Commercial pattern: 3-letter ICAO code + digits
  if (flight.match(/^[A-Z]{3}\d/)) return 'commercial';

  return 'private';
}

function toItem(ac: any) {
  const hex = (ac.hex || '').toLowerCase();
  const potusLabel = POTUS_HEX[hex];

  return {
    icao24: ac.hex,
    callsign: potusLabel || (ac.flight || '').trim(),
    lat: ac.lat,
    lng: ac.lon,
    alt: ac.alt_baro || ac.alt_geom || 0,
    speed: ac.gs || 0,
    heading: ac.track || 0,
    model: ac.t || '',
    registration: ac.r || '',
    squawk: ac.squawk || '',
    seen: ac.seen || 0,
    nacp: ac.nac_p ?? null,
    isPotus: !!potusLabel,
    isJet: PRIVATE_JET_TYPES.has((ac.t || '').toUpperCase()),
  };
}

function updateGPSJamming(ac: any) {
  const nacp = ac.nac_p;
  if (nacp == null || nacp >= 8) return; // Normal NACp is 8-11, low values indicate jamming
  if (!ac.lat || !ac.lon) return;

  // Grid to 1° × 1° squares
  const gridKey = `${Math.floor(ac.lat)}_${Math.floor(ac.lon)}`;
  if (!gpsJammingGrid[gridKey]) {
    gpsJammingGrid[gridKey] = { count: 0, avgNacp: 0 };
  }
  const g = gpsJammingGrid[gridKey];
  g.avgNacp = (g.avgNacp * g.count + nacp) / (g.count + 1);
  g.count++;
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
  const tracked: any[] = [];

  // Reset jamming grid each fetch
  for (const key of Object.keys(gpsJammingGrid)) {
    delete gpsJammingGrid[key];
  }

  // Fetch military + LADD + PIA in parallel
  const [milData, laddData, piaData] = await Promise.all([
    fetchJson(ADSB_MIL_URL, 15000),
    fetchJson(ADSB_LADD_URL, 10000),
    fetchJson(ADSB_PIA_URL, 10000),
  ]);

  // Process military
  if (milData?.ac) {
    for (const ac of milData.ac) {
      if (!ac.lat || !ac.lon) continue;
      const hex = (ac.hex || '').toLowerCase();
      if (seenHex.has(hex)) continue;
      seenHex.add(hex);
      updateGPSJamming(ac);

      if (POTUS_HEX[hex]) {
        tracked.push({ ...toItem(ac), country: ac.cou || '', category: 'potus' });
      } else {
        military.push({ ...toItem(ac), country: ac.cou || '', category: 'military' });
      }
    }
  }

  // Process LADD (interesting blocked flights)
  if (laddData?.ac) {
    for (const ac of laddData.ac) {
      if (!ac.lat || !ac.lon) continue;
      const hex = (ac.hex || '').toLowerCase();
      if (seenHex.has(hex)) continue;
      seenHex.add(hex);
      tracked.push({ ...toItem(ac), category: 'ladd' });
    }
  }

  // Process PIA (Privacy ICAO Address)
  if (piaData?.ac) {
    for (const ac of piaData.ac) {
      if (!ac.lat || !ac.lon) continue;
      const hex = (ac.hex || '').toLowerCase();
      if (seenHex.has(hex)) continue;
      seenHex.add(hex);
      tracked.push({ ...toItem(ac), category: 'pia' });
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
      updateGPSJamming(ac);

      const cls = classifyFlight(ac);
      if (cls === 'commercial') commercial.push(toItem(ac));
      else if (cls === 'private') privateFl.push(toItem(ac));
      else if (cls === 'tracked') tracked.push({ ...toItem(ac), category: 'tracked' });
      else if (cls === 'military') {
        military.push({ ...toItem(ac), country: ac.cou || '', category: 'military' });
      }
    }
  }

  // Build GPS jamming zones (only report grid squares with 3+ affected aircraft)
  const jammingZones = Object.entries(gpsJammingGrid)
    .filter(([_, v]) => v.count >= 3 && v.avgNacp < 6)
    .map(([key, v]) => {
      const [lat, lng] = key.split('_').map(Number);
      return {
        lat: lat + 0.5,
        lng: lng + 0.5,
        count: v.count,
        avgNacp: Math.round(v.avgNacp * 10) / 10,
        severity: v.avgNacp < 2 ? 'severe' : v.avgNacp < 4 ? 'moderate' : 'mild',
      };
    });

  const result = {
    commercial: commercial.slice(0, 10000),
    military,
    private: privateFl.slice(0, 5000),
    tracked,
    jammingZones,
    total: commercial.length + military.length + privateFl.length + tracked.length,
  };

  flightCache = { data: result, ts: now };
  return NextResponse.json(result);
}
