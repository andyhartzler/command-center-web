// Consolidated flight time handling. Replaces the four divergent
// normalizers that lived in the aircraft route and widget. The source
// timezone token from FlightAware is preserved so an Eastern departure is
// never silently relabeled Central.

const TZ_ABBREVIATIONS = new Set([
  'EDT', 'EST', 'CDT', 'CST', 'MDT', 'MST', 'PDT', 'PST', 'AKDT', 'AKST', 'HST', 'UTC', 'GMT',
]);

export interface FlightTime {
  /** display string like "9:18 AM" */
  display: string;
  /** original timezone token when known, e.g. "CDT" */
  tz: string | null;
}

/**
 * Parse the time formats FlightAware and the alert worker actually emit:
 *  "09:18 CDT" (24h), "03:48PM CDT", "02:56a CDT", "3:23 PM", ISO strings.
 * Unknown markers like "(?)" return null.
 */
export function parseFlightTime(raw: string | null | undefined): FlightTime | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\(\s*\?\s*\)/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned === '?') return null;

  // Extract trailing timezone token if present
  let tz: string | null = null;
  let body = cleaned;
  const tzMatch = cleaned.match(/\b([A-Z]{2,4})\s*$/);
  if (tzMatch && TZ_ABBREVIATIONS.has(tzMatch[1])) {
    tz = tzMatch[1];
    body = cleaned.slice(0, tzMatch.index).trim();
  }

  // 12-hour with AM/PM (including single-letter a/p, no space)
  const ampmMatch = body.match(/^0?(\d{1,2}):(\d{2})\s*(am|pm|a|p)$/i);
  if (ampmMatch) {
    const hour = parseInt(ampmMatch[1], 10);
    const isPM = ampmMatch[3].toLowerCase().startsWith('p');
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return { display: `${h12}:${ampmMatch[2]} ${isPM ? 'PM' : 'AM'}`, tz };
  }

  // 24-hour "09:18" (FlightAware's current history format)
  const h24Match = body.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hour = parseInt(h24Match[1], 10);
    if (hour <= 23) {
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return { display: `${h12}:${h24Match[2]} ${hour >= 12 ? 'PM' : 'AM'}`, tz };
    }
  }

  // ISO or other Date-parseable string: render in Central (the wall's home tz)
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return {
      display: d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Chicago',
      }),
      tz: 'CT',
    };
  }

  return null;
}

/** Format a FlightTime for the wall: "9:18 AM CDT" (tz only when non-Central) */
export function formatFlightTime(t: FlightTime | null): string {
  if (!t) return '';
  if (!t.tz || t.tz === 'CDT' || t.tz === 'CST' || t.tz === 'CT') return t.display;
  return `${t.display} ${t.tz}`;
}

/**
 * Normalize duration strings: "0:33" or "1:12" to "33m" / "1h 12m".
 * `approximate` marks email-receipt-derived block times with a tilde.
 */
export function formatDuration(raw: string | null | undefined, approximate = false): string {
  if (!raw) return '';
  const cleaned = raw.replace(/\(\s*\?\s*\)/g, '').trim();
  if (!cleaned) return '';

  const colonMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    const text = h > 0 ? `${h}h ${m}m` : `${m}m`;
    return approximate ? `~${text}` : text;
  }
  // Already in "1h 12m" form
  if (/^\d+h( \d+m)?$|^\d+m$/.test(cleaned)) {
    return approximate ? `~${cleaned}` : cleaned;
  }
  return cleaned;
}

export function minutesToDuration(mins: number, approximate = false): string {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const text = h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  return approximate ? `~${text}` : text;
}
