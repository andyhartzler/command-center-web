import { NextRequest, NextResponse } from 'next/server';

// Proxy HLS streams from Grand security cameras through the managed tunnel
// The cameras are at 192.168.4.21:8888/hls/{1,2,3}/stream.m3u8
// Accessible via managed tunnel: cameras.hartzler.app/hls/{path}
// Basic Auth: empty username, password "hope"

const BASE_URL = process.env.EOC_SERVER_URL || 'https://cameras.hartzler.app';
const AUTH_HEADER = 'Basic ' + Buffer.from(':hope').toString('base64');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const subPath = path.join('/');

  // Only allow hls paths for security
  if (!subPath.match(/^[0-9]+\//)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const targetUrl = `${BASE_URL}/hls/${subPath}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        Authorization: AUTH_HEADER,
        'User-Agent': 'CommandCenter-Web/1.0',
      },
    });

    if (!res.ok) {
      return new NextResponse(`Upstream returned ${res.status}`, { status: res.statusText === 'Unauthorized' ? 502 : res.status });
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const body = await res.arrayBuffer();

    // For .m3u8 manifests, we might need to rewrite segment URLs
    if (subPath.endsWith('.m3u8')) {
      let manifest = new TextDecoder().decode(body);

      // Rewrite relative segment URLs to go through this proxy
      // HLS segments are typically relative paths like "stream0.ts" or numbered segments
      // We need to keep them relative so they route through this same API path
      // Since Next.js serves this at /api/grand-cameras/[...path], relative URLs
      // in the manifest will naturally resolve against the same directory

      return new NextResponse(manifest, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // For .ts segments and other binary content
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error(`[GrandCameras] proxy error for ${subPath}:`, error);
    return NextResponse.json({ error: 'Failed to fetch camera stream' }, { status: 502 });
  }
}
