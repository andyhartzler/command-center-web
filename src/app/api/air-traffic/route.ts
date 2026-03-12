import { NextRequest, NextResponse } from 'next/server';

interface AirplanesLiveAircraft {
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  alt_geom?: number;
  track?: number;
  flight?: string;
  hex?: string;
  r?: string;
  t?: string;
  gs?: number;
  squawk?: string;
}

interface AirplanesLiveResponse {
  ac?: AirplanesLiveAircraft[];
  total?: number;
}

export interface AircraftData {
  lat: number;
  lon: number;
  altitude: number;
  heading: number;
  callsign: string;
  hex: string;
  type: string;
  groundSpeed: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat') || '39.0997';
  const lon = searchParams.get('lon') || '-94.5786';
  const radius = searchParams.get('radius') || '50';

  try {
    const res = await fetch(
      `https://api.airplanes.live/v2/point/${lat}/${lon}/${radius}`,
      { next: { revalidate: 5 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch air traffic data' },
        { status: res.status }
      );
    }

    const data: AirplanesLiveResponse = await res.json();

    const aircraft: AircraftData[] = (data.ac || [])
      .filter((ac) => ac.lat != null && ac.lon != null)
      .map((ac) => {
        let alt = 0;
        if (typeof ac.alt_baro === 'number') {
          alt = ac.alt_baro;
        } else if (typeof ac.alt_geom === 'number') {
          alt = ac.alt_geom;
        }

        return {
          lat: ac.lat!,
          lon: ac.lon!,
          altitude: alt,
          heading: ac.track || 0,
          callsign: (ac.flight || ac.hex || '').trim(),
          hex: ac.hex || '',
          type: ac.t || '',
          groundSpeed: ac.gs || 0,
        };
      });

    return NextResponse.json(aircraft);
  } catch (err) {
    console.error('Air traffic API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
