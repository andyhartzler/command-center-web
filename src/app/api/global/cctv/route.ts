import { NextResponse } from 'next/server';

// Multi-source CCTV camera aggregator
// Sources: TfL (London), Singapore LTA, Austin TX, NYC DOT

let cache: { data: any; ts: number } | null = null;
const TTL = 600_000; // 10 minutes

interface Camera {
  id: string;
  source: string;
  lat: number;
  lng: number;
  name: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'mjpeg';
}

async function fetchTfLCameras(): Promise<Camera[]> {
  try {
    const res = await fetch('https://api.tfl.gov.uk/Place/Type/JamCam', {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item: any) => {
      let mediaUrl = '';
      for (const prop of item.additionalProperties || []) {
        if (prop.key === 'imageUrl') mediaUrl = prop.value;
      }
      return {
        id: `TFL-${item.id}`,
        source: 'TfL London',
        lat: item.lat,
        lng: item.lon,
        name: item.commonName || 'London Camera',
        mediaUrl,
        mediaType: 'image' as const,
      };
    }).filter((c: Camera) => c.lat && c.lng && c.mediaUrl);
  } catch {
    return [];
  }
}

async function fetchSingaporeCameras(): Promise<Camera[]> {
  try {
    const res = await fetch('https://api.data.gov.sg/v1/transport/traffic-images', {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const cameras: Camera[] = [];
    if (data.items?.[0]?.cameras) {
      for (const cam of data.items[0].cameras) {
        const loc = cam.location || {};
        if (loc.latitude && loc.longitude && cam.image) {
          cameras.push({
            id: `SGP-${cam.camera_id}`,
            source: 'Singapore LTA',
            lat: loc.latitude,
            lng: loc.longitude,
            name: `Camera ${cam.camera_id}`,
            mediaUrl: cam.image,
            mediaType: 'image',
          });
        }
      }
    }
    return cameras;
  } catch {
    return [];
  }
}

async function fetchAustinCameras(): Promise<Camera[]> {
  try {
    const res = await fetch('https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=500', {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter((item: any) => item.location?.coordinates?.length === 2 && item.camera_id)
      .map((item: any) => ({
        id: `ATX-${item.camera_id}`,
        source: 'Austin TxDOT',
        lat: item.location.coordinates[1],
        lng: item.location.coordinates[0],
        name: item.location_name || 'Austin Camera',
        mediaUrl: `https://cctv.austinmobility.io/image/${item.camera_id}.jpg`,
        mediaType: 'image' as const,
      }));
  } catch {
    return [];
  }
}

async function fetchNYCCameras(): Promise<Camera[]> {
  try {
    const res = await fetch('https://webcams.nyctmc.org/api/cameras', {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter((item: any) => item.latitude && item.longitude)
      .map((item: any) => ({
        id: `NYC-${item.id}`,
        source: 'NYC DOT',
        lat: item.latitude,
        lng: item.longitude,
        name: item.name || 'NYC Camera',
        mediaUrl: `https://webcams.nyctmc.org/api/cameras/${item.id}/image`,
        mediaType: 'image' as const,
      }));
  } catch {
    return [];
  }
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  const [tfl, sgp, atx, nyc] = await Promise.allSettled([
    fetchTfLCameras(),
    fetchSingaporeCameras(),
    fetchAustinCameras(),
    fetchNYCCameras(),
  ]);

  const cameras: Camera[] = [
    ...(tfl.status === 'fulfilled' ? tfl.value : []),
    ...(sgp.status === 'fulfilled' ? sgp.value : []),
    ...(atx.status === 'fulfilled' ? atx.value : []),
    ...(nyc.status === 'fulfilled' ? nyc.value : []),
  ];

  const result = {
    cameras,
    total: cameras.length,
    sources: {
      tfl: tfl.status === 'fulfilled' ? tfl.value.length : 0,
      singapore: sgp.status === 'fulfilled' ? sgp.value.length : 0,
      austin: atx.status === 'fulfilled' ? atx.value.length : 0,
      nyc: nyc.status === 'fulfilled' ? nyc.value.length : 0,
    },
  };

  cache = { data: result, ts: now };
  return NextResponse.json(result);
}
