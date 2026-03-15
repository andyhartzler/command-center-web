import { NextRequest, NextResponse } from 'next/server';

interface FlightInfo {
  flightNumber: string;
  airline: string;
  airlineIata: string;
  origin: string;
  destination: string;
  scheduledTime: string;
  estimatedTime: string | null;
  actualTime: string | null;
  status: 'scheduled' | 'en_route' | 'landed' | 'delayed' | 'cancelled' | 'unknown';
  aircraft: string;
  gate: string | null;
  terminal: string | null;
}

// Airline IATA/ICAO code to name mapping for common MCI carriers
const AIRLINE_NAMES: Record<string, string> = {
  WN: 'Southwest', SWA: 'Southwest',
  AA: 'American', AAL: 'American',
  DL: 'Delta', DAL: 'Delta',
  UA: 'United', UAL: 'United',
  NK: 'Spirit', NKS: 'Spirit',
  AS: 'Alaska Airlines', ASA: 'Alaska Airlines',
  B6: 'JetBlue', JBU: 'JetBlue',
  F9: 'Frontier', FFT: 'Frontier',
  G4: 'Allegiant', AAY: 'Allegiant',
  OO: 'SkyWest', SKW: 'SkyWest',
  YV: 'Mesa Airlines', ASH: 'Mesa Airlines',
  YX: 'Republic', RPA: 'Republic',
  QX: 'Horizon', QXE: 'Horizon',
  MQ: 'Envoy Air', ENY: 'Envoy Air',
  OH: 'PSA Airlines', JIA: 'PSA Airlines',
  ZW: 'Air Wisconsin', AWI: 'Air Wisconsin',
  '9E': 'Endeavor', EDV: 'Endeavor',
  UPS: 'UPS', FDX: 'FedEx',
};

// In-memory cache to avoid hammering external sources
let flightCache: { key: string; data: { flights: FlightInfo[]; source: string }; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const airport = request.nextUrl.searchParams.get('airport') || 'MCI';
  const type = request.nextUrl.searchParams.get('type') || 'arrivals';
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

  const cacheKey = `${airport}-${type}`;

  // Return cached data if fresh
  if (flightCache && flightCache.key === cacheKey && Date.now() - flightCache.ts < CACHE_TTL) {
    return NextResponse.json({ ...flightCache.data, cached: true });
  }

  try {
    // Try AviationStack API first (if key provided)
    const aviationStackKey = process.env.AVIATIONSTACK_KEY;
    if (aviationStackKey) {
      const paramName = type === 'arrivals' ? 'arr_iata' : 'dep_iata';
      const url = `https://api.aviationstack.com/v1/flights?access_key=${aviationStackKey}&${paramName}=${airport}&limit=${limit}&flight_status=active,scheduled,landed`;

      const res = await fetch(url, { next: { revalidate: 120 } });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.length) {
          const flights: FlightInfo[] = data.data.map((f: Record<string, Record<string, string>>) => ({
            flightNumber: f.flight?.iata || f.flight?.icao || 'N/A',
            airline: f.airline?.name || 'Unknown',
            airlineIata: f.airline?.iata || '',
            origin: type === 'arrivals' ? (f.departure?.iata || '') : airport,
            destination: type === 'arrivals' ? airport : (f.arrival?.iata || ''),
            scheduledTime: type === 'arrivals' ? f.arrival?.scheduled : f.departure?.scheduled,
            estimatedTime: type === 'arrivals' ? f.arrival?.estimated : f.departure?.estimated,
            actualTime: type === 'arrivals' ? f.arrival?.actual : f.departure?.actual,
            status: mapStatus(f.flight_status as unknown as string),
            aircraft: f.aircraft?.iata || '',
            gate: type === 'arrivals' ? f.arrival?.gate : f.departure?.gate,
            terminal: type === 'arrivals' ? f.arrival?.terminal : f.departure?.terminal,
          }));

          const result = { flights, source: 'aviationstack' };
          flightCache = { key: cacheKey, data: result, ts: Date.now() };
          return NextResponse.json(result);
        }
      }
    }

    // Try FlightAware AeroAPI (if key provided)
    const flightAwareKey = process.env.FLIGHTAWARE_KEY;
    if (flightAwareKey) {
      const endpoint = type === 'arrivals' ? 'arrivals' : 'departures';
      const url = `https://aeroapi.flightaware.com/aeroapi/airports/${airport}/flights/${endpoint}?max_pages=1`;
      const res = await fetch(url, {
        headers: { 'x-apikey': flightAwareKey },
        next: { revalidate: 120 },
      });

      if (res.ok) {
        const data = await res.json();
        const flightData = data[endpoint] || data.scheduled_arrivals || data.scheduled_departures || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flights: FlightInfo[] = flightData.slice(0, limit).map((f: any) => ({
          flightNumber: f.ident || 'N/A',
          airline: AIRLINE_NAMES[f.operator?.slice(0, 2) || ''] || f.operator || 'Unknown',
          airlineIata: f.operator?.slice(0, 2) || '',
          origin: type === 'arrivals' ? (f.origin?.code_iata || f.origin?.code || '') : airport,
          destination: type === 'arrivals' ? airport : (f.destination?.code_iata || f.destination?.code || ''),
          scheduledTime: type === 'arrivals' ? f.scheduled_in : f.scheduled_out,
          estimatedTime: type === 'arrivals' ? f.estimated_in : f.estimated_out,
          actualTime: type === 'arrivals' ? f.actual_in : f.actual_out,
          status: mapStatus(f.status as string),
          aircraft: f.aircraft_type || '',
          gate: type === 'arrivals' ? f.gate_destination : f.gate_origin,
          terminal: type === 'arrivals' ? f.terminal_destination : f.terminal_origin,
        }));

        const result = { flights, source: 'flightaware' };
        flightCache = { key: cacheKey, data: result, ts: Date.now() };
        return NextResponse.json(result);
      }
    }

    // Free fallback: Scrape FlightAware public airport page
    const icao = airport.length === 3 ? `K${airport}` : airport;
    const flights = await scrapeFlightAwareAirport(icao, type, limit);
    if (flights.length > 0) {
      const result = { flights, source: 'flightaware-web' };
      flightCache = { key: cacheKey, data: result, ts: Date.now() };
      return NextResponse.json(result);
    }

    // Last resort: OpenSky Network
    const begin = Math.floor(Date.now() / 1000) - 43200; // 12 hours
    const end = Math.floor(Date.now() / 1000);
    const osUrl = `https://opensky-network.org/api/flights/${type === 'arrivals' ? 'arrival' : 'departure'}?airport=${icao}&begin=${begin}&end=${end}`;
    const osRes = await fetch(osUrl, { next: { revalidate: 300 } });

    if (osRes.ok) {
      const data = await osRes.json();
      if (Array.isArray(data) && data.length > 0) {
        const osFlights: FlightInfo[] = data.slice(0, limit).map((f: Record<string, string | number>) => {
          const callsign = (f.callsign as string || '').trim();
          const prefix = callsign.slice(0, 3);
          return {
            flightNumber: callsign || 'N/A',
            airline: AIRLINE_NAMES[prefix] || AIRLINE_NAMES[callsign.slice(0, 2)] || prefix,
            airlineIata: callsign.slice(0, 2),
            origin: type === 'arrivals' ? (f.estDepartureAirport as string || '') : airport,
            destination: type === 'arrivals' ? airport : (f.estArrivalAirport as string || ''),
            scheduledTime: new Date((f.firstSeen as number) * 1000).toISOString(),
            estimatedTime: null,
            actualTime: f.lastSeen ? new Date((f.lastSeen as number) * 1000).toISOString() : null,
            status: 'landed' as const,
            aircraft: '',
            gate: null,
            terminal: null,
          };
        });

        const result = { flights: osFlights, source: 'opensky' };
        flightCache = { key: cacheKey, data: result, ts: Date.now() };
        return NextResponse.json(result);
      }
    }

    return NextResponse.json({ flights: [], source: 'none' });
  } catch (err) {
    console.error('[flights] fetch error', err);
    // Return stale cache if available
    if (flightCache && flightCache.key === cacheKey) {
      return NextResponse.json({ ...flightCache.data, cached: true, stale: true });
    }
    return NextResponse.json({ error: 'Failed to fetch flight data' }, { status: 500 });
  }
}

async function scrapeFlightAwareAirport(icao: string, type: string, limit: number): Promise<FlightInfo[]> {
  try {
    const url = `https://flightaware.com/live/airport/${icao}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) return [];

    const html = await res.text();

    // Find the arrivals or departures table
    const tableType = type === 'arrivals' ? 'arrivals' : 'departures';
    const tableRegex = new RegExp(`data-type="${tableType}">([\\s\\S]*?)</table>`);
    const tableMatch = html.match(tableRegex);
    if (!tableMatch) return [];

    const tableHtml = tableMatch[1];

    // Extract rows (skip header rows)
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    const flights: FlightInfo[] = [];
    let match;

    while ((match = rowRegex.exec(tableHtml)) !== null) {
      const row = match[1];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
      const cells: string[] = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(row)) !== null) {
        // Strip HTML tags
        const text = cellMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        cells.push(text);
      }

      // FlightAware airport table has 6 columns: Ident, Type, Origin/Dest, Depart, En Route, Arrival
      if (cells.length >= 6) {
        const ident = cells[0];
        const aircraft = cells[1];
        const location = cells[2];

        // Extract airport code from "City Name ( CODE )"
        const codeMatch = location.match(/\(\s*(\w+)\s*\)/);
        const locationCode = codeMatch ? codeMatch[1] : location.slice(0, 4);

        // Parse times
        const depTimeStr = cells[3].trim();
        const arrTimeStr = cells[5].trim();

        // Determine airline from ICAO ident (e.g., SWA3824 -> SWA)
        const identPrefix = ident.replace(/[0-9]/g, '');
        const airlineName = AIRLINE_NAMES[identPrefix] || AIRLINE_NAMES[identPrefix.slice(0, 2)] || identPrefix;
        // Map ICAO prefix to IATA code for logos
        const icaoToIata: Record<string, string> = {
          SWA: 'WN', AAL: 'AA', DAL: 'DL', UAL: 'UA', NKS: 'NK',
          ASA: 'AS', JBU: 'B6', FFT: 'F9', AAY: 'G4', SKW: 'OO',
          ASH: 'YV', RPA: 'YX', QXE: 'QX', ENY: 'MQ', JIA: 'OH',
          AWI: 'ZW', EDV: '9E', UPS: '5X', FDX: 'FX', ATN: '8C',
        };
        const iataCode = icaoToIata[identPrefix] || identPrefix.slice(0, 2);

        // Determine status based on which time columns have data
        let status: FlightInfo['status'] = 'scheduled';
        if (arrTimeStr && depTimeStr) status = 'landed';
        else if (depTimeStr && cells[4].trim()) status = 'en_route';

        flights.push({
          flightNumber: ident,
          airline: airlineName,
          airlineIata: iataCode,
          origin: type === 'arrivals' ? locationCode : icao.replace(/^K/, ''),
          destination: type === 'arrivals' ? icao.replace(/^K/, '') : locationCode,
          scheduledTime: depTimeStr || arrTimeStr,
          estimatedTime: null,
          actualTime: arrTimeStr || null,
          status,
          aircraft,
          gate: null,
          terminal: null,
        });
      }

      if (flights.length >= limit) break;
    }

    return flights;
  } catch (err) {
    console.error('[flights] FlightAware scrape error', err);
    return [];
  }
}

function mapStatus(status: string): FlightInfo['status'] {
  if (!status) return 'unknown';
  const s = status.toLowerCase();
  if (s.includes('schedul')) return 'scheduled';
  if (s.includes('active') || s.includes('route') || s.includes('en_route')) return 'en_route';
  if (s.includes('land')) return 'landed';
  if (s.includes('delay')) return 'delayed';
  if (s.includes('cancel')) return 'cancelled';
  return 'unknown';
}
