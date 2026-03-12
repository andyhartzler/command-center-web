import { NextResponse } from 'next/server';

// Radio Intercept: Broadcastify Top 50 live feeds
let cache: { data: any; ts: number } | null = null;
const TTL = 300_000; // 5 minutes

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch('https://www.broadcastify.com/listen/top', {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
      },
    });

    if (!res.ok) {
      if (cache) return NextResponse.json(cache.data);
      return NextResponse.json({ feeds: [], total: 0 }, { status: 502 });
    }

    const html = await res.text();

    // Parse the HTML table
    const feeds: any[] = [];
    const tableMatch = html.match(/<table[^>]*class="[^"]*btable[^"]*"[^>]*>([\s\S]*?)<\/table>/);
    if (tableMatch) {
      const rows = tableMatch[1].match(/<tr[\s\S]*?<\/tr>/g) || [];
      for (let i = 1; i < rows.length; i++) { // skip header row
        const cols = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
        if (cols.length >= 4) {
          const strip = (h: string) => h.replace(/<[^>]*>/g, '').trim();

          const listeners = parseInt(strip(cols[0] || '').replace(/,/g, '')) || 0;
          const location = strip(cols[1] || '');

          // Extract feed ID and name from link
          const col2 = cols[2] || '';
          const linkMatch = col2.match(/href=['"]\/listen\/feed\/(\d+)['"]/);
          const feedId = linkMatch ? linkMatch[1] : null;
          const name = strip(col2);
          const category = strip(cols[3] || '');

          if (feedId) {
            feeds.push({
              id: feedId,
              listeners,
              location,
              name,
              category,
              streamUrl: `https://broadcastify.cdnstream1.com/${feedId}`,
            });
          }
        }
      }
    }

    const result = { feeds, total: feeds.length };
    cache = { data: result, ts: now };
    return NextResponse.json(result);
  } catch {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ feeds: [], total: 0 }, { status: 502 });
  }
}
