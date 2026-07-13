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
  const match = subPath.match(/^([0-9]+)(_sub|_main)?\/(.+)$/);
  if (!match) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Widgets get the sub-stream by default: the cameras' main profile is
  // GOP-bound to irregular 3-10s segments at 4x the bitrate, which cannot
  // stream smoothly through the tunnel. `{cam}_main` opts back into full res.
  const dir = match[2] === '_main' ? match[1] : `${match[1]}_sub`;
  const targetUrl = `${BASE_URL}/hls/${dir}/${match[3]}`;

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

    // For .m3u8 manifests, read as text (small payload)
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

    // For .ts segments, stream the body through instead of buffering
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'video/mp2t',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error(`[GrandCameras] proxy error for ${subPath}:`, error);
    return NextResponse.json({ error: 'Failed to fetch camera stream' }, { status: 502 });
  }
}
