import { NextResponse } from 'next/server';

const EOC_SERVER_URL =
  process.env.EOC_SERVER_URL ||
  'http://192.168.4.21:8080';

export async function GET() {
  try {
    const res = await fetch(`${EOC_SERVER_URL}/api/dashboard/state`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Failed to load dashboard state:', err);
    // A real error, not a silent empty state: clients fall back to
    // localStorage instead of treating "server unreachable" as "no state".
    return NextResponse.json({ error: 'State server unreachable' }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${EOC_SERVER_URL}/api/dashboard/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Failed to save dashboard state:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
