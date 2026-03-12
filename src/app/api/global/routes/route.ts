import { NextResponse } from 'next/server';

// Flight route lookup via adsb.lol routeset API
// Returns origin/destination airport pairs for callsigns

let cache: Map<string, { origin: string; dest: string; ts: number }> = new Map();
const TTL = 3600_000; // 1 hour

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const callsign = searchParams.get('callsign');
    if (!callsign) {
      return NextResponse.json({ error: 'callsign required' }, { status: 400 });
    }

    // Check cache
    const cached = cache.get(callsign);
    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json({ callsign, origin: cached.origin, dest: cached.dest, cached: true });
    }

    // Query adsb.lol routeset API
    const res = await fetch(`https://api.adsb.lol/api/0/routeset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flights: [callsign] }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ callsign, origin: null, dest: null });
    }

    const data = await res.json();
    const route = data?.[callsign] || data?.routes?.[callsign];

    if (route && route._airport_codes_iata) {
      const codes = route._airport_codes_iata.split('-');
      const result = {
        origin: codes[0] || '',
        dest: codes[1] || '',
      };
      cache.set(callsign, { ...result, ts: Date.now() });

      // Clean old cache entries - hard limit at 2000
      if (cache.size > 2000) {
        const now = Date.now();
        for (const [k, v] of cache) {
          if (now - v.ts > TTL) cache.delete(k);
        }
        // If still over limit, remove oldest entries
        if (cache.size > 2000) {
          const entries = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
          for (let i = 0; i < entries.length - 1000; i++) {
            cache.delete(entries[i][0]);
          }
        }
      }

      return NextResponse.json({
        callsign,
        ...result,
        originCoords: route.origin ? { lat: route.origin.lat, lng: route.origin.lon } : null,
        destCoords: route.destination ? { lat: route.destination.lat, lng: route.destination.lon } : null,
      });
    }

    return NextResponse.json({ callsign, origin: null, dest: null });
  } catch {
    return NextResponse.json({ callsign: '', origin: null, dest: null });
  }
}

// Batch route lookup
export async function POST(req: Request) {
  try {
    const { callsigns } = await req.json();
    if (!Array.isArray(callsigns) || callsigns.length === 0) {
      return NextResponse.json({ routes: {} });
    }

    // Limit to 50 callsigns per request
    const batch = callsigns.slice(0, 50);
    const results: Record<string, { origin: string; dest: string; originCoords?: any; destCoords?: any }> = {};

    // Check cache first
    const uncached: string[] = [];
    for (const cs of batch) {
      const cached = cache.get(cs);
      if (cached && Date.now() - cached.ts < TTL) {
        results[cs] = { origin: cached.origin, dest: cached.dest };
      } else {
        uncached.push(cs);
      }
    }

    // Fetch uncached from API
    if (uncached.length > 0) {
      try {
        const res = await fetch('https://api.adsb.lol/api/0/routeset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flights: uncached }),
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const data = await res.json();
          for (const cs of uncached) {
            const route = data?.[cs] || data?.routes?.[cs];
            if (route && route._airport_codes_iata) {
              const codes = route._airport_codes_iata.split('-');
              const result = {
                origin: codes[0] || '',
                dest: codes[1] || '',
                originCoords: route.origin ? { lat: route.origin.lat, lng: route.origin.lon } : undefined,
                destCoords: route.destination ? { lat: route.destination.lat, lng: route.destination.lon } : undefined,
              };
              results[cs] = result;
              cache.set(cs, { origin: result.origin, dest: result.dest, ts: Date.now() });
            }
          }
        }
      } catch { /* route lookup failed */ }
    }

    return NextResponse.json({ routes: results });
  } catch {
    return NextResponse.json({ routes: {} });
  }
}
