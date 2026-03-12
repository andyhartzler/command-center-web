import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat') || '39.0997';
  const lon = request.nextUrl.searchParams.get('lon') || '-94.5786';

  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`;
    const res = await fetch(url, { next: { revalidate: 300 } });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch air quality data' }, { status: 502 });
    }

    const data = await res.json();
    const current = data.current;

    return NextResponse.json({
      aqi: current.us_aqi ?? null,
      pm2_5: current.pm2_5 ?? null,
      pm10: current.pm10 ?? null,
      ozone: current.ozone ?? null,
      co: current.carbon_monoxide ?? null,
      no2: current.nitrogen_dioxide ?? null,
      so2: current.sulphur_dioxide ?? null,
    });
  } catch (err) {
    console.error('[airquality] fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch air quality data' }, { status: 500 });
  }
}
