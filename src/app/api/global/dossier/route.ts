import { NextResponse } from 'next/server';

// Region Dossier - right-click on map to get intelligence about a location
// Sources: Nominatim + REST Countries + Wikidata SPARQL + Wikipedia

// Rate limiter for Nominatim (1 req/sec)
let lastNominatimCall = 0;

async function reverseGeocode(lat: number, lng: number): Promise<any> {
  const now = Date.now();
  const elapsed = now - lastNominatimCall;
  if (elapsed < 1100) {
    await new Promise(resolve => setTimeout(resolve, 1100 - elapsed));
  }
  lastNominatimCall = Date.now();

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1&accept-language=en`,
    {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'CommandCenter/1.0' },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const addr = data.address || {};
  return {
    city: addr.city || addr.town || addr.village || addr.county || '',
    state: addr.state || addr.region || '',
    country: addr.country || '',
    countryCode: (addr.country_code || '').toUpperCase(),
    displayName: data.display_name || '',
  };
}

async function fetchCountryData(code: string): Promise<any> {
  if (!code) return null;
  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/alpha/${code}?fields=name,population,capital,languages,region,subregion,area,currencies,flag`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchWikidataLeader(countryName: string): Promise<{ leader: string; governmentType: string }> {
  if (!countryName) return { leader: 'Unknown', governmentType: 'Unknown' };
  const safeName = countryName.replace(/[\\"{}()\n\r\t]/g, c => `\\${c}`);
  const sparql = `SELECT ?leaderLabel ?govTypeLabel WHERE {
    ?country wdt:P31 wd:Q6256 ; rdfs:label "${safeName}"@en .
    OPTIONAL { ?country wdt:P35 ?leader . }
    OPTIONAL { ?country wdt:P122 ?govType . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 1`;

  try {
    const res = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`,
      { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'CommandCenter/1.0' } }
    );
    if (!res.ok) return { leader: 'Unknown', governmentType: 'Unknown' };
    const data = await res.json();
    const results = data.results?.bindings || [];
    if (results.length > 0) {
      return {
        leader: results[0].leaderLabel?.value || 'Unknown',
        governmentType: results[0].govTypeLabel?.value || 'Unknown',
      };
    }
  } catch {}
  return { leader: 'Unknown', governmentType: 'Unknown' };
}

async function fetchWikiSummary(placeName: string, countryName: string = ''): Promise<any> {
  if (!placeName) return null;
  const candidates = [placeName];
  if (countryName) candidates.push(`${placeName}, ${countryName}`);

  for (const name of candidates) {
    try {
      const slug = encodeURIComponent(name.replace(/ /g, '_'));
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.type !== 'disambiguation') {
        return {
          description: data.description || '',
          extract: data.extract || '',
          thumbnail: data.thumbnail?.source || '',
        };
      }
    } catch {}
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  // Step 1: Reverse geocode
  const geo = await reverseGeocode(lat, lng);
  if (!geo?.country) {
    return NextResponse.json({
      coordinates: { lat, lng },
      location: geo,
      country: null,
      local: null,
      note: 'Possibly international waters or uninhabited area',
    });
  }

  // Step 2: Parallel data fetches
  const [countryData, leaderData, localWiki] = await Promise.allSettled([
    fetchCountryData(geo.countryCode),
    fetchWikidataLeader(geo.country),
    fetchWikiSummary(geo.city || geo.state, geo.country),
  ]);

  const country = countryData.status === 'fulfilled' ? countryData.value : null;
  const leader = leaderData.status === 'fulfilled' ? leaderData.value : { leader: 'Unknown', governmentType: 'Unknown' };
  const local = localWiki.status === 'fulfilled' ? localWiki.value : null;

  const languages = country?.languages ? Object.values(country.languages) : [];
  const currencies: string[] = [];
  if (country?.currencies && typeof country.currencies === 'object') {
    for (const v of Object.values(country.currencies) as any[]) {
      if (v?.name) currencies.push(v.symbol ? `${v.name} (${v.symbol})` : v.name);
    }
  }

  return NextResponse.json({
    coordinates: { lat, lng },
    location: geo,
    country: {
      name: country?.name?.common || geo.country,
      officialName: country?.name?.official || '',
      leader: leader.leader,
      governmentType: leader.governmentType,
      population: country?.population || 0,
      capital: Array.isArray(country?.capital) ? country.capital[0] : 'Unknown',
      languages,
      currencies,
      region: country?.region || '',
      subregion: country?.subregion || '',
      areaKm2: country?.area || 0,
      flagEmoji: country?.flag || '',
    },
    local: local ? {
      name: geo.city,
      state: geo.state,
      description: local.description,
      summary: local.extract,
      thumbnail: local.thumbnail,
    } : null,
  });
}
