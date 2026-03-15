import { NextRequest, NextResponse } from 'next/server';
import { getWeatherKitToken } from '../weatherkit-token';

// WeatherKit conditionCode to human-readable label
function conditionLabel(code: string): string {
  const map: Record<string, string> = {
    Clear: 'Clear',
    MostlyClear: 'Mostly Clear',
    PartlyCloudy: 'Partly Cloudy',
    MostlyCloudy: 'Mostly Cloudy',
    Cloudy: 'Cloudy',
    Overcast: 'Overcast',
    Foggy: 'Foggy',
    Haze: 'Haze',
    Smoky: 'Smoky',
    Drizzle: 'Drizzle',
    HeavyDrizzle: 'Heavy Drizzle',
    Rain: 'Rain',
    HeavyRain: 'Heavy Rain',
    FreezingDrizzle: 'Freezing Drizzle',
    FreezingRain: 'Freezing Rain',
    Snow: 'Snow',
    HeavySnow: 'Heavy Snow',
    Sleet: 'Sleet',
    Flurries: 'Flurries',
    Blizzard: 'Blizzard',
    BlowingSnow: 'Blowing Snow',
    ScatteredThunderstorms: 'Scattered Storms',
    Thunderstorms: 'Thunderstorm',
    IsolatedThunderstorms: 'Iso. Storms',
    SevereThunderstorm: 'Severe Storm',
    StrongStorms: 'Strong Storms',
    Hail: 'Hail',
    Hurricane: 'Hurricane',
    TropicalStorm: 'Tropical Storm',
    Windy: 'Windy',
    Breezy: 'Breezy',
    BlowingDust: 'Blowing Dust',
    SunShowers: 'Sun Showers',
    WintryMix: 'Wintry Mix',
    SunFlurries: 'Sun Flurries',
  };
  return map[code] || code;
}

// UV index category
function uvCategory(uv: number): string {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very High';
  return 'Extreme';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  try {
    const token = await getWeatherKitToken();

    const now = new Date();
    const hourlyEnd = new Date(now.getTime() + 24 * 3600_000);

    const wkUrl = `https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}?dataSets=currentWeather,forecastHourly,forecastDaily&hourlyStart=${now.toISOString()}&hourlyEnd=${hourlyEnd.toISOString()}`;

    const res = await fetch(wkUrl, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[uv] WeatherKit ${res.status}: ${text}`);
      return NextResponse.json({ error: `WeatherKit returned ${res.status}` }, { status: 502 });
    }

    const wk = await res.json();

    const current = wk.currentWeather || {};
    const today = (wk.forecastDaily?.days || [])[0] || {};
    const hours = wk.forecastHourly?.hours || [];

    // Find peak UV from hourly forecast today
    let peakUV = today.uvIndexMax ?? current.uvIndex ?? 0;
    let peakUVTime: string | null = null;

    const todayDate = now.toISOString().slice(0, 10);
    let maxHourlyUV = 0;
    for (const h of hours) {
      const hDate = (h.forecastStart || '').slice(0, 10);
      if (hDate === todayDate && (h.uvIndex ?? 0) > maxHourlyUV) {
        maxHourlyUV = h.uvIndex;
        peakUVTime = h.forecastStart;
      }
    }
    if (maxHourlyUV > 0) {
      peakUV = maxHourlyUV;
    }

    const data = {
      uvIndex: current.uvIndex ?? 0,
      uvCategory: uvCategory(current.uvIndex ?? 0),
      peakUV,
      peakUVTime,
      condition: conditionLabel(current.conditionCode || 'Clear'),
      sunrise: today.sunrise || null,
      sunset: today.sunset || null,
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('[uv] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch UV data' },
      { status: 500 },
    );
  }
}
