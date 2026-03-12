import { NextRequest, NextResponse } from 'next/server';

interface GDELTFeature {
  type: string;
  properties: {
    name?: string;
    html?: string;
    tonez?: number;
    urlcount?: number;
  };
  geometry: {
    type: string;
    coordinates: [number, number]; // [lon, lat]
  };
}

interface GDELTResponse {
  type: string;
  features?: GDELTFeature[];
}

export interface ConflictData {
  name: string;
  lat: number;
  lon: number;
  tone: number;
  urlCount: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const maxPoints = searchParams.get('max') || '50';

  try {
    const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=conflict%20OR%20war%20OR%20crisis&mode=pointdata&format=geojson&maxpoints=${maxPoints}&last24h=yes`;

    const res = await fetch(url, { next: { revalidate: 300 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch conflict data' },
        { status: res.status }
      );
    }

    const data: GDELTResponse = await res.json();

    const features: ConflictData[] = (data.features || [])
      .filter(
        (f) =>
          f.geometry &&
          f.geometry.coordinates &&
          f.geometry.coordinates.length >= 2
      )
      .map((f) => ({
        name: f.properties?.name || f.properties?.html || 'Unknown',
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        tone: f.properties?.tonez || 0,
        urlCount: f.properties?.urlcount || 0,
      }));

    return NextResponse.json(features);
  } catch (err) {
    console.error('Conflict API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
