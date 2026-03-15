import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for resolved URLs
const urlCache: Record<string, { url: string; ts: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Known stable channel IDs (hardcoded fallbacks)
const KMBC_CHANNEL_ID = '47d92d1bd8e44e2383563530c2a305fd';

// Proxy HLS manifests/segments to bypass CORS
async function proxyStream(url: string): Promise<NextResponse> {
  try {
    // Some streams require specific referer headers
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': '*/*',
    };
    try {
      const host = new URL(url).hostname;
      if (host.includes('usnlive.com')) {
        headers['Referer'] = 'https://usnewson.com/';
        headers['Origin'] = 'https://usnewson.com';
      } else if (host.includes('livenewsplay.com')) {
        headers['Referer'] = 'https://www.newslive.com/';
        headers['Origin'] = 'https://www.newslive.com';
      } else if (host.includes('jmp2.uk')) {
        headers['Referer'] = 'https://jmp2.uk/';
      } else if (host.includes('enhdtv.com')) {
        headers['Referer'] = 'https://www.enhdtv.com/';
      }
    } catch { /* ignore */ }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      return new NextResponse(`Upstream ${res.status}`, { status: res.status });
    }
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const isManifest = url.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('m3u');

    if (isManifest) {
      let manifest = await res.text();
      // Rewrite relative URLs to absolute through our proxy
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      manifest = manifest.replace(/^(?!#)(?!https?:\/\/)(.+)$/gm, (match) => {
        const absolute = match.startsWith('/') ? new URL(match, url).href : baseUrl + match;
        return `/api/livetv?proxy=${encodeURIComponent(absolute)}`;
      });
      // Rewrite AES-128 key URIs to go through proxy (for CORS)
      manifest = manifest.replace(/URI="(https?:\/\/[^"]+)"/g, (_match, keyUrl) => {
        return `URI="/api/livetv?proxy=${encodeURIComponent(keyUrl)}"`;
      });
      return new NextResponse(manifest, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store',
        },
      });
    }

    // Binary segment passthrough
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('[LiveTV] proxy error:', err);
    return NextResponse.json({ error: 'Proxy fetch failed' }, { status: 502 });
  }
}

// Resolve dynamic channel URLs server-side (CORS-safe)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel');
  const proxyUrl = searchParams.get('proxy');

  // HLS proxy mode
  if (proxyUrl) {
    return proxyStream(proxyUrl);
  }

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
      case 'kshb':
        result = await resolveKSHB();
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
// Prefers ext URL (actual live content) over channel URL (shows logo when not live)
async function resolveKMBC(): Promise<{ url: string } | null> {
  try {
    const res = await fetch('https://www.kmbc.com/nowcast', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      return { url: `https://content.uplynk.com/channel/${KMBC_CHANNEL_ID}.m3u8` };
    }

    const html = await res.text();

    // Prefer ext URL (actual nowcast content) over channel URL (holding screen)
    const extPattern = /https:\/\/content\.uplynk\.com\/ext\/[^"'\s]+\.m3u8[^"'\s]*/;
    const channelPattern = /https:\/\/content\.uplynk\.com\/channel\/[^"'\s]+\.m3u8/;

    const extMatch = html.match(extPattern);
    if (extMatch) {
      return { url: extMatch[0].replace(/&amp;/g, '&') };
    }

    const channelMatch = html.match(channelPattern);
    if (channelMatch) {
      return { url: channelMatch[0].replace(/&amp;/g, '&') };
    }
  } catch (err) {
    console.error('[LiveTV] KMBC scrape error', err);
  }

  return { url: `https://content.uplynk.com/channel/${KMBC_CHANNEL_ID}.m3u8` };
}

// KSHB 41 (NBC/Scripps) - Scrape from kshb.com/live
// The /nowcast page loads URLs via JS; /live has them in data-m3u8 HTML attributes
const KSHB_CHANNEL_ID = '50d0fa1b042945a3a4f550f9b8412c83';

async function resolveKSHB(): Promise<{ url: string } | null> {
  try {
    const res = await fetch('https://www.kshb.com/live', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      return { url: `https://content.uplynk.com/channel/${KSHB_CHANNEL_ID}.m3u8` };
    }

    const html = await res.text();

    // Look for the main channel data-m3u8 attribute (kshb-main-channel)
    const mainChannelMatch = html.match(/data-channel="kshb-main-channel"[\s\S]*?data-m3u8="([^"]+)"/);
    if (mainChannelMatch) {
      return { url: mainChannelMatch[1].replace(/&amp;/g, '&') };
    }

    // Also try reversed attribute order
    const altMatch = html.match(/data-m3u8="([^"]+)"[\s\S]*?data-channel="kshb-main-channel"/);
    if (altMatch) {
      return { url: altMatch[1].replace(/&amp;/g, '&') };
    }

    // Fallback: prefer ext URL, then any channel URL
    const extPattern = /https:\/\/content\.uplynk\.com\/ext\/[^"'\s]+\.m3u8[^"'\s]*/;
    const extMatch = html.match(extPattern);
    if (extMatch) {
      return { url: extMatch[0].replace(/&amp;/g, '&') };
    }

    const channelPattern = /data-m3u8="(https:\/\/content\.uplynk\.com\/channel\/[^"]+)"/;
    const channelMatch = html.match(channelPattern);
    if (channelMatch) {
      return { url: channelMatch[1].replace(/&amp;/g, '&') };
    }
  } catch (err) {
    console.error('[LiveTV] KSHB scrape error', err);
  }

  return { url: `https://content.uplynk.com/channel/${KSHB_CHANNEL_ID}.m3u8` };
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
