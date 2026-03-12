import { NextResponse } from 'next/server';

// NOAA Space Weather Prediction Center - free, no auth
const NOAA_SCALES_URL = 'https://services.swpc.noaa.gov/products/noaa-scales.json';
const NOAA_KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

let cache: { data: any; ts: number } | null = null;
const TTL = 300_000; // 5 minutes

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const [scalesRes, kpRes] = await Promise.allSettled([
      fetch(NOAA_SCALES_URL, { signal: AbortSignal.timeout(8000) }),
      fetch(NOAA_KP_URL, { signal: AbortSignal.timeout(8000) }),
    ]);

    let scales: any = null;
    if (scalesRes.status === 'fulfilled' && scalesRes.value.ok) {
      const data = await scalesRes.value.json();
      // data[0] is the current state, data[-1] is 24h prediction
      if (data && data[0]) {
        const current = data[0];
        scales = {
          radio_blackout: { scale: current.R?.Scale || 0, text: current.R?.Text || 'None' },
          solar_radiation: { scale: current.S?.Scale || 0, text: current.S?.Text || 'None' },
          geomagnetic_storm: { scale: current.G?.Scale || 0, text: current.G?.Text || 'None' },
          timestamp: current.DateStamp + ' ' + current.TimeStamp,
        };
      }
    }

    let kpIndex: number | null = null;
    if (kpRes.status === 'fulfilled' && kpRes.value.ok) {
      const data = await kpRes.value.json();
      // Last entry has the current Kp value
      if (data && data.length > 1) {
        const last = data[data.length - 1];
        kpIndex = parseFloat(last[1]) || null;
      }
    }

    const result = {
      scales,
      kp_index: kpIndex,
      status: scales ? 'ok' : 'partial',
    };

    cache = { data: result, ts: now };
    return NextResponse.json(result);
  } catch {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ scales: null, kp_index: null, status: 'error' }, { status: 502 });
  }
}
