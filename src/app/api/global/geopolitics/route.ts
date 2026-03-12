import { NextResponse } from 'next/server';

// Geopolitical data: Ukraine frontlines + GDELT military incidents

let cache: { data: any; ts: number } | null = null;
const TTL = 300_000; // 5 minutes

// GDELT conflict event codes (CAMEO taxonomy)
const CONFLICT_CODES = new Set(['14', '17', '18', '19', '20']);
// 14=Protest, 17=Coerce, 18=Assault, 19=Fight, 20=Use unconventional mass violence

async function fetchUkraineFrontlines(): Promise<any> {
  try {
    // DeepStateMap maintains GeoJSON on GitHub
    const res = await fetch(
      'https://api.github.com/repos/cyterat/deepstate-map-data/git/trees/main',
      {
        signal: AbortSignal.timeout(10000),
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CommandCenter/1.0' },
      }
    );
    if (!res.ok) return null;
    const tree = await res.json();

    // Find the latest GeoJSON file
    const geoFiles = (tree.tree || [])
      .filter((f: any) => f.path?.endsWith('.geojson') && f.path?.includes('deep'))
      .sort((a: any, b: any) => b.path.localeCompare(a.path));

    if (geoFiles.length === 0) {
      // Try direct raw fetch of known path
      const rawRes = await fetch(
        'https://raw.githubusercontent.com/cyterat/deepstate-map-data/main/deepstatemap_geojson.json',
        { signal: AbortSignal.timeout(10000) }
      );
      if (rawRes.ok) {
        return await rawRes.json();
      }
      return null;
    }

    const rawUrl = `https://raw.githubusercontent.com/cyterat/deepstate-map-data/main/${geoFiles[0].path}`;
    const rawRes = await fetch(rawUrl, { signal: AbortSignal.timeout(10000) });
    if (rawRes.ok) return await rawRes.json();
    return null;
  } catch {
    return null;
  }
}

async function fetchGDELTMilitaryIncidents(): Promise<any[]> {
  try {
    // GDELT 2.0 exports are updated every 15 minutes
    const listRes = await fetch('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', {
      signal: AbortSignal.timeout(8000),
    });
    if (!listRes.ok) return [];

    const listText = await listRes.text();
    const lines = listText.trim().split('\n');

    // Find export file URLs (not mentions or gkg)
    const exportUrls: string[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const url = parts[parts.length - 1];
      if (url?.includes('.export.') && url?.endsWith('.zip')) {
        exportUrls.push(url);
      }
    }

    if (exportUrls.length === 0) return [];

    // Fetch the latest export (it's a ZIP with a TSV inside)
    // For simplicity, use the GDELT Doc API instead for recent conflict events
    const incidents: any[] = [];

    const queries = [
      'military+attack+conflict',
      'missile+strike+war',
      'bombing+assault+combat',
    ];

    const results = await Promise.allSettled(
      queries.map(q =>
        fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=15&format=json&timespan=24h&sourcelang=eng`, {
          signal: AbortSignal.timeout(8000),
        }).then(r => r.ok ? r.json() : null)
      )
    );

    const seen = new Set<string>();
    for (const r of results) {
      if (r.status !== 'fulfilled' || !r.value?.articles) continue;
      for (const art of r.value.articles) {
        const url = art.url || '';
        if (seen.has(url)) continue;
        seen.add(url);

        // Try to get location from article
        let lat: number | null = null;
        let lng: number | null = null;
        if (art.sourcecountry) {
          const coords = COUNTRY_COORDS[art.sourcecountry.toLowerCase()];
          if (coords) {
            lat = coords[0];
            lng = coords[1];
          }
        }

        incidents.push({
          title: art.title || '',
          url: art.url || '',
          source: art.domain || '',
          seendate: art.seendate || '',
          language: art.language || 'English',
          lat,
          lng,
        });
      }
    }

    return incidents;
  } catch {
    return [];
  }
}

// Country code → approximate center coords for geo-locating GDELT articles
const COUNTRY_COORDS: Record<string, [number, number]> = {
  ukraine: [48.4, 31.2], russia: [55.8, 37.6], israel: [31.8, 35.2],
  palestine: [31.9, 35.2], syria: [34.8, 38.0], iraq: [33.2, 44.4],
  iran: [32.4, 53.7], yemen: [15.4, 44.2], lebanon: [33.9, 35.5],
  china: [35.9, 104.2], taiwan: [23.7, 121.0], 'north korea': [40.3, 127.5],
  'south korea': [35.9, 127.8], india: [20.6, 79.0], pakistan: [30.4, 69.3],
  afghanistan: [33.9, 67.7], myanmar: [19.8, 96.2], sudan: [15.5, 32.6],
  ethiopia: [9.0, 38.7], somalia: [5.2, 46.2], libya: [26.3, 17.2],
  nigeria: [9.1, 7.5], mali: [12.6, -8.0], 'united states': [38.9, -77.0],
};

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  const [frontlines, incidents] = await Promise.allSettled([
    fetchUkraineFrontlines(),
    fetchGDELTMilitaryIncidents(),
  ]);

  const result = {
    frontlines: frontlines.status === 'fulfilled' ? frontlines.value : null,
    incidents: incidents.status === 'fulfilled' ? incidents.value : [],
    incidentCount: incidents.status === 'fulfilled' ? incidents.value.length : 0,
  };

  cache = { data: result, ts: now };
  return NextResponse.json(result);
}
