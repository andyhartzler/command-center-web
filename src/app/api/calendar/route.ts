import { NextRequest, NextResponse } from 'next/server';

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

// Parse ICS/iCal format into events
function parseICS(icsText: string, calendarName: string, color: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const blocks = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const lines = unfoldICSLines(block);

    let title = '';
    let start = '';
    let end = '';
    let location = '';
    let description = '';
    let uid = '';
    let allDay = false;

    for (const line of lines) {
      if (line.startsWith('SUMMARY:') || line.startsWith('SUMMARY;')) {
        title = extractValue(line);
      } else if (line.startsWith('DTSTART')) {
        const val = extractValue(line);
        allDay = line.includes('VALUE=DATE') && !line.includes('VALUE=DATE-TIME');
        start = parseICSDate(val);
      } else if (line.startsWith('DTEND')) {
        end = parseICSDate(extractValue(line));
      } else if (line.startsWith('LOCATION:') || line.startsWith('LOCATION;')) {
        location = extractValue(line);
      } else if (line.startsWith('DESCRIPTION:') || line.startsWith('DESCRIPTION;')) {
        description = extractValue(line);
      } else if (line.startsWith('UID:')) {
        uid = extractValue(line);
      }
    }

    if (title && start) {
      events.push({
        id: uid || `${calendarName}-${i}`,
        title: unescapeICS(title),
        start,
        end: end || start,
        location: location ? unescapeICS(location) : null,
        description: description ? unescapeICS(description).slice(0, 200) : null,
        allDay,
        calendar: calendarName,
        color,
      });
    }
  }

  return events;
}

function unfoldICSLines(text: string): string[] {
  // ICS spec: lines starting with space/tab are continuations
  return text.replace(/\r\n[\t ]/g, '').replace(/\n[\t ]/g, '').split(/\r?\n/).filter(l => l.trim());
}

function extractValue(line: string): string {
  const colonIdx = line.indexOf(':');
  return colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
}

function parseICSDate(val: string): string {
  // Format: 20250312T143000Z or 20250312
  if (!val) return '';
  const clean = val.replace(/[^0-9T]/g, '');
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00`;
  }
  if (clean.length >= 15) {
    const iso = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`;
    return val.endsWith('Z') ? iso + 'Z' : iso;
  }
  return val;
}

function unescapeICS(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

const CALENDAR_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export async function GET(request: NextRequest) {
  const feedsParam = request.nextUrl.searchParams.get('feeds');
  if (!feedsParam) {
    return NextResponse.json({ events: [], message: 'No calendar feeds configured' });
  }

  try {
    const feeds: { name: string; url: string }[] = JSON.parse(feedsParam);
    const validFeeds = feeds.filter(f => f.url && f.url.trim().length > 5);

    if (validFeeds.length === 0) {
      return NextResponse.json({ events: [], message: 'No valid feed URLs' });
    }

    const allEvents: CalendarEvent[] = [];
    const feedErrors: string[] = [];

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthsAhead = new Date(now.getTime() + 90 * 86400000);

    await Promise.all(
      validFeeds.map(async (feed, idx) => {
        const feedName = feed.name || `Calendar ${idx + 1}`;
        try {
          // Follow redirects, set timeout, send browser-like headers
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);

          const res = await fetch(feed.url, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; CalendarWidget/1.0)',
              'Accept': 'text/calendar, text/plain, */*',
            },
          });
          clearTimeout(timeout);

          if (!res.ok) {
            feedErrors.push(`${feedName}: HTTP ${res.status}`);
            console.error(`[calendar] ${feedName} returned ${res.status}: ${feed.url}`);
            return;
          }

          const contentType = res.headers.get('content-type') || '';
          const text = await res.text();

          // Verify it looks like ICS data
          if (!text.includes('BEGIN:VCALENDAR') && !text.includes('BEGIN:VEVENT')) {
            feedErrors.push(`${feedName}: Not a valid ICS feed`);
            console.error(`[calendar] ${feedName} is not ICS (content-type: ${contentType}, starts with: ${text.slice(0, 100)})`);
            return;
          }

          const color = CALENDAR_COLORS[idx % CALENDAR_COLORS.length];
          const events = parseICS(text, feedName, color);
          console.log(`[calendar] ${feedName}: parsed ${events.length} events from ${feed.url}`);

          // Filter to relevant date range
          for (const event of events) {
            const eventDate = new Date(event.start);
            if (eventDate >= weekAgo && eventDate <= monthsAhead) {
              allEvents.push(event);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          feedErrors.push(`${feedName}: ${msg}`);
          console.error(`[calendar] Failed to fetch ${feedName} (${feed.url}):`, err);
        }
      })
    );

    // Sort by start date
    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return NextResponse.json({
      events: allEvents,
      feedCount: validFeeds.length,
      errors: feedErrors.length > 0 ? feedErrors : undefined,
    });
  } catch (err) {
    console.error('[calendar] error:', err);
    return NextResponse.json({ error: 'Failed to fetch calendar', details: String(err) }, { status: 500 });
  }
}
