import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const tail = request.nextUrl.searchParams.get('tail') || '';

  if (!tail) {
    return NextResponse.json({ error: 'tail parameter required' }, { status: 400 });
  }

  try {
    // Try FlightAware AeroAPI first (best for tail number tracking)
    const flightAwareKey = process.env.FLIGHTAWARE_KEY;
    if (flightAwareKey) {
      // Get recent flights for this tail number
      const flightsUrl = `https://aeroapi.flightaware.com/aeroapi/flights/${tail}?max_pages=1`;
      const flightsRes = await fetch(flightsUrl, {
        headers: { 'x-apikey': flightAwareKey },
        next: { revalidate: 60 },
      });

      if (flightsRes.ok) {
        const flightsData = await flightsRes.json();
        const flights = flightsData.flights || [];

        // Determine if currently airborne
        const activeFlight = flights.find((f: Record<string, string | boolean>) =>
          f.progress_percent !== undefined && Number(f.progress_percent) < 100 && !f.actual_in
        );

        const recentFlights = flights.slice(0, 15).map((f: Record<string, string | number | Record<string, string>>) => {
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
            departureTime: depDate ? depDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
            arrivalTime: arrDate ? arrDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
            duration,
            status: !f.actual_in && f.actual_out ? 'in_progress' as const : 'completed' as const,
          };
        });

        const result = {
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

        return NextResponse.json(result);
      }
    }

    // Try ADS-B Exchange API
    const adsbxKey = process.env.ADSBX_KEY;
    if (adsbxKey) {
      const url = `https://adsbexchange.com/api/aircraft/v2/registration/${tail}/`;
      const res = await fetch(url, {
        headers: { 'api-auth': adsbxKey },
        next: { revalidate: 30 },
      });

      if (res.ok) {
        const data = await res.json();
        const ac = data.ac?.[0];
        const isAirborne = ac && ac.alt_baro && ac.alt_baro !== 'ground';

        return NextResponse.json({
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
        });
      }
    }

    // Try OpenSky Network (free, no key needed but rate limited)
    try {
      // OpenSky can look up by ICAO24 hex, but we need tail->icao24 mapping
      // For now just try the all states endpoint and filter
      const url = `https://opensky-network.org/api/states/all?extended=1`;
      const res = await fetch(url, { next: { revalidate: 60 } });
      if (res.ok) {
        const data = await res.json();
        if (data.states) {
          const match = data.states.find((s: (string | number | null)[]) => {
            const callsign = (s[1] as string || '').trim();
            return callsign.toUpperCase() === tail.toUpperCase();
          });
          if (match) {
            return NextResponse.json({
              tailNumber: tail,
              owner: '',
              aircraftType: '',
              lastSeen: 'now',
              isAirborne: !match[8], // on_ground is index 8
              currentFlight: !match[8] ? {
                departure: '',
                arrival: '',
                altitude: Math.round((match[7] as number || 0) * 3.28084), // meters to feet
                speed: Math.round((match[9] as number || 0) * 1.94384), // m/s to knots
                heading: Math.round(match[10] as number || 0),
                lat: match[6] as number || 0,
                lon: match[5] as number || 0,
              } : null,
              recentFlights: [],
              source: 'opensky',
            });
          }
        }
      }
    } catch { /* opensky can be flaky */ }

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
    return NextResponse.json({ error: 'Failed to fetch aircraft data' }, { status: 500 });
  }
}
