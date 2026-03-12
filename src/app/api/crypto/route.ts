import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const coins = request.nextUrl.searchParams.get('coins') || 'bitcoin,ethereum';

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, { next: { revalidate: 60 } });

    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko API returned ${res.status}` },
        { status: res.status },
      );
    }

    const raw: Record<string, { usd?: number; usd_24h_change?: number }> = await res.json();

    const parsed = Object.entries(raw).map(([id, data]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      price: data.usd ?? 0,
      change24h: data.usd_24h_change ?? 0,
    }));

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[crypto] fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch crypto data' }, { status: 500 });
  }
}
