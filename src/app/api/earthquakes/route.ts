import { NextResponse } from 'next/server';

interface USGSFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    type: string;
  };
  geometry: {
    coordinates: [number, number, number]; // [lon, lat, depth]
  };
}

interface USGSResponse {
  type: string;
  features: USGSFeature[];
}

export interface EarthquakeData {
  id: string;
  lat: number;
  lon: number;
  mag: number;
  place: string;
  time: number;
}

export async function GET() {
  try {
    const res = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch earthquake data' },
        { status: res.status }
      );
    }

    const data: USGSResponse = await res.json();

    // USGS can emit null magnitudes on fresh events; drop anything we cannot
    // place or band honestly rather than plotting fabricated values.
    const features: EarthquakeData[] = data.features
      .filter(
        (f) =>
          Number.isFinite(f.properties?.mag) &&
          Number.isFinite(f.geometry?.coordinates?.[0]) &&
          Number.isFinite(f.geometry?.coordinates?.[1]),
      )
      .map((f) => ({
        id: f.id,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        mag: f.properties.mag,
        place: f.properties.place ?? '',
        time: f.properties.time,
      }));

    return NextResponse.json(features);
  } catch (err) {
    console.error('Earthquake API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
