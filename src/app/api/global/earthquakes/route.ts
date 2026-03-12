import { NextResponse } from 'next/server';

// USGS Earthquake API - free, no auth required
const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

let cache: { data: any; ts: number } | null = null;
const TTL = 120_000; // 2 minutes

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(USGS_URL, { next: { revalidate: 120 } });
    if (!res.ok) throw new Error(`USGS ${res.status}`);
    const geojson = await res.json();

    const earthquakes = (geojson.features || []).map((f: any) => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      url: f.properties.url,
      title: f.properties.title,
    }));

    cache = { data: earthquakes, ts: now };
    return NextResponse.json(earthquakes);
  } catch (e: any) {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json([], { status: 502 });
  }
}
