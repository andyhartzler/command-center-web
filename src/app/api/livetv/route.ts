import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for resolved URLs
const urlCache: Record<string, { url: string; ts: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Known stable channel IDs (hardcoded fallbacks)
const KMBC_CHANNEL_ID = '47d92d1bd8e44e2383563530c2a305fd';

// Resolve dynamic channel URLs server-side (CORS-safe)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel');

  if (!channel) {
    return NextResponse.json({ error: 'Missing channel param' }, { status: 400 });
  }

  // Return cached URL if fresh
  const cached = urlCache[channel];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ url: cached.url, cached: true });
  }

  try {
    let result: { url: string } | null = null;

    switch (channel) {
      case 'kmbc':
        result = await resolveKMBC();
        break;
      case 'wdaf':
        result = await resolveWDAF();
        break;
      default:
        return NextResponse.json({ error: `Unknown channel: ${channel}` }, { status: 400 });
    }

    if (result) {
      urlCache[channel] = { url: result.url, ts: Date.now() };
      return NextResponse.json(result);
    }

    // Return stale cache if resolution failed
    if (cached) {
      return NextResponse.json({ url: cached.url, cached: true, stale: true });
    }

    return NextResponse.json({ error: 'Failed to resolve channel URL' }, { status: 502 });
  } catch (error) {
    console.error(`[LiveTV] resolve error for ${channel}:`, error);
    // Return stale cache on error
    if (cached) {
      return NextResponse.json({ url: cached.url, cached: true, stale: true });
    }
    return NextResponse.json({ error: 'Failed to resolve channel URL' }, { status: 502 });
  }
}

// KMBC 9 (ABC) - Scrape Uplynk URL from kmbc.com/nowcast
// Prefers stable channel URL over expiring ext URL
async function resolveKMBC(): Promise<{ url: string } | null> {
  try {
    const res = await fetch('https://www.kmbc.com/nowcast', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      // Fall back to known channel ID
      return { url: `https://content.uplynk.com/channel/${KMBC_CHANNEL_ID}.m3u8` };
    }

    const html = await res.text();

    // Prefer channel URL (stable, doesn't expire) over ext URL (has timestamps)
    const channelPattern = /https:\/\/content\.uplynk\.com\/channel\/[^"'\s]+\.m3u8/;
    const extPattern = /https:\/\/content\.uplynk\.com\/ext\/[^"'\s]+\.m3u8[^"'\s]*/;

    const channelMatch = html.match(channelPattern);
    if (channelMatch) {
      return { url: channelMatch[0].replace(/&amp;/g, '&') };
    }

    const extMatch = html.match(extPattern);
    if (extMatch) {
      return { url: extMatch[0].replace(/&amp;/g, '&') };
    }
  } catch (err) {
    console.error('[LiveTV] KMBC scrape error', err);
  }

  // Ultimate fallback: hardcoded stable channel URL
  return { url: `https://content.uplynk.com/channel/${KMBC_CHANNEL_ID}.m3u8` };
}

// WDAF FOX 4 - Lura/Anvato API resolver
// Matches Swift: URLResolver.luraAnvato(videoId:anvack:)
async function resolveWDAF(): Promise<{ url: string } | null> {
  const videoId = 'adstPZWVgQ5zgzX5';
  const anvack = '70X35QbVjgovptmVD0HwZI0w9lNQk2R1';

  const apiUrl = `https://tkx.mp.lura.live/rest/v2/mcp/video/${videoId}?anvack=${anvack}`;

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (!res.ok) return null;

  const text = await res.text();

  // Response may be JSONP — strip callback wrapper if present
  let jsonStr = text;
  const jsonpMatch = text.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/);
  if (jsonpMatch) {
    jsonStr = jsonpMatch[1];
  }

  const data = JSON.parse(jsonStr);

  // Find m3u8-variant format in the published_urls array
  const publishedUrls = data.published_urls || [];
  for (const pub of publishedUrls) {
    if (pub.format === 'm3u8-variant' && pub.embed_url) {
      return { url: pub.embed_url };
    }
  }

  // Fallback: look for any HLS URL
  for (const pub of publishedUrls) {
    const url = pub.embed_url || pub.url || '';
    if (url.includes('.m3u8')) {
      return { url };
    }
  }

  return null;
}
