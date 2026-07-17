import { NextRequest, NextResponse } from 'next/server';
import { inflateRawSync } from 'zlib';

// Conflict events from GDELT's raw 15-minute event exports. The hosted GEO
// API this route used to call was retired (404), and every alternative
// (UCDP, ReliefWeb, ACLED) now requires registration; the raw exports remain
// public and keyless. Events are filtered to QuadClass 4 (material conflict)
// with real coordinates. Response contract is unchanged.

export interface ConflictData {
  name: string;
  lat: number;
  lon: number;
  tone: number;
  urlCount: number;
}

// GDELT 2.0 event table column indexes
const COL = {
  eventRootCode: 28,
  quadClass: 29,
  numArticles: 33,
  avgTone: 34,
  actionGeoFullName: 52,
  actionGeoLat: 56,
  actionGeoLon: 57,
} as const;

let cache: { data: ConflictData[]; ts: number } | null = null;
const TTL = 10 * 60_000;

/**
 * Minimal single-entry ZIP extraction (GDELT exports are one deflated CSV):
 * parse the local file header at offset 0 and inflate the payload. Avoids a
 * zip dependency.
 */
function unzipSingle(buf: Buffer): Buffer {
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('not a zip');
  const method = buf.readUInt16LE(8);
  const compressedSize = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  const payload = buf.subarray(start, compressedSize > 0 ? start + compressedSize : undefined);
  if (method === 0) return Buffer.from(payload);
  if (method === 8) return inflateRawSync(payload);
  throw new Error(`unsupported zip method ${method}`);
}

export async function GET(request: NextRequest) {
  const maxPoints = Math.min(200, parseInt(request.nextUrl.searchParams.get('max') || '50', 10) || 50);

  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json(cache.data.slice(0, maxPoints));
  }

  try {
    const manifest = await fetch('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', {
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!manifest.ok) throw new Error(`manifest HTTP ${manifest.status}`);
    const exportUrl = (await manifest.text())
      .split('\n')
      .map(l => l.trim().split(/\s+/)[2])
      .find(u => u && u.includes('.export.CSV.zip'));
    if (!exportUrl) throw new Error('no export url in manifest');

    const zipRes = await fetch(exportUrl, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!zipRes.ok) throw new Error(`export HTTP ${zipRes.status}`);
    const csv = unzipSingle(Buffer.from(await zipRes.arrayBuffer())).toString('utf8');

    // Aggregate material-conflict events by location
    const byPlace = new Map<string, ConflictData & { toneSum: number; n: number }>();
    for (const line of csv.split('\n')) {
      if (!line) continue;
      const cols = line.split('\t');
      if (cols[COL.quadClass] !== '4') continue;
      const lat = parseFloat(cols[COL.actionGeoLat]);
      const lon = parseFloat(cols[COL.actionGeoLon]);
      if (isNaN(lat) || isNaN(lon)) continue;

      const name = cols[COL.actionGeoFullName] || 'Unknown location';
      const tone = parseFloat(cols[COL.avgTone]) || 0;
      const articles = parseInt(cols[COL.numArticles], 10) || 0;

      const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
      const existing = byPlace.get(key);
      if (existing) {
        existing.urlCount += articles;
        existing.toneSum += tone;
        existing.n += 1;
        existing.tone = existing.toneSum / existing.n;
      } else {
        byPlace.set(key, { name, lat, lon, tone, urlCount: articles, toneSum: tone, n: 1 });
      }
    }

    const events: ConflictData[] = [...byPlace.values()]
      .sort((a, b) => b.urlCount - a.urlCount)
      .map(({ name, lat, lon, tone, urlCount }) => ({ name, lat, lon, tone, urlCount }));

    cache = { data: events, ts: Date.now() };
    return NextResponse.json(events.slice(0, maxPoints));
  } catch (err) {
    console.error('Conflict API error:', err);
    if (cache) return NextResponse.json(cache.data.slice(0, maxPoints));
    return NextResponse.json({ error: 'Conflict data unavailable' }, { status: 502 });
  }
}
