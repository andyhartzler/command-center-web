import { NextResponse } from 'next/server';

const LAYER = 'MODIS_Terra_CorrectedReflectance_TrueColor';
const TILE_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function GET() {
  const now = new Date();

  // Yesterday as default (today's imagery may not be available yet)
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const defaultDate = formatDate(yesterday);

  // Last 30 days
  const availableDates: string[] = [];
  for (let i = 1; i <= 30; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    availableDates.push(formatDate(d));
  }

  const tileUrl = `${TILE_BASE}/${LAYER}/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

  return NextResponse.json({
    tileUrl,
    availableDates,
    defaultDate,
    layer: LAYER,
  });
}
