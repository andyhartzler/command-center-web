import { NextRequest, NextResponse } from 'next/server';
import { parseRSS } from '@/lib/rss';

// GET /api/feeds?urls=<comma-separated feed urls>
// Parses real RSS/Atom feeds (plus the CISA KEV JSON catalog) into a single
// merged, date-sorted list. Each feed is isolated: one dead feed never
// blanks the list.

interface FeedItem {
  title: string;
  description: string;
  date: string;
  source: string;
  link: string;
}

interface KevVulnerability {
  cveID?: string;
  vulnerabilityName?: string;
  shortDescription?: string;
  dateAdded?: string;
}

const PER_FEED_LIMIT = 20;

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Fetch and parse a single feed. Never throws.
async function fetchFeed(url: string): Promise<FeedItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CommandCenter/1.0 RSS Reader',
          Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, application/json, */*',
        },
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        console.warn(`[feeds] ${sourceLabel(url)} returned ${res.status}`);
        return [];
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (url.endsWith('.json') || contentType.includes('json')) {
        // CISA Known Exploited Vulnerabilities catalog
        const data = (await res.json()) as { vulnerabilities?: KevVulnerability[] };
        if (!Array.isArray(data.vulnerabilities)) return [];
        return data.vulnerabilities
          .filter(v => v.vulnerabilityName)
          .sort((a, b) => new Date(b.dateAdded ?? 0).getTime() - new Date(a.dateAdded ?? 0).getTime())
          .slice(0, PER_FEED_LIMIT)
          .map(v => ({
            title: `CISA KEV: ${v.vulnerabilityName}`,
            description: v.shortDescription ?? '',
            date: v.dateAdded ? new Date(v.dateAdded).toISOString() : new Date().toISOString(),
            source: 'CISA KEV',
            link: v.cveID ? `https://nvd.nist.gov/vuln/detail/${v.cveID}` : url,
          }));
      }

      const xml = await res.text();
      const source = sourceLabel(url);
      return parseRSS(xml, source, 'feed')
        .slice(0, PER_FEED_LIMIT)
        .map(article => ({
          title: article.title,
          description: article.snippet,
          date: article.pubDate,
          source,
          link: article.link,
        }));
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.warn(`[feeds] Failed to fetch ${sourceLabel(url)}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const urlsParam = request.nextUrl.searchParams.get('urls');

  if (!urlsParam) {
    return NextResponse.json({ items: [], fetchedAt: new Date().toISOString() });
  }

  const urls = urlsParam.split(',').map(u => u.trim()).filter(Boolean);

  // Per-feed isolation: fetchFeed never throws, so one dead feed only
  // contributes an empty array.
  const results = await Promise.all(urls.map(fetchFeed));
  const items = results
    .flat()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ items, fetchedAt: new Date().toISOString() });
}
