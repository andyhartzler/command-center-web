import fs from 'fs';
import path from 'path';

// Durable flight ledger. FlightAware's anonymous history page only exposes a
// ~14 day window, so every flight seen from any source (scrape, email alert
// legs, live ADS-B landings) is merged here permanently. The file lives on
// the container's persistent volume (/app/data), the same store that keeps
// OAuth tokens across redeploys. History only ever grows.

export interface LedgerFlight {
  /** ISO date of the flight, e.g. "2026-07-12" */
  date: string;
  departure: string;
  arrival: string;
  /** display times like "9:18 AM" (empty when unknown) */
  departureTime: string;
  arrivalTime: string;
  /** normalized duration like "33m" or "~34m" for approximations */
  duration: string;
  status: 'completed' | 'in_progress' | 'planned';
  /** where this flight was first seen: flightaware-web | flight-alerts */
  source: string;
  /** epoch ms when the ledger first recorded it */
  firstSeenAt: number;
  /** epoch ms of the most recent update to this entry */
  updatedAt: number;
}

interface LedgerFile {
  version: 1;
  tails: Record<string, LedgerFlight[]>;
}

const LEDGER_PATH = path.join(process.cwd(), 'data', 'flight-ledger.json');

let cache: LedgerFile | null = null;

function load(): LedgerFile {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(LEDGER_PATH, 'utf8');
    const parsed = JSON.parse(raw) as LedgerFile;
    if (parsed && parsed.version === 1 && parsed.tails) {
      cache = parsed;
      return parsed;
    }
  } catch { /* first run or unreadable: start fresh */ }
  cache = { version: 1, tails: {} };
  return cache;
}

function persist(ledger: LedgerFile): void {
  try {
    fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
    // Atomic write so a crash mid-write never corrupts the ledger
    const tmp = `${LEDGER_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(ledger));
    fs.renameSync(tmp, LEDGER_PATH);
  } catch (err) {
    console.error('[flightLedger] persist failed', err);
  }
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** Parse dates the sources emit: "12-Jul-2026", ISO strings, epoch ms */
export function toIsoDate(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : centralIso(d);
  }
  const faMatch = raw.match(/^(\d{1,2})-(\w{3})-(\d{4})$/);
  if (faMatch) {
    const month = MONTHS[faMatch[2].toLowerCase()];
    if (month) return `${faMatch[3]}-${month}-${faMatch[1].padStart(2, '0')}`;
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return centralIso(d);
  return null;
}

function centralIso(d: Date): string {
  // en-CA locale renders YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

function entryKey(f: Pick<LedgerFlight, 'date' | 'departure' | 'arrival'>): string {
  return `${f.date}|${f.departure}|${f.arrival}`;
}

function betterOf(existing: LedgerFlight, incoming: LedgerFlight): LedgerFlight {
  // Exact scraped times beat approximate alert-derived ones; a completed
  // status beats in_progress; never lose data we already had.
  const preferIncomingTimes =
    (!existing.departureTime && incoming.departureTime) ||
    (existing.duration.startsWith('~') && incoming.duration && !incoming.duration.startsWith('~'));
  return {
    ...existing,
    departureTime: preferIncomingTimes ? incoming.departureTime : existing.departureTime || incoming.departureTime,
    arrivalTime: preferIncomingTimes ? incoming.arrivalTime : existing.arrivalTime || incoming.arrivalTime,
    duration: preferIncomingTimes ? incoming.duration : existing.duration || incoming.duration,
    status: incoming.status === 'completed' ? 'completed' : existing.status,
    updatedAt: Date.now(),
  };
}

export interface MergeCandidate {
  date: string | number | null | undefined;
  departure: string;
  arrival: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  status?: LedgerFlight['status'];
  source: string;
}

/**
 * Merge flights into the ledger; returns the full (updated) history for the
 * tail, newest first. Entries missing a parseable date or both airport codes
 * are skipped; in_progress rows update in place once completed.
 */
export function mergeFlights(tail: string, candidates: MergeCandidate[]): LedgerFlight[] {
  const ledger = load();
  const flights = ledger.tails[tail] ?? [];
  const byKey = new Map(flights.map(f => [entryKey(f), f]));
  let dirty = false;

  for (const c of candidates) {
    const iso = toIsoDate(c.date);
    const dep = (c.departure || '').trim().toUpperCase();
    const arr = (c.arrival || '').trim().toUpperCase();
    if (!iso || (!dep && !arr)) continue;

    const incoming: LedgerFlight = {
      date: iso,
      departure: dep,
      arrival: arr,
      departureTime: c.departureTime ?? '',
      arrivalTime: c.arrivalTime ?? '',
      duration: c.duration ?? '',
      status: c.status ?? 'completed',
      source: c.source,
      firstSeenAt: Date.now(),
      updatedAt: Date.now(),
    };

    const key = entryKey(incoming);
    const existing = byKey.get(key);
    if (existing) {
      const merged = betterOf(existing, incoming);
      if (JSON.stringify(merged) !== JSON.stringify(existing)) {
        byKey.set(key, merged);
        dirty = true;
      }
    } else {
      byKey.set(key, incoming);
      dirty = true;
    }
  }

  const updated = [...byKey.values()].sort((a, b) =>
    a.date === b.date ? (b.departureTime || '').localeCompare(a.departureTime || '') : b.date.localeCompare(a.date),
  );

  if (dirty) {
    ledger.tails[tail] = updated;
    persist(ledger);
  }
  return updated;
}

export function getLedger(tail: string): LedgerFlight[] {
  return load().tails[tail] ?? [];
}
