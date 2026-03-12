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

// Airline IATA code to name mapping for common MCI carriers
const AIRLINE_NAMES: Record<string, string> = {
  WN: 'Southwest', AA: 'American', DL: 'Delta', UA: 'United', NK: 'Spirit',
  AS: 'Alaska Airlines', B6: 'JetBlue', F9: 'Frontier', G4: 'Allegiant',
  OO: 'SkyWest', YV: 'Mesa Airlines', YX: 'Republic', QX: 'Horizon',
  MQ: 'Envoy Air', OH: 'PSA Airlines', ZW: 'Air Wisconsin', '9E': 'Endeavor',
};

export async function GET(request: NextRequest) {
  const airport = request.nextUrl.searchParams.get('airport') || 'MCI';
  const type = request.nextUrl.searchParams.get('type') || 'arrivals'; // arrivals or departures
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

  try {
    // Try AviationStack API first (free tier: 100 requests/month)
    const aviationStackKey = process.env.AVIATIONSTACK_KEY;
    if (aviationStackKey) {
      const endpoint = type === 'arrivals' ? 'flights' : 'flights';
      const paramName = type === 'arrivals' ? 'arr_iata' : 'dep_iata';
      const url = `https://api.aviationstack.com/v1/${endpoint}?access_key=${aviationStackKey}&${paramName}=${airport}&limit=${limit}&flight_status=active,scheduled,landed`;

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

          return NextResponse.json({ flights, source: 'aviationstack' });
        }
      }
    }

    // Fallback: Try FlightAware AeroAPI
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

        return NextResponse.json({ flights, source: 'flightaware' });
      }
    }

    // Fallback: Try OpenSky Network for live flights near airport
    const url = `https://opensky-network.org/api/flights/${type === 'arrivals' ? 'arrival' : 'departure'}?airport=${airport.length === 3 ? `K${airport}` : airport}&begin=${Math.floor(Date.now() / 1000) - 7200}&end=${Math.floor(Date.now() / 1000)}`;
    const res = await fetch(url, { next: { revalidate: 300 } });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const flights: FlightInfo[] = data.slice(0, limit).map((f: Record<string, string | number>) => {
          const callsign = (f.callsign as string || '').trim();
          const iata = callsign.slice(0, 2);
          return {
            flightNumber: callsign || 'N/A',
            airline: AIRLINE_NAMES[iata] || iata,
            airlineIata: iata,
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

        return NextResponse.json({ flights, source: 'opensky' });
      }
    }

    return NextResponse.json({ flights: [], source: 'none', message: 'No flight data available. Set AVIATIONSTACK_KEY or FLIGHTAWARE_KEY env var.' });
  } catch (err) {
    console.error('[flights] fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch flight data' }, { status: 500 });
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
