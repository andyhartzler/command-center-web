import { NextResponse } from 'next/server';

// Carrier Strike Group OSINT Tracker
// Sources: GDELT News API + static fallback positions

interface CarrierInfo {
  hull: string;
  name: string;
  homeport: string;
  homeportLat: number;
  homeportLng: number;
  fallbackLat: number;
  fallbackLng: number;
  fallbackHeading: number;
  fallbackDesc: string;
  wiki: string;
}

const CARRIER_REGISTRY: CarrierInfo[] = [
  { hull: 'CVN-68', name: 'USS Nimitz', homeport: 'Bremerton, WA', homeportLat: 47.56, homeportLng: -122.63, fallbackLat: 21.35, fallbackLng: -157.95, fallbackHeading: 270, fallbackDesc: 'Pacific Fleet / Pearl Harbor', wiki: 'https://en.wikipedia.org/wiki/USS_Nimitz' },
  { hull: 'CVN-69', name: 'USS Dwight D. Eisenhower', homeport: 'Norfolk, VA', homeportLat: 36.95, homeportLng: -76.33, fallbackLat: 18.0, fallbackLng: 39.5, fallbackHeading: 120, fallbackDesc: 'Red Sea / CENTCOM AOR', wiki: 'https://en.wikipedia.org/wiki/USS_Dwight_D._Eisenhower' },
  { hull: 'CVN-70', name: 'USS Carl Vinson', homeport: 'San Diego, CA', homeportLat: 32.68, homeportLng: -117.15, fallbackLat: 15.0, fallbackLng: 115.0, fallbackHeading: 45, fallbackDesc: 'South China Sea patrol', wiki: 'https://en.wikipedia.org/wiki/USS_Carl_Vinson' },
  { hull: 'CVN-71', name: 'USS Theodore Roosevelt', homeport: 'San Diego, CA', homeportLat: 32.68, homeportLng: -117.15, fallbackLat: 22.0, fallbackLng: 122.0, fallbackHeading: 300, fallbackDesc: 'Philippine Sea / Taiwan Strait', wiki: 'https://en.wikipedia.org/wiki/USS_Theodore_Roosevelt_(CVN-71)' },
  { hull: 'CVN-72', name: 'USS Abraham Lincoln', homeport: 'San Diego, CA', homeportLat: 32.68, homeportLng: -117.15, fallbackLat: 21.0, fallbackLng: -158.0, fallbackHeading: 270, fallbackDesc: 'Pacific deployment', wiki: 'https://en.wikipedia.org/wiki/USS_Abraham_Lincoln_(CVN-72)' },
  { hull: 'CVN-73', name: 'USS George Washington', homeport: 'Yokosuka, Japan', homeportLat: 35.28, homeportLng: 139.67, fallbackLat: 35.0, fallbackLng: 139.0, fallbackHeading: 0, fallbackDesc: 'Yokosuka, Japan (Forward deployed)', wiki: 'https://en.wikipedia.org/wiki/USS_George_Washington_(CVN-73)' },
  { hull: 'CVN-74', name: 'USS John C. Stennis', homeport: 'Norfolk, VA', homeportLat: 36.95, homeportLng: -76.33, fallbackLat: 36.95, fallbackLng: -76.33, fallbackHeading: 0, fallbackDesc: 'RCOH / Norfolk (maintenance)', wiki: 'https://en.wikipedia.org/wiki/USS_John_C._Stennis' },
  { hull: 'CVN-75', name: 'USS Harry S. Truman', homeport: 'Norfolk, VA', homeportLat: 36.95, homeportLng: -76.33, fallbackLat: 36.0, fallbackLng: 15.0, fallbackHeading: 90, fallbackDesc: 'Mediterranean deployment', wiki: 'https://en.wikipedia.org/wiki/USS_Harry_S._Truman' },
  { hull: 'CVN-76', name: 'USS Ronald Reagan', homeport: 'Bremerton, WA', homeportLat: 47.56, homeportLng: -122.63, fallbackLat: 47.56, fallbackLng: -122.63, fallbackHeading: 0, fallbackDesc: 'Bremerton, WA (Homeport)', wiki: 'https://en.wikipedia.org/wiki/USS_Ronald_Reagan' },
  { hull: 'CVN-77', name: 'USS George H.W. Bush', homeport: 'Norfolk, VA', homeportLat: 36.95, homeportLng: -76.33, fallbackLat: 36.95, fallbackLng: -76.33, fallbackHeading: 0, fallbackDesc: 'Norfolk, VA (Homeport)', wiki: 'https://en.wikipedia.org/wiki/USS_George_H.W._Bush' },
  { hull: 'CVN-78', name: 'USS Gerald R. Ford', homeport: 'Norfolk, VA', homeportLat: 36.95, homeportLng: -76.33, fallbackLat: 34.0, fallbackLng: 25.0, fallbackHeading: 90, fallbackDesc: 'Eastern Mediterranean deterrence', wiki: 'https://en.wikipedia.org/wiki/USS_Gerald_R._Ford' },
];

const REGION_COORDS: Record<string, [number, number]> = {
  'eastern mediterranean': [34.0, 25.0], 'mediterranean': [36.0, 15.0],
  'red sea': [18.0, 39.5], 'arabian sea': [16.0, 64.0], 'persian gulf': [26.5, 51.5],
  'south china sea': [15.0, 115.0], 'philippine sea': [20.0, 130.0],
  'sea of japan': [40.0, 135.0], 'taiwan strait': [24.0, 119.5],
  'western pacific': [20.0, 140.0], 'pacific': [20.0, -150.0],
  'indian ocean': [-5.0, 70.0], 'north atlantic': [40.0, -40.0],
  'gulf of aden': [12.5, 45.0], 'horn of africa': [10.0, 50.0],
  'strait of hormuz': [26.5, 56.3], 'baltic sea': [57.0, 18.0],
  'caribbean': [15.0, -75.0], 'gulf of mexico': [25.0, -90.0],
  'norfolk': [36.95, -76.33], 'san diego': [32.68, -117.15],
  'yokosuka': [35.28, 139.67], 'pearl harbor': [21.35, -157.95],
  'guam': [13.45, 144.79], 'bahrain': [26.23, 50.55],
};

let cache: { data: any; ts: number } | null = null;
const TTL = 3600_000; // 1 hour

function matchRegion(text: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [region, coords] of Object.entries(REGION_COORDS).sort((a, b) => b[0].length - a[0].length)) {
    if (lower.includes(region)) return coords;
  }
  return null;
}

function matchCarrier(text: string): string | null {
  const lower = text.toLowerCase();
  for (const c of CARRIER_REGISTRY) {
    // Match hull number (e.g., CVN-68)
    if (lower.includes(c.hull.toLowerCase()) || lower.includes(c.hull.toLowerCase().replace('-', ''))) return c.hull;
    // Match full ship name with "USS" context to reduce false positives
    const lastName = c.name.split(' ').pop()?.toLowerCase() || '';
    if (lastName.length > 4 && lower.includes('uss') && lower.includes(lastName)) return c.hull;
    // Match full carrier name
    const fullName = c.name.toLowerCase();
    if (fullName.length > 8 && lower.includes(fullName)) return c.hull;
  }
  return null;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  // Start with fallback positions
  const positions: Record<string, any> = {};
  for (const c of CARRIER_REGISTRY) {
    positions[c.hull] = {
      hull: c.hull,
      name: c.name,
      lat: c.fallbackLat,
      lng: c.fallbackLng,
      heading: c.fallbackHeading,
      desc: c.fallbackDesc,
      wiki: c.wiki,
      homeport: c.homeport,
      source: 'Static OSINT estimate',
      estimated: true,
    };
  }

  // Try GDELT for fresh positioning intel
  const searchTerms = [
    'aircraft+carrier+deployed', 'carrier+strike+group+navy',
    'USS+Nimitz+carrier', 'USS+Ford+carrier', 'USS+Eisenhower+carrier',
    'USS+Vinson+carrier', 'USS+Roosevelt+carrier+navy',
    'USS+Lincoln+carrier', 'USS+Truman+carrier',
  ];

  try {
    const results = await Promise.allSettled(
      searchTerms.slice(0, 4).map(term =>
        fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${term}&mode=artlist&maxrecords=5&format=json&timespan=14d`, {
          signal: AbortSignal.timeout(8000),
        }).then(r => r.ok ? r.json() : null)
      )
    );

    for (const r of results) {
      if (r.status !== 'fulfilled' || !r.value?.articles) continue;
      for (const art of r.value.articles) {
        const title = art.title || '';
        const hull = matchCarrier(title);
        if (!hull) continue;
        const coords = matchRegion(title);
        if (!coords) continue;
        if (positions[hull]?.source === 'GDELT OSINT') continue; // first match wins
        positions[hull] = {
          ...positions[hull],
          lat: coords[0],
          lng: coords[1],
          desc: title.slice(0, 100),
          source: 'GDELT OSINT',
          estimated: true,
        };
      }
    }
  } catch {}

  const result = Object.values(positions);
  cache = { data: result, ts: now };
  return NextResponse.json(result);
}
