import { NextRequest, NextResponse } from 'next/server';

// Proxy the locally-decrypted CNN live HLS (cnn-capture.service on the lenovo
// writes /tmp/cnn_hls, nginx serves it at {EOC_SERVER_URL}/cnn/). Same-origin
// so the wall widget plays it like any channel — mirrors /api/grand-cameras.
const BASE_URL = process.env.EOC_SERVER_URL || 'https://cameras.hartzler.app';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const subPath = path.join('/');
  if (!/^[a-zA-Z0-9_.\-]+$/.test(subPath)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const targetUrl = `${BASE_URL}/cnn/${subPath}`;
  try {
    const res = await fetch(targetUrl, {
      headers: { 'User-Agent': 'CommandCenter-Web/1.0' },
    });
    if (!res.ok) {
      return new NextResponse(`Upstream ${res.status}`, { status: res.status });
    }
    if (subPath.endsWith('.m3u8')) {
      const manifest = await res.text();
      return new NextResponse(manifest, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    // Binary .ts passthrough
    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'video/mp2t',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ error: 'CNN proxy fetch failed' }, { status: 502 });
  }
}
