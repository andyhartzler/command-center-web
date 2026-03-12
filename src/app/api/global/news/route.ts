import { NextResponse } from 'next/server';

// GDELT-style global security news via RSS feeds
const FEEDS: { name: string; url: string; weight: number }[] = [
  { name: 'GDACS', url: 'https://www.gdacs.org/xml/rss.xml', weight: 5 },
  { name: 'Reuters World', url: 'https://feeds.reuters.com/Reuters/worldNews', weight: 4 },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', weight: 3 },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', weight: 3 },
  { name: 'AP Top News', url: 'https://rsshub.app/apnews/topics/apf-topnews', weight: 4 },
  { name: 'Defense News', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml', weight: 5 },
];

const KEYWORD_COORDS: Record<string, [number, number]> = {
  'ukraine': [49.487, 31.272], 'kyiv': [50.450, 30.523],
  'russia': [61.524, 105.318], 'moscow': [55.755, 37.617],
  'israel': [31.046, 34.851], 'gaza': [31.416, 34.333],
  'iran': [32.427, 53.688], 'syria': [34.802, 38.996],
  'yemen': [15.552, 48.516], 'china': [35.861, 104.195],
  'taiwan': [23.697, 120.960], 'north korea': [40.339, 127.510],
  'south korea': [35.907, 127.766], 'japan': [36.204, 138.252],
  'pakistan': [30.375, 69.345], 'india': [20.593, 78.962],
  'sudan': [12.862, 30.217], 'congo': [-4.038, 21.758],
  'nigeria': [9.082, 8.675], 'egypt': [26.820, 30.802],
  'libya': [26.335, 17.228], 'somalia': [5.152, 46.199],
  'ethiopia': [9.145, 40.489], 'lebanon': [33.854, 35.862],
  'afghanistan': [33.939, 67.709], 'mexico': [23.634, -102.552],
  'venezuela': [7.119, -66.589], 'brazil': [-14.235, -51.925],
  'united states': [38.907, -77.036], 'washington': [38.907, -77.036],
  'europe': [48.800, 2.300], 'middle east': [31.500, 34.800],
  'africa': [0.000, 25.000], 'asia': [34.000, 100.000],
};

const RISK_KEYWORDS = ['war', 'missile', 'strike', 'attack', 'crisis', 'military', 'conflict', 'nuclear', 'explosion', 'bomb', 'drone', 'invasion', 'sanctions', 'terror'];

let cache: { data: any; ts: number } | null = null;
const TTL = 180_000; // 3 minutes

// Simple XML parsing without external deps
function parseRSSItems(xml: string): { title: string; link: string; pubDate: string; summary: string }[] {
  const items: { title: string; link: string; pubDate: string; summary: string }[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1] || '').trim();
    const link = (block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1] || '').trim();
    const pubDate = (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] || '').trim();
    const desc = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1] || '').trim();
    if (title) items.push({ title, link, pubDate, summary: desc.replace(/<[^>]+>/g, '').slice(0, 200) });
  }
  return items;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < TTL) {
    return NextResponse.json(cache.data);
  }

  const allArticles: any[] = [];

  const feedResults = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRSSItems(xml).slice(0, 8).map(item => ({ ...item, source: feed.name, weight: feed.weight }));
      } catch {
        return [];
      }
    })
  );

  for (const result of feedResults) {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value);
    }
  }

  // Score and geolocate
  const news = allArticles.map(article => {
    const text = (article.title + ' ' + article.summary).toLowerCase();
    let riskScore = 1;
    for (const kw of RISK_KEYWORDS) {
      if (text.includes(kw)) riskScore += 2;
    }
    riskScore = Math.min(10, riskScore);

    let lat = null, lng = null;
    for (const [keyword, coords] of Object.entries(KEYWORD_COORDS)) {
      if (text.includes(keyword)) {
        [lat, lng] = coords;
        break;
      }
    }

    return {
      title: article.title,
      link: article.link,
      published: article.pubDate,
      source: article.source,
      summary: article.summary,
      risk_score: riskScore,
      coords: lat !== null ? [lat, lng] : null,
    };
  });

  news.sort((a, b) => b.risk_score - a.risk_score);
  const result = news.slice(0, 50);

  cache = { data: result, ts: now };
  return NextResponse.json(result);
}
