// Airport geocoding from a bundled OurAirports-derived dataset
// (US small+ airports and world medium+; keyed by ICAO, ident, GPS and IATA
// codes). Server-side only: the JSON is ~2MB and must never reach the client.

import airportsData from '@/data/airports.json';

// Entry shape: [name, municipality, lat, lon, iata?]
type RawEntry = [string, string, number, number, string?];

const AIRPORTS = airportsData as unknown as Record<string, RawEntry>;

export interface Airport {
  code: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  iata?: string;
}

export function lookupAirport(code: string | null | undefined): Airport | null {
  if (!code) return null;
  const key = code.trim().toUpperCase();
  let entry = AIRPORTS[key];
  // FlightAware sometimes uses bare US identifiers without the K prefix
  if (!entry && key.length === 3) entry = AIRPORTS[`K${key}`];
  if (!entry && key.length === 4 && key.startsWith('K')) entry = AIRPORTS[key.slice(1)];
  if (!entry) return null;
  return {
    code: key,
    name: entry[0],
    city: entry[1],
    lat: entry[2],
    lon: entry[3],
    iata: entry[4],
  };
}

const EARTH_RADIUS_NM = 3440.065;

/** Great-circle distance in nautical miles */
export function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(a));
}

/** Interpolate `steps` points along the great circle between two coordinates */
export function greatCircleArc(
  lat1: number, lon1: number, lat2: number, lon2: number, steps = 64,
): Array<[number, number]> {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const p1 = { lat: toRad(lat1), lon: toRad(lon1) };
  const p2 = { lat: toRad(lat2), lon: toRad(lon2) };

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((p2.lat - p1.lat) / 2) ** 2 +
          Math.cos(p1.lat) * Math.cos(p2.lat) * Math.sin((p2.lon - p1.lon) / 2) ** 2,
      ),
    );
  if (d === 0) return [[lat1, lon1]];

  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1.lat) * Math.cos(p1.lon) + B * Math.cos(p2.lat) * Math.cos(p2.lon);
    const y = A * Math.cos(p1.lat) * Math.sin(p1.lon) + B * Math.cos(p2.lat) * Math.sin(p2.lon);
    const z = A * Math.sin(p1.lat) + B * Math.sin(p2.lat);
    points.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return points;
}
