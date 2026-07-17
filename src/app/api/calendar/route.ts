import { NextRequest, NextResponse } from 'next/server';

// ICS feed aggregator with server-side recurrence (RRULE) expansion and
// TZID-aware time conversion. Occurrences are expanded for the next
// WINDOW_DAYS days; times honor the VEVENT TZID and fall back to
// America/Chicago for floating or unrecognized zones.

const DEFAULT_TZ = 'America/Chicago';
const WINDOW_DAYS = 14;
const MAX_DAY_ITERATIONS = 20_000;
const MAX_OCCURRENCES_PER_EVENT = 200;
const DAY_MS = 86_400_000;

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

/** Wall-clock time components, month is 1-12. */
interface WallTime {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

interface ParsedDate {
  wall: WallTime;
  isUtc: boolean;
  dateOnly: boolean;
  tzid: string | null;
}

interface RawEvent {
  uid: string;
  title: string;
  location: string;
  description: string;
  start: ParsedDate;
  end: ParsedDate | null;
  rrule: string | null;
  exdates: number[];
  recurrenceId: number | null;
}

interface RRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count: number | null;
  until: number | null;
  byday: { ord: number; wd: number }[];
  bymonthday: number[];
}

const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

// ---------------------------------------------------------------------------
// Timezone conversion
// ---------------------------------------------------------------------------

const dtfCache = new Map<string, Intl.DateTimeFormat | null>();

function getZoneFormatter(tz: string): Intl.DateTimeFormat | null {
  if (dtfCache.has(tz)) return dtfCache.get(tz) ?? null;
  let dtf: Intl.DateTimeFormat | null = null;
  try {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    dtf = null;
  }
  dtfCache.set(tz, dtf);
  return dtf;
}

function resolveZone(tzid: string | null): string {
  if (tzid && getZoneFormatter(tzid)) return tzid;
  return DEFAULT_TZ;
}

function zoneWallAt(epochMs: number, tz: string): WallTime {
  const dtf = getZoneFormatter(tz) ?? getZoneFormatter(DEFAULT_TZ)!;
  const map: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(epochMs))) {
    if (part.type !== 'literal') map[part.type] = parseInt(part.value, 10);
  }
  return { y: map.year, mo: map.month, d: map.day, h: map.hour % 24, mi: map.minute, s: map.second };
}

function tzOffsetMs(epochMs: number, tz: string): number {
  const w = zoneWallAt(epochMs, tz);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - epochMs;
}

/** Convert a wall-clock time in a zone (or UTC) to an epoch ms instant. */
function wallToEpoch(wall: WallTime, tzid: string | null, isUtc: boolean): number {
  const utcGuess = Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi, wall.s);
  if (isUtc) return utcGuess;
  const zone = resolveZone(tzid);
  const offset = tzOffsetMs(utcGuess, zone);
  let ts = utcGuess - offset;
  const offset2 = tzOffsetMs(ts, zone);
  if (offset2 !== offset) ts = utcGuess - offset2;
  return ts;
}

// ---------------------------------------------------------------------------
// Wall-clock arithmetic (wall times ride in Date.UTC as a plain container)
// ---------------------------------------------------------------------------

function wallToContainer(w: WallTime): number {
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
}

function containerToWall(ms: number): WallTime {
  const d = new Date(ms);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
  };
}

function addDays(w: WallTime, days: number): WallTime {
  return containerToWall(wallToContainer(w) + days * DAY_MS);
}

function wallWeekday(w: WallTime): number {
  return new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay();
}

function daysInMonth(y: number, mo: number): number {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Days since epoch of the Monday starting this wall date's week. */
function mondayIndex(w: WallTime): number {
  const dayNum = Math.floor(Date.UTC(w.y, w.mo - 1, w.d) / DAY_MS);
  const wd = wallWeekday(w);
  const sinceMonday = (wd + 6) % 7;
  return dayNum - sinceMonday;
}

// ---------------------------------------------------------------------------
// ICS parsing
// ---------------------------------------------------------------------------

function unfoldICSLines(text: string): string[] {
  return text
    .replace(/\r\n[\t ]/g, '')
    .replace(/\n[\t ]/g, '')
    .split(/\r?\n/)
    .filter(l => l.trim());
}

function parseProp(line: string): { name: string; params: Record<string, string>; value: string } {
  // Find the first colon outside of double quotes
  let colonIdx = -1;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) { colonIdx = i; break; }
  }
  if (colonIdx < 0) return { name: line.toUpperCase(), params: {}, value: '' };

  const head = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1).trim();
  const segments = head.split(';');
  const name = segments[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segments.length; i++) {
    const eq = segments[i].indexOf('=');
    if (eq > 0) {
      params[segments[i].slice(0, eq).toUpperCase()] = segments[i].slice(eq + 1).replace(/^"|"$/g, '');
    }
  }
  return { name, params, value };
}

function parseICSDateValue(value: string, params: Record<string, string>): ParsedDate | null {
  const clean = value.trim();
  const dateOnly = params.VALUE === 'DATE' || /^\d{8}$/.test(clean);
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const wall: WallTime = {
    y: parseInt(m[1], 10),
    mo: parseInt(m[2], 10),
    d: parseInt(m[3], 10),
    h: m[4] ? parseInt(m[4], 10) : 0,
    mi: m[5] ? parseInt(m[5], 10) : 0,
    s: m[6] ? parseInt(m[6], 10) : 0,
  };
  return {
    wall,
    isUtc: m[7] === 'Z',
    dateOnly,
    tzid: params.TZID || null,
  };
}

function unescapeICS(text: string): string {
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseRawEvents(icsText: string): RawEvent[] {
  const events: RawEvent[] = [];
  const blocks = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const lines = unfoldICSLines(block);

    let uid = '';
    let title = '';
    let location = '';
    let description = '';
    let start: ParsedDate | null = null;
    let end: ParsedDate | null = null;
    let rrule: string | null = null;
    let recurrenceId: number | null = null;
    const exdates: number[] = [];

    for (const line of lines) {
      const prop = parseProp(line);
      switch (prop.name) {
        case 'SUMMARY': title = unescapeICS(prop.value); break;
        case 'LOCATION': location = unescapeICS(prop.value); break;
        case 'DESCRIPTION': description = unescapeICS(prop.value).slice(0, 200); break;
        case 'UID': uid = prop.value; break;
        case 'DTSTART': start = parseICSDateValue(prop.value, prop.params); break;
        case 'DTEND': end = parseICSDateValue(prop.value, prop.params); break;
        case 'RRULE': rrule = prop.value; break;
        case 'EXDATE': {
          for (const v of prop.value.split(',')) {
            const parsed = parseICSDateValue(v, prop.params);
            if (parsed) exdates.push(wallToEpoch(parsed.wall, parsed.tzid, parsed.isUtc));
          }
          break;
        }
        case 'RECURRENCE-ID': {
          const parsed = parseICSDateValue(prop.value, prop.params);
          if (parsed) recurrenceId = wallToEpoch(parsed.wall, parsed.tzid, parsed.isUtc);
          break;
        }
      }
    }

    if (title && start) {
      events.push({ uid: uid || `evt-${i}`, title, location, description, start, end, rrule, exdates, recurrenceId });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// RRULE expansion
// ---------------------------------------------------------------------------

function parseRRule(text: string, eventTz: string | null): RRule | null {
  const parts: Record<string, string> = {};
  for (const seg of text.split(';')) {
    const eq = seg.indexOf('=');
    if (eq > 0) parts[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1).toUpperCase();
  }
  const freq = parts.FREQ as RRule['freq'] | undefined;
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;

  let until: number | null = null;
  if (parts.UNTIL) {
    const parsed = parseICSDateValue(parts.UNTIL, {});
    if (parsed) {
      if (parsed.dateOnly) {
        // Date-only UNTIL is inclusive of the whole day
        until = wallToEpoch({ ...parsed.wall, h: 23, mi: 59, s: 59 }, eventTz, false);
      } else {
        until = wallToEpoch(parsed.wall, eventTz, parsed.isUtc);
      }
    }
  }

  const byday: { ord: number; wd: number }[] = [];
  if (parts.BYDAY) {
    for (const token of parts.BYDAY.split(',')) {
      const m = token.trim().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
      if (m) byday.push({ ord: m[1] ? parseInt(m[1], 10) : 0, wd: WEEKDAYS[m[2]] });
    }
  }

  const bymonthday = (parts.BYMONTHDAY || '')
    .split(',')
    .map(v => parseInt(v, 10))
    .filter(v => Number.isFinite(v) && v !== 0);

  return {
    freq,
    interval: Math.max(1, parseInt(parts.INTERVAL || '1', 10) || 1),
    count: parts.COUNT ? Math.max(1, parseInt(parts.COUNT, 10) || 1) : null,
    until,
    byday,
    bymonthday,
  };
}

/** Nth (or -1 = last) weekday of a month as a wall date, or null. */
function nthWeekdayOfMonth(y: number, mo: number, wd: number, ord: number): number | null {
  const dim = daysInMonth(y, mo);
  if (ord >= 0) {
    const firstWd = wallWeekday({ y, mo, d: 1, h: 0, mi: 0, s: 0 });
    const offset = (wd - firstWd + 7) % 7;
    const day = 1 + offset + (Math.max(1, ord) - 1) * 7;
    return day <= dim ? day : null;
  }
  const lastWd = wallWeekday({ y, mo, d: dim, h: 0, mi: 0, s: 0 });
  const back = (lastWd - wd + 7) % 7;
  const day = dim - back + (ord + 1) * 7;
  return day >= 1 ? day : null;
}

/**
 * Expand a recurring event's occurrence start instants (epoch ms) that land
 * inside [windowStart, windowEnd]. Recurrence math runs on the wall clock of
 * the event's zone so weekly 9am stays 9am across DST.
 */
function expandOccurrences(
  ev: RawEvent,
  rule: RRule,
  windowStartMs: number,
  windowEndMs: number,
  excluded: Set<number>,
): number[] {
  const tz = ev.start.tzid;
  const isUtc = ev.start.isUtc;
  const startWall = ev.start.wall;
  const out: number[] = [];
  let produced = 0;

  const emit = (wall: WallTime): 'stop' | 'continue' => {
    const epoch = wallToEpoch(wall, tz, isUtc);
    const startEpoch = wallToEpoch(startWall, tz, isUtc);
    if (epoch < startEpoch) return 'continue';
    if (rule.until !== null && epoch > rule.until) return 'stop';
    produced++;
    if (!excluded.has(epoch) && epoch >= windowStartMs && epoch <= windowEndMs) {
      out.push(epoch);
    }
    if (rule.count !== null && produced >= rule.count) return 'stop';
    if (epoch > windowEndMs) return 'stop';
    if (out.length >= MAX_OCCURRENCES_PER_EVENT) return 'stop';
    return 'continue';
  };

  if (rule.freq === 'DAILY') {
    let cursor = { ...startWall };
    for (let i = 0; i < MAX_DAY_ITERATIONS; i++) {
      if (emit(cursor) === 'stop') break;
      cursor = addDays(cursor, rule.interval);
    }
    return out;
  }

  if (rule.freq === 'WEEKLY') {
    const days = rule.byday.length > 0
      ? rule.byday.map(b => b.wd)
      : [wallWeekday(startWall)];
    const baseWeek = mondayIndex(startWall);
    let cursor = { ...startWall };
    for (let i = 0; i < MAX_DAY_ITERATIONS; i++) {
      const weekDelta = Math.floor((mondayIndex(cursor) - baseWeek) / 7);
      if (weekDelta % rule.interval === 0 && days.includes(wallWeekday(cursor))) {
        if (emit(cursor) === 'stop') break;
      }
      cursor = addDays(cursor, 1);
      // Bail once the wall date is far past the window
      if (wallToContainer(cursor) > windowEndMs + 2 * DAY_MS && rule.count === null) break;
    }
    return out;
  }

  if (rule.freq === 'MONTHLY') {
    const startMonthIdx = startWall.y * 12 + (startWall.mo - 1);
    outer:
    for (let m = 0; m < 1200; m++) {
      const monthIdx = startMonthIdx + m * rule.interval;
      const y = Math.floor(monthIdx / 12);
      const mo = (monthIdx % 12) + 1;
      const dim = daysInMonth(y, mo);
      const candidateDays: number[] = [];

      if (rule.bymonthday.length > 0) {
        for (const md of rule.bymonthday) {
          const day = md > 0 ? md : dim + md + 1;
          if (day >= 1 && day <= dim) candidateDays.push(day);
        }
      } else if (rule.byday.length > 0) {
        for (const b of rule.byday) {
          const day = nthWeekdayOfMonth(y, mo, b.wd, b.ord);
          if (day !== null) candidateDays.push(day);
        }
      } else if (startWall.d <= dim) {
        candidateDays.push(startWall.d);
      }

      candidateDays.sort((a, b) => a - b);
      for (const day of candidateDays) {
        const wall = { y, mo, d: day, h: startWall.h, mi: startWall.mi, s: startWall.s };
        if (emit(wall) === 'stop') break outer;
      }
      if (rule.count === null && Date.UTC(y, mo - 1, 1) > windowEndMs + 32 * DAY_MS) break;
    }
    return out;
  }

  // YEARLY
  for (let k = 0; k < 200; k++) {
    const y = startWall.y + k * rule.interval;
    if (startWall.d > daysInMonth(y, startWall.mo)) continue; // Feb 29 in non-leap years
    const wall = { ...startWall, y };
    if (emit(wall) === 'stop') break;
    if (rule.count === null && Date.UTC(y, 0, 1) > windowEndMs + 366 * DAY_MS) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Occurrence materialization
// ---------------------------------------------------------------------------

function formatNaiveDate(w: WallTime): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${w.y}-${p(w.mo)}-${p(w.d)}T00:00:00`;
}

function buildEvents(icsText: string, calendarName: string, color: string, windowStartMs: number, windowEndMs: number): CalendarEvent[] {
  const raw = parseRawEvents(icsText);
  const out: CalendarEvent[] = [];

  // RECURRENCE-ID overrides replace individual instances of their master
  const overridesByUid = new Map<string, Set<number>>();
  for (const ev of raw) {
    if (ev.recurrenceId !== null) {
      let set = overridesByUid.get(ev.uid);
      if (!set) { set = new Set(); overridesByUid.set(ev.uid, set); }
      set.add(ev.recurrenceId);
    }
  }

  for (const ev of raw) {
    const allDay = ev.start.dateOnly;
    const startEpoch = wallToEpoch(ev.start.wall, ev.start.tzid, ev.start.isUtc);
    const endEpoch = ev.end
      ? wallToEpoch(ev.end.wall, ev.end.tzid ?? ev.start.tzid, ev.end.isUtc)
      : startEpoch + (allDay ? DAY_MS : 0);
    const durationMs = Math.max(0, endEpoch - startEpoch);

    const pushOccurrence = (occStartEpoch: number, occStartWall: WallTime | null) => {
      let startStr: string;
      let endStr: string;
      if (allDay) {
        const wall = occStartWall ?? ev.start.wall;
        startStr = formatNaiveDate(wall);
        const endDays = Math.max(1, Math.round(durationMs / DAY_MS));
        endStr = formatNaiveDate(addDays({ ...wall, h: 0, mi: 0, s: 0 }, endDays));
      } else {
        startStr = new Date(occStartEpoch).toISOString();
        endStr = new Date(occStartEpoch + durationMs).toISOString();
      }
      out.push({
        id: `${ev.uid}:${occStartEpoch}`,
        title: ev.title,
        start: startStr,
        end: endStr,
        location: ev.location || null,
        description: ev.description || null,
        allDay,
        calendar: calendarName,
        color,
      });
    };

    if (ev.rrule && ev.recurrenceId === null) {
      const rule = parseRRule(ev.rrule, ev.start.tzid);
      if (rule) {
        const excluded = new Set<number>(ev.exdates);
        for (const e of overridesByUid.get(ev.uid) ?? []) excluded.add(e);
        const occurrences = expandOccurrences(ev, rule, windowStartMs, windowEndMs, excluded);
        for (const occEpoch of occurrences) {
          // Recover the wall date for all-day naive formatting
          const wall = allDay ? zoneWallAt(occEpoch, resolveZone(ev.start.tzid)) : null;
          pushOccurrence(occEpoch, wall);
        }
        continue;
      }
    }

    // Single event (or an override instance)
    if (startEpoch >= windowStartMs && startEpoch <= windowEndMs) {
      pushOccurrence(startEpoch, null);
    }
  }

  return out;
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

    // Window: start of today (default zone) through the next 14 days
    const nowWall = zoneWallAt(Date.now(), DEFAULT_TZ);
    const windowStartMs = wallToEpoch({ ...nowWall, h: 0, mi: 0, s: 0 }, DEFAULT_TZ, false);
    const windowEndMs = windowStartMs + WINDOW_DAYS * DAY_MS;

    await Promise.all(
      validFeeds.map(async (feed, idx) => {
        const feedName = feed.name || `Calendar ${idx + 1}`;
        try {
          // Convert webcal:// to https:// (used by iCloud and some other providers)
          let feedUrl = feed.url.trim();
          if (feedUrl.startsWith('webcal://')) {
            feedUrl = feedUrl.replace(/^webcal:\/\//, 'https://');
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);

          const res = await fetch(feedUrl, {
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
            console.error(`[calendar] ${feedName} returned ${res.status}: ${feedUrl}`);
            return;
          }

          const contentType = res.headers.get('content-type') || '';
          const text = await res.text();

          if (!text.includes('BEGIN:VCALENDAR') && !text.includes('BEGIN:VEVENT')) {
            feedErrors.push(`${feedName}: Not a valid ICS feed`);
            console.error(`[calendar] ${feedName} is not ICS (url: ${feedUrl}, content-type: ${contentType}, starts with: ${text.slice(0, 100)})`);
            return;
          }

          const color = CALENDAR_COLORS[idx % CALENDAR_COLORS.length];
          const events = buildEvents(text, feedName, color, windowStartMs, windowEndMs);
          console.log(`[calendar] ${feedName}: ${events.length} occurrences in window from ${feedUrl}`);
          allEvents.push(...events);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          feedErrors.push(`${feedName}: ${msg}`);
          console.error(`[calendar] Failed to fetch ${feedName} (${feed.url.trim()}):`, err);
        }
      })
    );

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
