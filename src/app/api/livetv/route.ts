import { NextRequest, NextResponse } from 'next/server';

// Resolve dynamic channel URLs server-side (CORS-safe)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel');

  if (!channel) {
    return NextResponse.json({ error: 'Missing channel param' }, { status: 400 });
  }

  try {
    switch (channel) {
      case 'kmbc':
        return await resolveKMBC();
      case 'wdaf':
        return await resolveWDAF();
      default:
        return NextResponse.json({ error: `Unknown channel: ${channel}` }, { status: 400 });
    }
  } catch (error) {
    console.error(`[LiveTV] resolve error for ${channel}:`, error);
    return NextResponse.json({ error: 'Failed to resolve channel URL' }, { status: 502 });
  }
}

// KMBC 9 (ABC) - Scrape Uplynk URL from kmbc.com/nowcast
// Matches Swift: URLResolver.kmbcNowcast
async function resolveKMBC(): Promise<NextResponse> {
  const res = await fetch('https://www.kmbc.com/nowcast', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `KMBC page returned ${res.status}` }, { status: 502 });
  }

  const html = await res.text();

  // Try ext URL first (higher quality), then channel URL
  // Matches Swift regex patterns
  const extPattern = /https:\/\/content\.uplynk\.com\/ext\/[^"'\s]+\.m3u8[^"'\s]*/;
  const channelPattern = /https:\/\/content\.uplynk\.com\/channel\/[^"'\s]+\.m3u8[^"'\s]*/;

  const extMatch = html.match(extPattern);
  if (extMatch) {
    return NextResponse.json({ url: extMatch[0] });
  }

  const channelMatch = html.match(channelPattern);
  if (channelMatch) {
    return NextResponse.json({ url: channelMatch[0] });
  }

  return NextResponse.json({ error: 'Could not find KMBC stream URL' }, { status: 502 });
}

// WDAF FOX 4 - Lura/Anvato API resolver
// Matches Swift: URLResolver.luraAnvato(videoId:anvack:)
async function resolveWDAF(): Promise<NextResponse> {
  const videoId = 'adstPZWVgQ5zgzX5';
  const anvack = '70X35QbVjgovptmVD0HwZI0w9lNQk2R1';

  const apiUrl = `https://tkx.mp.lura.live/rest/v2/mcp/video/${videoId}?anvack=${anvack}`;

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Lura API returned ${res.status}` }, { status: 502 });
  }

  const text = await res.text();

  // Response may be JSONP — strip callback wrapper if present
  let jsonStr = text;
  const jsonpMatch = text.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/);
  if (jsonpMatch) {
    jsonStr = jsonpMatch[1];
  }

  const data = JSON.parse(jsonStr);

  // Find m3u8-variant format in the published_urls array
  // Matches Swift: look for format "m3u8-variant"
  const publishedUrls = data.published_urls || [];
  for (const pub of publishedUrls) {
    if (pub.format === 'm3u8-variant' && pub.embed_url) {
      return NextResponse.json({ url: pub.embed_url });
    }
  }

  // Fallback: look for any HLS URL
  for (const pub of publishedUrls) {
    const url = pub.embed_url || pub.url || '';
    if (url.includes('.m3u8')) {
      return NextResponse.json({ url });
    }
  }

  return NextResponse.json({ error: 'Could not find WDAF stream URL' }, { status: 502 });
}
