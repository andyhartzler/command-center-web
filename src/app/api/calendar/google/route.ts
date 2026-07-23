import { NextResponse } from 'next/server';

// Google Calendar integration: pulls EVERY calendar on the account
// (calendarList = owned + shared/subscribed) and merges their events. Uses a
// server-side OAuth refresh token scoped to calendar.readonly — no secrets
// ever reach the browser. Returns the same shape as the ICS /api/calendar
// route so the widget renders both identically.

const WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;
const EVENTS_PER_CAL = 50;

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  description: string | null;
  allDay: boolean;
  calendar: string;
  color: string;
}

// Fallback palette when a calendar advertises no color.
const PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

// --- access token (refresh-token grant), cached in-memory until near expiry ---
let tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CAL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CAL_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CAL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    // Narrow every minted access token to read-only calendar, even though the
    // underlying grant is broader. The running app never holds a token that
    // can touch Gmail/Drive/etc.
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  });
  const res = await fetch(process.env.GOOGLE_CAL_TOKEN_URI || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    console.error('[calendar/google] token refresh failed', res.status, await res.text().catch(() => ''));
    return null;
  }
  const json = await res.json();
  const ttl = (json.expires_in ?? 3600) * 1000;
  tokenCache = { token: json.access_token, exp: Date.now() + ttl - 60_000 };
  return tokenCache.token;
}

interface GCalListEntry {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  selected?: boolean;
  deleted?: boolean;
}

interface GCalEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

async function gfetch<T>(url: string, token: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error('[calendar/google] GET failed', res.status, url);
    return null;
  }
  return (await res.json()) as T;
}

export async function GET() {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { events: [], error: 'Google Calendar not configured' },
      { status: 200 },
    );
  }

  const list = await gfetch<{ items?: GCalListEntry[] }>(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&showHidden=false',
    token,
  );
  if (!list?.items) {
    return NextResponse.json({ events: [], error: 'Failed to list calendars' }, { status: 200 });
  }

  const now = Date.now();
  const timeMin = new Date(now).toISOString();
  const timeMax = new Date(now + WINDOW_DAYS * DAY_MS).toISOString();

  const calendars = list.items.filter(c => !c.deleted);
  const allEvents: CalendarEvent[] = [];
  const calNames: { name: string; color: string }[] = [];

  await Promise.all(
    calendars.map(async (cal, idx) => {
      const name = cal.summaryOverride || cal.summary || cal.id;
      const color = cal.backgroundColor || PALETTE[idx % PALETTE.length];
      calNames.push({ name, color });

      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true', // Google expands recurrences for us
        orderBy: 'startTime',
        maxResults: String(EVENTS_PER_CAL),
      });
      const data = await gfetch<{ items?: GCalEvent[] }>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
        token,
      );
      if (!data?.items) return;

      for (const ev of data.items) {
        if (ev.status === 'cancelled' || !ev.start) continue;
        const allDay = !!ev.start.date;
        // All-day: keep a naive local-midnight string so the widget groups it
        // on the right calendar day. Timed: pass the RFC3339 instant through.
        const start = allDay ? `${ev.start.date}T00:00:00` : ev.start.dateTime!;
        const endRaw = ev.end?.date
          ? `${ev.end.date}T00:00:00`
          : ev.end?.dateTime || start;
        allEvents.push({
          id: `${cal.id}:${ev.id}`,
          title: ev.summary || '(no title)',
          start,
          end: endRaw,
          location: ev.location || null,
          description: ev.description ? ev.description.slice(0, 200) : null,
          allDay,
          calendar: name,
          color,
        });
      }
    }),
  );

  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return NextResponse.json({ events: allEvents, calendars: calNames, calendarCount: calendars.length });
}
