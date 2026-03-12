import { NextResponse } from 'next/server';

const EOC_SERVER_URL =
  process.env.EOC_SERVER_URL ||
  'https://initial-hockey-collective-percentage.trycloudflare.com';

export async function GET() {
  try {
    const res = await fetch(`${EOC_SERVER_URL}/api/status`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `EOC server returned ${res.status}` },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach EOC server: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
