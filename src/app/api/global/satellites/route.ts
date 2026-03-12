import { NextResponse } from 'next/server';

// CelesTrak TLE data - free, no auth
const TLE_URLS: Record<string, string> = {
  stations: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json',
  active: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json',
  starlink: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json',
};

let cache: { data: any; ts: number } | null = null;
const TTL = 600_000; // 10 minutes - TLEs don't change that fast

// Simplified SGP4-like propagation using mean elements
// Real SGP4 needs a full library, but for visualization purposes
// we can get reasonable positions from mean orbital elements
function propagateSatellite(sat: any): { lat: number; lng: number; alt: number; name: string; noradId: number; type: string } | null {
  try {
    const meanMotion = sat.MEAN_MOTION; // rev/day
    const inclination = sat.INCLINATION; // degrees
    const eccentricity = sat.ECCENTRICITY;
    const argPerigee = sat.ARG_OF_PERICENTER;
    const raan = sat.RA_OF_ASC_NODE;
    const meanAnomaly = sat.MEAN_ANOMALY;
    const epoch = new Date(sat.EPOCH).getTime();
    const name = (sat.OBJECT_NAME || '').trim();
    const noradId = sat.NORAD_CAT_ID;

    if (!meanMotion || meanMotion <= 0) return null;

    const now = Date.now();
    const daysSinceEpoch = (now - epoch) / 86400000;

    // Orbital period in minutes
    const period = 1440 / meanMotion;
    // Semi-major axis from period (Kepler's 3rd law) in km
    const mu = 398600.4418; // km^3/s^2
    const periodSec = period * 60;
    const a = Math.pow((mu * periodSec * periodSec) / (4 * Math.PI * Math.PI), 1/3);
    const alt = a - 6371; // altitude in km

    if (alt < 100 || alt > 50000) return null;

    // Current mean anomaly
    const M = (meanAnomaly + 360 * meanMotion * daysSinceEpoch) % 360;
    const Mrad = M * Math.PI / 180;

    // Solve Kepler's equation E - e*sin(E) = M (Newton's method)
    let E = Mrad;
    for (let i = 0; i < 10; i++) {
      E = E - (E - eccentricity * Math.sin(E) - Mrad) / (1 - eccentricity * Math.cos(E));
    }

    // True anomaly
    const sinV = Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(E) / (1 - eccentricity * Math.cos(E));
    const cosV = (Math.cos(E) - eccentricity) / (1 - eccentricity * Math.cos(E));
    const v = Math.atan2(sinV, cosV);

    // Argument of latitude
    const u = v + argPerigee * Math.PI / 180;

    // RAAN precession (J2 perturbation approximation)
    const J2 = 1.08263e-3;
    const Re = 6378.137;
    const n = meanMotion * 2 * Math.PI / 86400; // rad/s
    const iRad = inclination * Math.PI / 180;
    const raanDot = -1.5 * n * J2 * (Re / a) * (Re / a) * Math.cos(iRad) / ((1 - eccentricity * eccentricity) * (1 - eccentricity * eccentricity));
    const currentRaan = (raan * Math.PI / 180 + raanDot * daysSinceEpoch * 86400);

    // Position in orbital plane
    const r = a * (1 - eccentricity * Math.cos(E));
    const x_orb = r * Math.cos(u);
    const y_orb = r * Math.sin(u);

    // Rotate to ECI
    const cosO = Math.cos(currentRaan);
    const sinO = Math.sin(currentRaan);
    const cosI = Math.cos(iRad);
    const sinI = Math.sin(iRad);

    const x_eci = cosO * x_orb - sinO * y_orb * cosI;
    const y_eci = sinO * x_orb + cosO * y_orb * cosI;
    const z_eci = y_orb * sinI;

    // ECI to geodetic
    const gmst = getGMST(now);
    const x_ecf = x_eci * Math.cos(gmst) + y_eci * Math.sin(gmst);
    const y_ecf = -x_eci * Math.sin(gmst) + y_eci * Math.cos(gmst);

    let lat = Math.atan2(z_eci, Math.sqrt(x_ecf * x_ecf + y_ecf * y_ecf)) * 180 / Math.PI;
    let lng = Math.atan2(y_ecf, x_ecf) * 180 / Math.PI;

    // Normalize longitude
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;

    if (isNaN(lat) || isNaN(lng)) return null;

    // Classify type
    let type = 'active';
    const nameLower = name.toLowerCase();
    if (nameLower.includes('starlink')) type = 'starlink';
    else if (nameLower.includes('iss') || nameLower.includes('zarya') || nameLower.includes('tiangong')) type = 'station';
    else if (nameLower.includes('gps') || nameLower.includes('navstar')) type = 'navigation';
    else if (nameLower.includes('cosmos') || nameLower.includes('usa ') || nameLower.includes('nrol')) type = 'military';

    return { lat, lng, alt: Math.round(alt), name, noradId, type };
  } catch {
    return null;
  }
}

function getGMST(timeMs: number): number {
  const JD = timeMs / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  let gmst = 280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933 * T * T;
  gmst = ((gmst % 360) + 360) % 360;
  return gmst * Math.PI / 180;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    // Fetch stations (ISS etc) + a sample of active satellites
    const [stationsRes, activeRes] = await Promise.allSettled([
      fetch(TLE_URLS.stations, { signal: AbortSignal.timeout(15000) }),
      fetch(TLE_URLS.active, { signal: AbortSignal.timeout(15000) }),
    ]);

    const satellites: any[] = [];
    const groups = [
      { res: stationsRes, maxItems: 50 },
      { res: activeRes, maxItems: 800 },
    ];

    for (const { res, maxItems } of groups) {
      if (res.status !== 'fulfilled' || !res.value.ok) continue;
      const data = await res.value.json();
      if (!Array.isArray(data)) continue;

      // Sample if too many
      const items = data.length > maxItems
        ? data.filter((_: any, i: number) => i % Math.ceil(data.length / maxItems) === 0)
        : data;

      for (const sat of items) {
        const pos = propagateSatellite(sat);
        if (pos) satellites.push(pos);
      }
    }

    const result = {
      satellites,
      total: satellites.length,
      types: {
        station: satellites.filter(s => s.type === 'station').length,
        starlink: satellites.filter(s => s.type === 'starlink').length,
        military: satellites.filter(s => s.type === 'military').length,
        navigation: satellites.filter(s => s.type === 'navigation').length,
        active: satellites.filter(s => s.type === 'active').length,
      },
    };

    cache = { data: result, ts: now };
    return NextResponse.json(result);
  } catch {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ satellites: [], total: 0, types: {} }, { status: 502 });
  }
}
