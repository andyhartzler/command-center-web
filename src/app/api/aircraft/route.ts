import { NextRequest, NextResponse } from 'next/server';

interface FlightLog {
  date: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  status: 'completed' | 'in_progress' | 'planned';
}

interface TrackerData {
  tailNumber: string;
  owner: string;
  aircraftType: string;
  lastSeen: string | null;
  isAirborne: boolean;
  currentFlight: {
    departure: string;
    arrival: string;
    altitude: number;
    speed: number;
    heading: number;
    lat: number;
    lon: number;
  } | null;
  recentFlights: FlightLog[];
  source: string;
}

// In-memory cache
let aircraftCache: { key: string; data: TrackerData; ts: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function GET(request: NextRequest) {
  const tail = request.nextUrl.searchParams.get('tail') || '';

  if (!tail) {
    return NextResponse.json({ error: 'tail parameter required' }, { status: 400 });
  }

  // Return cached data if fresh
  if (aircraftCache && aircraftCache.key === tail && Date.now() - aircraftCache.ts < CACHE_TTL) {
    return NextResponse.json({ ...aircraftCache.data, cached: true });
  }

  try {
    // Fetch from alert worker and FlightAware scrape in parallel
    const [alertResult, scraped] = await Promise.all([
      fetchFromAlertWorker(tail),
      scrapeFlightAwareHistory(tail),
    ]);

    // Merge: use alert worker for real-time status, FlightAware for historical flights
    if (alertResult || scraped) {
      const base = scraped || alertResult!;
      const result: TrackerData = {
        tailNumber: tail,
        owner: base.owner,
        aircraftType: base.aircraftType || 'S22T',
        lastSeen: base.lastSeen,
        isAirborne: alertResult?.isAirborne || scraped?.isAirborne || false,
        currentFlight: alertResult?.currentFlight || scraped?.currentFlight || null,
        // Prefer FlightAware scraped history (richer), supplement with alert worker flights
        recentFlights: scraped?.recentFlights.length
          ? scraped.recentFlights
          : alertResult?.recentFlights || [],
        source: scraped ? 'flightaware-web' : 'flight-alerts',
      };
      aircraftCache = { key: tail, data: result, ts: Date.now() };
      return NextResponse.json(result);
    }

    // Try FlightAware AeroAPI (if key provided)
    const flightAwareKey = process.env.FLIGHTAWARE_KEY;
    if (flightAwareKey) {
      const result = await fetchFromAeroAPI(tail, flightAwareKey);
      if (result) {
        aircraftCache = { key: tail, data: result, ts: Date.now() };
        return NextResponse.json(result);
      }
    }

    // Try ADS-B Exchange API (if key provided)
    const adsbxKey = process.env.ADSBX_KEY;
    if (adsbxKey) {
      const result = await fetchFromADSBX(tail, adsbxKey);
      if (result) {
        aircraftCache = { key: tail, data: result, ts: Date.now() };
        return NextResponse.json(result);
      }
    }

    return NextResponse.json({
      tailNumber: tail,
      owner: '',
      aircraftType: '',
      lastSeen: null,
      isAirborne: false,
      currentFlight: null,
      recentFlights: [],
      source: 'none',
    });
  } catch (err) {
    console.error('[aircraft] fetch error', err);
    if (aircraftCache && aircraftCache.key === tail) {
      return NextResponse.json({ ...aircraftCache.data, cached: true, stale: true });
    }
    return NextResponse.json({ error: 'Failed to fetch aircraft data' }, { status: 500 });
  }
}

// Parse airport codes from FlightAware email subject lines
function parseSubject(raw: string): { origin: string; destination: string } {
  // "N233AB has departed LRY for GTU" → origin=LRY, dest=GTU
  const depMatch = raw.match(/departed\s+(\w{3,4})\s+for\s+(\w{3,4})/i);
  if (depMatch) return { origin: depMatch[1], destination: depMatch[2] };

  // "N233AB arrived at GTU from LRY" → origin=LRY, dest=GTU
  const arrMatch = raw.match(/arrived\s+at\s+(\w{3,4})\s+from\s+(\w{3,4})/i);
  if (arrMatch) return { origin: arrMatch[2], destination: arrMatch[1] };

  // "N233AB is expected to arrive at GTU in 45 min" → dest=GTU
  const etaMatch = raw.match(/arrive\s+at\s+(\w{3,4})/i);
  if (etaMatch) return { origin: '', destination: etaMatch[1] };

  return { origin: '', destination: '' };
}

async function fetchFromAlertWorker(tail: string): Promise<TrackerData | null> {
  try {
    const res = await fetch('https://flight-alerts.hartzler.workers.dev/api/events', {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;

    interface AlertEvent {
      type: 'departure' | 'arrival' | 'unknown';
      tailNumber: string;
      origin: string;
      destination: string;
      time: string;
      rawSubject: string;
      receivedAt: string;
    }

    const data: { events: AlertEvent[]; lastUpdated: string | null } = await res.json();
    if (!data.events || data.events.length === 0) return null;

    // Group consecutive departure+arrival into flight legs
    const flights: FlightLog[] = [];
    const events = data.events.filter(e => e.tailNumber === tail);

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const date = new Date(ev.receivedAt);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Parse airport codes from rawSubject when fields are empty
      const parsed = parseSubject(ev.rawSubject);
      const evOrigin = ev.origin || parsed.origin;
      const evDest = ev.destination || parsed.destination;

      if (ev.type === 'arrival') {
        const dep = events[i + 1]?.type === 'departure' ? events[i + 1] : null;
        const depParsed = dep ? parseSubject(dep.rawSubject) : null;
        const depOrigin = dep?.origin || depParsed?.origin || '';
        const depTime = dep ? new Date(dep.receivedAt).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
        }) : '';
        const arrTime = date.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
        });

        // Calculate duration if we have both times
        let duration = '';
        if (dep) {
          const mins = Math.round((date.getTime() - new Date(dep.receivedAt).getTime()) / 60000);
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
        }

        flights.push({
          date: dateStr,
          departure: depOrigin || evOrigin,
          arrival: evDest,
          departureTime: dep?.time || depTime,
          arrivalTime: ev.time || arrTime,
          duration,
          status: 'completed',
        });
        if (dep) i++;
      } else if (ev.type === 'departure') {
        const depTime = date.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
        });
        flights.push({
          date: dateStr,
          departure: evOrigin,
          arrival: evDest,
          departureTime: ev.time || depTime,
          arrivalTime: '',
          duration: '',
          status: 'in_progress',
        });
      }
    }

    const isAirborne = flights.length > 0 && flights[0].status === 'in_progress';

    return {
      tailNumber: tail,
      owner: '',
      aircraftType: 'S22T',
      lastSeen: flights[0]?.date || null,
      isAirborne,
      currentFlight: isAirborne ? {
        departure: flights[0].departure,
        arrival: flights[0].arrival,
        altitude: 0, speed: 0, heading: 0, lat: 0, lon: 0,
      } : null,
      recentFlights: flights,
      source: 'flight-alerts',
    };
  } catch (err) {
    console.error('[aircraft] alert worker fetch error', err);
    return null;
  }
}

async function scrapeFlightAwareHistory(tail: string): Promise<TrackerData | null> {
  try {
    const url = `https://www.flightaware.com/live/flight/${tail}/history`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      next: { revalidate: 120 },
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Find the history table - it has columns: Date, Aircraft, Origin, Destination, Departure, Arrival, Duration
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/g;
    let historyTable: string | null = null;
    let match;

    while ((match = tableRegex.exec(html)) !== null) {
      const table = match[1];
      // The history table has "Date" and "Duration" headers
      if (table.includes('Duration') && table.includes('Origin')) {
        historyTable = table;
        break;
      }
    }

    if (!historyTable) return null;

    // Extract rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    const flights: FlightLog[] = [];
    let aircraftType = '';

    while ((match = rowRegex.exec(historyTable)) !== null) {
      const row = match[1];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
      const cells: string[] = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(row)) !== null) {
        const text = cellMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        cells.push(text);
      }

      // 7 columns: Date, Aircraft, Origin, Destination, Departure, Arrival, Duration
      if (cells.length >= 7) {
        const date = cells[0];
        const acType = cells[1];
        const origin = cells[2];
        const destination = cells[3];
        const departure = cells[4];
        const arrival = cells[5];
        const duration = cells[6];

        if (!aircraftType && acType) aircraftType = acType;

        // Extract airport code from "City Name ( CODE )"
        const originMatch = origin.match(/\(\s*(\w+)\s*\)/);
        const destMatch = destination.match(/\(\s*(\w+)\s*\)/);

        // Clean up unknown values - FlightAware uses "(?) " or "( ? )" for unknowns
        // Also strip "( ? )" from time strings like "03:48PM  CDT  ( ? )"
        const stripQ = (s: string) => s.replace(/\(\s*\?\s*\)/g, '').trim();
        const cleanDest = destMatch ? destMatch[1] : stripQ(destination).slice(0, 4).trim();
        const cleanArrival = stripQ(arrival) || '';
        const cleanDeparture = stripQ(departure) || '';

        // Normalize times: "03:13PM  CDT" → "3:13 PM"
        const normalizeTime = (t: string) => {
          if (!t) return '';
          const m = t.match(/^0?(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|a|p)\s*/i);
          if (m) {
            const ampm = m[3].length === 1
              ? (m[3].toLowerCase() === 'p' ? 'PM' : 'AM')
              : m[3].toUpperCase();
            return `${parseInt(m[1])}:${m[2]} ${ampm}`;
          }
          return t;
        };

        // Determine status
        let status: FlightLog['status'] = 'completed';
        if (!cleanArrival && cleanDeparture) status = 'in_progress';
        if (!cleanDeparture && !cleanArrival) status = 'planned';

        flights.push({
          date,
          departure: originMatch ? originMatch[1] : stripQ(origin).slice(0, 4).trim(),
          arrival: cleanDest || '',
          departureTime: normalizeTime(cleanDeparture),
          arrivalTime: normalizeTime(cleanArrival),
          duration: stripQ(duration) || '',
          status,
        });
      }
    }

    if (flights.length === 0) return null;

    // Check if most recent flight is in progress
    const isAirborne = flights.length > 0 && flights[0].status === 'in_progress';

    return {
      tailNumber: tail,
      owner: '',
      aircraftType,
      lastSeen: flights[0]?.date || null,
      isAirborne,
      currentFlight: isAirborne ? {
        departure: flights[0].departure,
        arrival: flights[0].arrival,
        altitude: 0,
        speed: 0,
        heading: 0,
        lat: 0,
        lon: 0,
      } : null,
      recentFlights: flights,
      source: 'flightaware-web',
    };
  } catch (err) {
    console.error('[aircraft] FlightAware scrape error', err);
    return null;
  }
}

async function fetchFromAeroAPI(tail: string, apiKey: string): Promise<TrackerData | null> {
  try {
    const flightsUrl = `https://aeroapi.flightaware.com/aeroapi/flights/${tail}?max_pages=1`;
    const flightsRes = await fetch(flightsUrl, {
      headers: { 'x-apikey': apiKey },
      next: { revalidate: 60 },
    });

    if (!flightsRes.ok) return null;

    const flightsData = await flightsRes.json();
    const flights = flightsData.flights || [];

    const activeFlight = flights.find((f: Record<string, string | boolean | number>) =>
      f.progress_percent !== undefined && Number(f.progress_percent) < 100 && !f.actual_in
    );

    const recentFlights: FlightLog[] = flights.slice(0, 15).map((f: Record<string, string | number | Record<string, string>>) => {
      const depTime = f.actual_out || f.scheduled_out || '';
      const arrTime = f.actual_in || f.estimated_in || f.scheduled_in || '';
      const depDate = depTime ? new Date(depTime as string) : null;
      const arrDate = arrTime ? new Date(arrTime as string) : null;

      let duration = '';
      if (depDate && arrDate) {
        const mins = Math.round((arrDate.getTime() - depDate.getTime()) / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
      }

      const origin = f.origin as Record<string, string> | undefined;
      const dest = f.destination as Record<string, string> | undefined;

      return {
        date: depDate ? depDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        departure: origin?.code_iata || origin?.code || '',
        arrival: dest?.code_iata || dest?.code || '',
        departureTime: depDate ? depDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' }) : '',
        arrivalTime: arrDate ? arrDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' }) : '',
        duration,
        status: (!f.actual_in && f.actual_out ? 'in_progress' : 'completed') as FlightLog['status'],
      };
    });

    return {
      tailNumber: tail,
      owner: '',
      aircraftType: flights[0]?.aircraft_type || '',
      lastSeen: flights[0]?.actual_in ? new Date(flights[0].actual_in as string).toLocaleDateString() : null,
      isAirborne: !!activeFlight,
      currentFlight: activeFlight ? {
        departure: (activeFlight.origin as Record<string, string>)?.code_iata || '',
        arrival: (activeFlight.destination as Record<string, string>)?.code_iata || '',
        altitude: activeFlight.last_position?.altitude || 0,
        speed: activeFlight.last_position?.groundspeed || 0,
        heading: activeFlight.last_position?.heading || 0,
        lat: activeFlight.last_position?.latitude || 0,
        lon: activeFlight.last_position?.longitude || 0,
      } : null,
      recentFlights,
      source: 'flightaware',
    };
  } catch {
    return null;
  }
}

async function fetchFromADSBX(tail: string, apiKey: string): Promise<TrackerData | null> {
  try {
    const url = `https://adsbexchange.com/api/aircraft/v2/registration/${tail}/`;
    const res = await fetch(url, {
      headers: { 'api-auth': apiKey },
      next: { revalidate: 30 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const ac = data.ac?.[0];
    const isAirborne = ac && ac.alt_baro && ac.alt_baro !== 'ground';

    return {
      tailNumber: tail,
      owner: ac?.ownOp || '',
      aircraftType: ac?.t || '',
      lastSeen: ac?.seen ? `${ac.seen}s ago` : null,
      isAirborne,
      currentFlight: isAirborne ? {
        departure: '',
        arrival: '',
        altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : 0,
        speed: ac.gs || 0,
        heading: ac.track || 0,
        lat: ac.lat || 0,
        lon: ac.lon || 0,
      } : null,
      recentFlights: [],
      source: 'adsbexchange',
    };
  } catch {
    return null;
  }
}
