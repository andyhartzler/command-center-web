import { NextRequest, NextResponse } from 'next/server';
import { parseRSS, type Article } from '@/lib/rss';

// ---------------------------------------------------------------------------
// Default feed definitions
// ---------------------------------------------------------------------------

interface FeedDef {
  url: string;
  source: string;
  category: string;
}

const LOCAL_FEEDS: FeedDef[] = [
  { url: 'https://www.kshb.com/news/local-news.rss', source: 'KSHB', category: 'local' },
  { url: 'https://www.kmbc.com/topstories-rss', source: 'KMBC', category: 'local' },
  { url: 'https://www.kansascity.com/latest-news/article742801.ece/BINARY/rss', source: 'KC Star', category: 'local' },
];

const WORLD_FEEDS: FeedDef[] = [
  { url: 'https://feeds.reuters.com/reuters/topNews', source: 'Reuters', category: 'world' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC', category: 'world' },
  { url: 'https://feeds.npr.org/1001/rss.xml', source: 'NPR', category: 'us' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera', category: 'world' },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'Ars Technica', category: 'tech' },
  { url: 'https://techcrunch.com/feed/', source: 'TechCrunch', category: 'tech' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', source: 'CNBC', category: 'finance' },
];

// ---------------------------------------------------------------------------
// Fetch a single feed, return parsed articles (never throws)
// ---------------------------------------------------------------------------

async function fetchFeed(def: FeedDef): Promise<Article[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(def.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CommandCenter/1.0 RSS Reader',
        Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
      next: { revalidate: 300 }, // Next.js fetch cache: 5 min
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[news] Feed ${def.source} returned ${res.status}`);
      return [];
    }

    const xml = await res.text();
    return parseRSS(xml, def.source, def.category);
  } catch (err) {
    console.warn(`[news] Failed to fetch ${def.source}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Deduplicate by normalised title
// ---------------------------------------------------------------------------

function deduplicateArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const result: Article[] = [];

  for (const article of articles) {
    const key = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Route handler — GET /api/news
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Determine which feeds to use
  const type = searchParams.get('type'); // 'local' | 'world'
  const feedsParam = searchParams.get('feeds');
  const sourcesParam = searchParams.get('sources');
  const categoriesParam = searchParams.get('categories');

  let feedDefs: FeedDef[] = [];

  if (feedsParam) {
    // Custom feeds passed as query params
    const urls = feedsParam.split(',');
    const sources = sourcesParam ? sourcesParam.split(',') : urls.map(() => 'Custom');
    const categories = categoriesParam ? categoriesParam.split(',') : urls.map(() => 'general');

    feedDefs = urls.map((url, i) => ({
      url: url.trim(),
      source: (sources[i] || 'Custom').trim(),
      category: (categories[i] || 'general').trim(),
    }));
  } else if (type === 'local') {
    feedDefs = LOCAL_FEEDS;
  } else if (type === 'world') {
    feedDefs = WORLD_FEEDS;
  } else {
    // Default: all feeds
    feedDefs = [...LOCAL_FEEDS, ...WORLD_FEEDS];
  }

  // Fetch all feeds concurrently
  const results = await Promise.all(feedDefs.map(fetchFeed));
  const allArticles = results.flat();

  // Deduplicate
  const unique = deduplicateArticles(allArticles);

  // Sort by publication date descending (newest first)
  unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return NextResponse.json({
    articles: unique,
    feedCount: feedDefs.length,
    totalArticles: unique.length,
    fetchedAt: new Date().toISOString(),
  });
}
