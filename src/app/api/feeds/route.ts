import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urls = searchParams.get('urls');
  
  if (!urls) {
    return NextResponse.json({ items: [] });
  }

  try {
    const feedUrls = urls.split(',');
    let allItems: any[] = [];

    for (const url of feedUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;

        if (url.endsWith('.json')) {
          const data = await res.json();
          // specifically for CISA KEV JSON
          if (data.vulnerabilities) {
            const items = data.vulnerabilities.slice(0, 5).map((v: any) => ({
              title: `CISA KEV: ${v.vulnerabilityName}`,
              description: v.shortDescription,
              date: v.dateAdded,
              source: 'US-CERT (CISA)'
            }));
            allItems = [...allItems, ...items];
          }
        } else {
          // Mock RSS parsing for WHO/Politico/MS-ISAC
          const text = await res.text();
          // Simplified mock response for RSS feeds
          allItems.push({
            title: `Alert from ${new URL(url).hostname}`,
            description: "New pressing update available...",
            date: new Date().toISOString(),
            source: new URL(url).hostname
          });
        }
      } catch (err) {
        console.error(`Failed to fetch ${url}`, err);
      }
    }

    // Sort by date descending
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ items: allItems });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch feeds' }, { status: 500 });
  }
}
