import { NextResponse } from 'next/server';

const IODA_BASE = 'https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/country';

let cache: { data: any; ts: number } | null = null;
const TTL = 300_000; // 5 minutes

// Country code -> approximate centroid lat/lng
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AF: [33.93, 67.71], AL: [41.15, 20.17], DZ: [28.03, 1.66], AO: [-11.20, 17.87],
  AR: [-38.42, -63.62], AM: [40.07, 45.04], AU: [-25.27, 133.78], AT: [47.52, 14.55],
  AZ: [40.14, 47.58], BD: [23.68, 90.36], BY: [53.71, 27.95], BE: [50.50, 4.47],
  BO: [-16.29, -63.59], BA: [43.92, 17.68], BR: [-14.24, -51.93], BG: [42.73, 25.49],
  KH: [12.57, 104.99], CM: [7.37, 12.35], CA: [56.13, -106.35], CL: [-35.68, -71.54],
  CN: [35.86, 104.20], CO: [4.57, -74.30], CD: [-4.04, 21.76], CR: [9.75, -83.75],
  HR: [45.10, 15.20], CU: [21.52, -77.78], CZ: [49.82, 15.47], DK: [56.26, 9.50],
  DO: [18.74, -70.16], EC: [-1.83, -78.18], EG: [26.82, 30.80], SV: [13.79, -88.90],
  ET: [9.15, 40.49], FI: [61.92, 25.75], FR: [46.23, 2.21], DE: [51.17, 10.45],
  GH: [7.95, -1.02], GR: [39.07, 21.82], GT: [15.78, -90.23], HN: [15.20, -86.24],
  HK: [22.40, 114.11], HU: [47.16, 19.50], IN: [20.59, 78.96], ID: [-0.79, 113.92],
  IR: [32.43, 53.69], IQ: [33.22, 43.68], IE: [53.41, -8.24], IL: [31.05, 34.85],
  IT: [41.87, 12.57], JP: [36.20, 138.25], JO: [30.59, 36.24], KZ: [48.02, 66.92],
  KE: [-0.02, 37.91], KW: [29.31, 47.48], KG: [41.20, 74.77], LB: [33.85, 35.86],
  LY: [26.34, 17.23], LT: [55.17, 23.88], MY: [4.21, 101.98], MX: [23.63, -102.55],
  MA: [31.79, -7.09], MM: [21.91, 95.96], NP: [28.39, 84.12], NL: [52.13, 5.29],
  NZ: [-40.90, 174.89], NG: [9.08, 8.68], NO: [60.47, 8.47], OM: [21.47, 55.98],
  PK: [30.38, 69.35], PA: [8.54, -80.78], PY: [-23.44, -58.44], PE: [-9.19, -75.02],
  PH: [12.88, 121.77], PL: [51.92, 19.15], PT: [39.40, -8.22], QA: [25.35, 51.18],
  RO: [45.94, 24.97], RU: [61.52, 105.32], SA: [23.89, 45.08], SN: [14.50, -14.45],
  RS: [44.02, 21.01], SG: [1.35, 103.82], SK: [48.67, 19.70], ZA: [-30.56, 22.94],
  KR: [35.91, 127.77], ES: [40.46, -3.75], LK: [7.87, 80.77], SD: [12.86, 30.22],
  SE: [60.13, 18.64], CH: [46.82, 8.23], SY: [34.80, 38.99], TW: [23.70, 120.96],
  TZ: [-6.37, 34.89], TH: [15.87, 100.99], TN: [33.89, 9.54], TR: [38.96, 35.24],
  UA: [48.38, 31.17], AE: [23.42, 53.85], GB: [55.38, -3.44], US: [37.09, -95.71],
  UY: [-32.52, -55.77], UZ: [41.38, 64.59], VE: [6.42, -66.59], VN: [14.06, 108.28],
  YE: [15.55, 48.52], ZM: [-13.13, 27.85], ZW: [-19.02, 29.15],
};

interface OutageEntry {
  country: string;
  score: number;
  lat: number;
  lng: number;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const unixNow = Math.floor(now / 1000);
    const unix30MinAgo = unixNow - 1800;
    const url = `${IODA_BASE}?from=${unix30MinAgo}&until=${unixNow}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`IODA ${res.status}`);

    const json = await res.json();
    const outages: OutageEntry[] = [];

    // IODA v2 returns data grouped by entity (country codes)
    const dataEntries = json?.data || json?.results || json;
    if (Array.isArray(dataEntries)) {
      for (const entry of dataEntries) {
        const code = (entry.entityCode || entry.entity?.code || entry.code || '').toUpperCase();
        const score = entry.score ?? entry.value ?? entry.overall_score ?? 0;
        if (!code || score === 0) continue;

        const centroid = COUNTRY_CENTROIDS[code];
        if (!centroid) continue;

        outages.push({
          country: code,
          score: typeof score === 'number' ? Math.round(score * 100) / 100 : 0,
          lat: centroid[0],
          lng: centroid[1],
        });
      }
    } else if (typeof dataEntries === 'object' && dataEntries !== null) {
      // Handle object-keyed response { "US": {...}, "CN": {...} }
      for (const [code, value] of Object.entries(dataEntries)) {
        const upperCode = code.toUpperCase();
        const centroid = COUNTRY_CENTROIDS[upperCode];
        if (!centroid) continue;

        const entry = value as any;
        const score = entry?.score ?? entry?.value ?? entry?.overall_score ?? 0;
        if (score === 0) continue;

        outages.push({
          country: upperCode,
          score: typeof score === 'number' ? Math.round(score * 100) / 100 : 0,
          lat: centroid[0],
          lng: centroid[1],
        });
      }
    }

    cache = { data: outages, ts: now };
    return NextResponse.json(outages);
  } catch {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json([]);
  }
}
