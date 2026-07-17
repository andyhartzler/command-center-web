import { NextRequest, NextResponse } from 'next/server';
import { getWeatherKitToken } from '../weatherkit-token';

// Apple WeatherKit conditionCode -> WMO weather code
function conditionToWMO(condition: string): number {
  const map: Record<string, number> = {
    Clear: 0,
    MostlyClear: 1,
    PartlyCloudy: 2,
    MostlyCloudy: 3,
    Cloudy: 3,
    Overcast: 3,
    Foggy: 45,
    Haze: 48,
    Smoky: 48,
    Drizzle: 51,
    HeavyDrizzle: 55,
    Rain: 61,
    HeavyRain: 65,
    FreezingDrizzle: 56,
    FreezingRain: 66,
    Snow: 71,
    HeavySnow: 75,
    Sleet: 77,
    Flurries: 71,
    Blizzard: 75,
    BlowingSnow: 75,
    ScatteredThunderstorms: 95,
    Thunderstorms: 95,
    IsolatedThunderstorms: 95,
    SevereThunderstorm: 96,
    StrongStorms: 96,
    Hail: 99,
    Hurricane: 99,
    TropicalStorm: 82,
    Windy: 3,
    Breezy: 2,
    BlowingDust: 48,
    SunShowers: 80,
    WintryMix: 66,
    SunFlurries: 71,
  };
  return map[condition] ?? 3;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const units = searchParams.get('units') || 'fahrenheit';

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  try {
    const token = await getWeatherKitToken();

    const wkUrl = `https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}?dataSets=currentWeather,forecastHourly,forecastDaily&hourlyStart=${new Date().toISOString()}&hourlyEnd=${new Date(Date.now() + 48 * 3600_000).toISOString()}`;

    const res = await fetch(wkUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[weather] WeatherKit ${res.status}: ${text}`);
      return NextResponse.json(
        { error: `WeatherKit returned ${res.status}` },
        { status: 502 },
      );
    }

    const wk = await res.json();

    // Transform WeatherKit response to match the format the widget expects
    // (same shape as Open-Meteo so the widget doesn't need changes)
    const isFahrenheit = units !== 'celsius';
    const toUnit = (c: number) => isFahrenheit ? (c * 9) / 5 + 32 : c;
    // WeatherKit wind speeds are km/h; serve mph alongside fahrenheit
    const toWindUnit = (kmh: number) => isFahrenheit ? kmh * 0.621371 : kmh;

    const currentWeather = wk.currentWeather || {};
    const hourlyForecast = wk.forecastHourly?.hours || [];
    const dailyForecast = wk.forecastDaily?.days || [];

    const data = {
      current: {
        temperature_2m: Math.round(toUnit(currentWeather.temperature ?? 0) * 10) / 10,
        weather_code: conditionToWMO(currentWeather.conditionCode || 'Clear'),
        wind_speed_10m: Math.round(toWindUnit(currentWeather.windSpeed ?? 0) * 10) / 10,
      },
      hourly: {
        time: hourlyForecast.map((h: { forecastStart: string }) => h.forecastStart),
        temperature_2m: hourlyForecast.map((h: { temperature: number }) =>
          Math.round(toUnit(h.temperature ?? 0) * 10) / 10
        ),
        weather_code: hourlyForecast.map((h: { conditionCode: string }) =>
          conditionToWMO(h.conditionCode || 'Clear')
        ),
        precipitation_probability: hourlyForecast.map((h: { precipitationChance?: number }) =>
          Math.round((h.precipitationChance ?? 0) * 100)
        ),
      },
      daily: {
        temperature_2m_max: dailyForecast.map((d: { temperatureMax: number }) =>
          Math.round(toUnit(d.temperatureMax ?? 0) * 10) / 10
        ),
        temperature_2m_min: dailyForecast.map((d: { temperatureMin: number }) =>
          Math.round(toUnit(d.temperatureMin ?? 0) * 10) / 10
        ),
        sunrise: dailyForecast.map((d: { sunrise?: string }) => d.sunrise ?? null),
        sunset: dailyForecast.map((d: { sunset?: string }) => d.sunset ?? null),
      },
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('[weather] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch weather' },
      { status: 500 },
    );
  }
}
