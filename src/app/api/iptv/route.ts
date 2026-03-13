import { NextRequest, NextResponse } from 'next/server';

interface IPTVChannel {
  name: string;
  url: string;
  logo: string;
  country: string;
  group: string;
}

let cachedChannels: IPTVChannel[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 3600_000; // 1 hour

async function fetchAndParsePlaylist(): Promise<IPTVChannel[]> {
  const now = Date.now();
  if (cachedChannels && now - cacheTimestamp < CACHE_DURATION) {
    return cachedChannels;
  }

  const res = await fetch(
    'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error('Failed to fetch IPTV playlist');

  const text = await res.text();
  const lines = text.split('\n');
  const channels: IPTVChannel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXTINF:')) continue;

    // Parse EXTINF line
    const nameMatch = line.match(/,(.+)$/);
    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
    const countryMatch = line.match(/tvg-country="([^"]*)"/);
    const groupMatch = line.match(/group-title="([^"]*)"/);

    const name = nameMatch?.[1]?.trim() || '';
    const logo = logoMatch?.[1] || '';
    const country = countryMatch?.[1] || '';
    const group = groupMatch?.[1] || '';

    // Next non-empty, non-comment line is the URL
    let url = '';
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j].trim();
      if (nextLine && !nextLine.startsWith('#')) {
        url = nextLine;
        break;
      }
    }

    if (name && url) {
      channels.push({ name, url, logo, country, group });
    }
  }

  cachedChannels = channels;
  cacheTimestamp = now;
  return channels;
}

export async function GET(request: NextRequest) {
  try {
    const channels = await fetchAndParsePlaylist();

    const search = request.nextUrl.searchParams.get('search')?.toLowerCase() || '';
    const country = request.nextUrl.searchParams.get('country') || '';

    let filtered = channels;

    if (country && !search) {
      // Only apply country filter when not searching (search is global)
      filtered = filtered.filter(ch =>
        ch.group.toLowerCase() === country.toLowerCase() ||
        ch.country.toLowerCase() === country.toLowerCase()
      );
    }

    if (search) {
      // When searching, search across all countries but prioritize current country
      filtered = filtered.filter(ch =>
        ch.name.toLowerCase().includes(search) ||
        ch.group.toLowerCase().includes(search) ||
        ch.country.toLowerCase().includes(search)
      );
    }

    // Also return list of unique countries for the filter
    const countries = [...new Set(channels.map(ch => ch.group))].filter(Boolean).sort();

    return NextResponse.json({
      channels: filtered.slice(0, 200), // Limit response size
      total: filtered.length,
      countries,
    });
  } catch (err) {
    console.error('[iptv] fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch IPTV channels' }, { status: 500 });
  }
}
