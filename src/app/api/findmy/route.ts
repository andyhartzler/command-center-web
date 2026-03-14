import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = 'https://faajpcarasilbfndzkmd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhYWpwY2FyYXNpbGJmbmR6a21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMTcxOTksImV4cCI6MjA3NTc5MzE5OX0.KsOsdwE8Bl4CcHIdYzNmOrDOs_ajle9s7DY4lfXzWFA';

// In-memory cache
let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds

async function fetchFromSupabase() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/kv_store?key=eq.findmy_friends&select=data`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
    }
  );
  if (!res.ok) throw new Error(`Supabase returned ${res.status}`);
  const rows = await res.json();
  if (!rows.length) throw new Error('No Find My data in Supabase');
  return rows[0].data;
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action');

  try {
    // Refresh action bypasses cache to get latest data
    const skipCache = action === 'refresh';

    if (!skipCache && cache && Date.now() - cache.ts < CACHE_TTL) {
      const data = cache.data as { friends: { handle: string; name: string }[] };
      if (action === 'friends-list') {
        return NextResponse.json({
          friends: data.friends.map(f => ({ handle: f.handle, name: f.name })),
        });
      }
      return NextResponse.json(data);
    }

    const data = await fetchFromSupabase();
    cache = { data, ts: Date.now() };

    if (action === 'friends-list') {
      return NextResponse.json({
        friends: data.friends.map((f: { handle: string; name: string }) => ({
          handle: f.handle,
          name: f.name,
        })),
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[FindMy API] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch Find My data' },
      { status: 500 }
    );
  }
}
