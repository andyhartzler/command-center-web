import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Missing iCloud token' }, { status: 400 });
    }

    // Undocumented iCloud Shared Album API endpoints
    // 1. Get the webstream data
    const webstreamUrl = `https://p23-sharedstreams.icloud.com/${token}/sharedstreams/webstream`;
    const webstreamRes = await fetch(webstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{"streamCtag":null}'
    });
    
    if (!webstreamRes.ok) {
      throw new Error('Failed to fetch webstream');
    }

    const streamData = await webstreamRes.json();
    const photos = streamData.photos || [];
    
    if (photos.length === 0) {
      return NextResponse.json({ urls: [] });
    }

    // 2. Get the asset URLs (getting just the first 20 for performance)
    const photoGuids = photos.slice(0, 20).map((p: any) => p.photoGuid);
    const assetUrl = `https://p23-sharedstreams.icloud.com/${token}/sharedstreams/webasseturls`;
    
    const assetRes = await fetch(assetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ photoGuids })
    });

    if (!assetRes.ok) {
      throw new Error('Failed to fetch asset URLs');
    }

    const assetData = await assetRes.json();
    const items = assetData.items || {};
    
    const urls = Object.values(items).map((item: any) => {
      const urlHost = item.url_location;
      const urlPath = item.url_path;
      return `https://${urlHost}${urlPath}`;
    });

    return NextResponse.json({ urls });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch iCloud album' }, { status: 500 });
  }
}
