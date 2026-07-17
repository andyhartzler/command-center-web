import { NextRequest, NextResponse } from 'next/server';
import { lookupAirport, distanceNm, type Airport } from '@/lib/airports';
import { parseFlightTime, formatFlightTime, formatDuration, minutesToDuration } from '@/lib/flightTime';
import { mergeFlights, type LedgerFlight, type MergeCandidate } from '@/lib/flightLedger';

// Aircraft tracker data layer.
// Event edges (fast, reliable) come from the FlightAware email alert worker;
// history comes from the residential-IP FlightAware scrape; the live picture
// comes from free keyless ADS-B aggregators (airplanes.live, adsb.lol,
// adsb.fi). Trust rule: never return a number the pipeline did not measure.

export type FlightPhase =
  | 'idle'
  | 'filed'
  | 'departed'
  | 'enroute'
  | 'approaching'
  | 'landed'
  | 'unknown';

interface LiveFix {
  lat: number;
  lon: number;
  /** feet, or null when the feed reports "ground" */
  altitudeFt: number | null;
  onGround: boolean;
  groundspeedKts: number | null;
  trackDeg: number | null;
  /** ft/min vertical rate when reported */
  baroRateFpm: number | null;
  /** seconds since the aggregator last saw a position */
  seenPosSec: number | null;
  /** epoch ms when this fix was fetched */
  fetchedAt: number;
  source: string;
}

interface FlightLogEntry {
  date: string;
  departure: string;
  departureAirport: Airport | null;
  arrival: string;
  arrivalAirport: Airport | null;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  status: 'completed' | 'in_progress' | 'planned';
}

interface RouteInfo {
  origin: Airport | null;
  originCode: string;
  destination: Airport | null;
  destinationCode: string;
  totalNm: number | null;
  remainingNm: number | null;
  progressPct: number | null;
  etaMinutes: number | null;
  etaSource: 'alert' | 'computed' | null;
}

interface TrackerResponse {
  tailNumber: string;
  aircraftType: string;
  hex: string | null;
  phase: FlightPhase;
  isAirborne: boolean;
  lastSeen: string | null;
  live: LiveFix | null;
  /** last known fix retained across coverage drops */
  lastFix: LiveFix | null;
  trail: Array<[number, number, number | null]>;
  route: RouteInfo | null;
  recentFlights: FlightLogEntry[];
  stats: {
    flightsThisMonth: number;
    minutesThisMonth: number;
    longestRecentLeg: string | null;
    totalFlights: number;
  };
  photo: { url: string; attribution: string } | null;
  source: string;
  cached?: boolean;
  stale?: boolean;
}

// ── Caches (module scope, keyed by tail) ────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const historyCache = new Map<string, CacheEntry<ScrapeResult | null>>();
const alertCache = new Map<string, CacheEntry<AlertResult | null>>();
const liveCache = new Map<string, CacheEntry<LiveFix | null>>();
const hexCache = new Map<string, string>();
const photoCache = new Map<string, CacheEntry<{ url: string; attribution: string } | null>>();
const trailStore = new Map<string, Array<[number, number, number | null, number]>>();
const lastFixStore = new Map<string, LiveFix>();
const responseCache = new Map<string, CacheEntry<TrackerResponse>>();

const HISTORY_TTL = 15 * 60_000;
const ALERT_TTL = 60_000;
const LIVE_TTL = 20_000;
// The email alert worker died 2026-03-28, so ADS-B is the departure edge:
// a cheap keyless check every 5 minutes catches a flight within minutes of
// takeoff, then the active cadence takes over at 20s.
const IDLE_LIVE_TTL = 5 * 60_000;
const PHOTO_TTL = 24 * 60 * 60_000;
const TRAIL_CAP = 240;
const LANDED_HOLD_MS = 3 * 60 * 60_000;
const AIRBORNE_TIMEOUT_MS = 6 * 60 * 60_000;

function fresh<T>(entry: CacheEntry<T> | undefined, ttl: number): T | undefined {
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return undefined;
}

// ── ADS-B live position (keyless, residential-friendly) ─────────────────────

interface AdsbAircraft {
  hex?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  baro_rate?: number;
  seen_pos?: number;
  t?: string;
}

const ADSB_PROVIDERS = [
  { name: 'airplanes.live', url: (reg: string) => `https://api.airplanes.live/v2/reg/${reg}` },
  { name: 'adsb.lol', url: (reg: string) => `https://api.adsb.lol/v2/reg/${reg}` },
  { name: 'adsb.fi', url: (reg: string) => `https://opendata.adsb.fi/api/v2/reg/${reg}` },
];

async function fetchLiveFix(tail: string): Promise<LiveFix | null> {
  const cached = fresh(liveCache.get(tail), LIVE_TTL);
  if (cached !== undefined) return cached;

  for (const provider of ADSB_PROVIDERS) {
    try {
      const res = await fetch(provider.url(tail), {
        headers: { 'User-Agent': 'command-center-dashboard (personal aircraft tracker)' },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const data: { ac?: AdsbAircraft[] } = await res.json();
      const ac = data.ac?.[0];
      if (!ac || ac.lat === undefined || ac.lon === undefined) continue;

      if (ac.hex) hexCache.set(tail, ac.hex.toUpperCase());
      const onGround = ac.alt_baro === 'ground';
      const fix: LiveFix = {
        lat: ac.lat,
        lon: ac.lon,
        altitudeFt: typeof ac.alt_baro === 'number' ? ac.alt_baro : null,
        onGround,
        groundspeedKts: typeof ac.gs === 'number' ? Math.round(ac.gs) : null,
        trackDeg: typeof ac.track === 'number' ? Math.round(ac.track) : null,
        baroRateFpm: typeof ac.baro_rate === 'number' ? ac.baro_rate : null,
        seenPosSec: typeof ac.seen_pos === 'number' ? ac.seen_pos : null,
        fetchedAt: Date.now(),
        source: provider.name,
      };
      liveCache.set(tail, { data: fix, ts: Date.now() });
      lastFixStore.set(tail, fix);

      // Trail: append when the position moved meaningfully
      if (!onGround) {
        const trail = trailStore.get(tail) ?? [];
        const last = trail[trail.length - 1];
        if (!last || distanceNm(last[0], last[1], fix.lat, fix.lon) > 0.05) {
          trail.push([fix.lat, fix.lon, fix.altitudeFt, Date.now()]);
          if (trail.length > TRAIL_CAP) trail.splice(0, trail.length - TRAIL_CAP);
          trailStore.set(tail, trail);
        }
      }
      return fix;
    } catch {
      continue;
    }
  }
  liveCache.set(tail, { data: null, ts: Date.now() });
  return null;
}

// ── FlightAware email alert worker (event edges) ────────────────────────────

interface AlertEvent {
  type: 'departure' | 'arrival' | 'unknown';
  tailNumber: string;
  origin: string;
  destination: string;
  time: string;
  rawSubject: string;
  receivedAt: string;
}

interface AlertResult {
  events: AlertEvent[];
  /** newest first */
  lastDeparture: { origin: string; destination: string; at: number } | null;
  lastArrival: { origin: string; destination: string; at: number } | null;
  lastFiled: { destination: string; at: number } | null;
  /** parsed "expected to arrive at GTU in 45 min" */
  eta: { destination: string; expectedAt: number } | null;
}

function parseSubject(raw: string): { origin: string; destination: string } {
  const depMatch = raw.match(/departed\s+(\w{3,4})\s+for\s+(\w{3,4})/i);
  if (depMatch) return { origin: depMatch[1], destination: depMatch[2] };
  const arrMatch = raw.match(/arrived\s+at\s+(\w{3,4})\s+from\s+(\w{3,4})/i);
  if (arrMatch) return { origin: arrMatch[2], destination: arrMatch[1] };
  const etaMatch = raw.match(/arrive\s+at\s+(\w{3,4})/i);
  if (etaMatch) return { origin: '', destination: etaMatch[1] };
  return { origin: '', destination: '' };
}

async function fetchAlerts(tail: string): Promise<AlertResult | null> {
  const cached = fresh(alertCache.get(tail), ALERT_TTL);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch('https://flight-alerts.hartzler.workers.dev/api/events', {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { events: AlertEvent[] } = await res.json();
    const events = (data.events ?? []).filter(e => e.tailNumber === tail);

    const result: AlertResult = {
      events,
      lastDeparture: null,
      lastArrival: null,
      lastFiled: null,
      eta: null,
    };

    for (const ev of events) {
      const at = new Date(ev.receivedAt).getTime();
      if (isNaN(at)) continue;
      const parsed = parseSubject(ev.rawSubject);
      const origin = ev.origin || parsed.origin;
      const destination = ev.destination || parsed.destination;

      if (ev.type === 'departure' && !result.lastDeparture) {
        result.lastDeparture = { origin, destination, at };
      } else if (ev.type === 'arrival' && !result.lastArrival) {
        result.lastArrival = { origin, destination, at };
      }

      if (!result.lastFiled && /flight plan/i.test(ev.rawSubject)) {
        result.lastFiled = { destination, at };
      }

      if (!result.eta) {
        const etaMatch = ev.rawSubject.match(/arrive\s+at\s+(\w{3,4})\s+in\s+(\d+)\s*min/i);
        if (etaMatch) {
          result.eta = {
            destination: etaMatch[1],
            expectedAt: at + parseInt(etaMatch[2], 10) * 60_000,
          };
        }
      }
    }

    alertCache.set(tail, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error('[aircraft] alert worker fetch error', err);
    return fresh(alertCache.get(tail), Infinity) ?? null;
  }
}

// ── FlightAware history scrape (residential IP required) ────────────────────

interface ScrapeRow {
  date: string;
  aircraftType: string;
  origin: string;
  destination: string;
  departureRaw: string;
  arrivalRaw: string;
  durationRaw: string;
}

interface ScrapeResult {
  aircraftType: string;
  rows: ScrapeRow[];
}

async function scrapeHistory(tail: string): Promise<ScrapeResult | null> {
  const cached = fresh(historyCache.get(tail), HISTORY_TTL);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(`https://www.flightaware.com/live/flight/${tail}/history`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/g;
    let historyTable: string | null = null;
    let match: RegExpExecArray | null;
    while ((match = tableRegex.exec(html)) !== null) {
      if (match[1].includes('Duration') && match[1].includes('Origin')) {
        historyTable = match[1];
        break;
      }
    }
    if (!historyTable) throw new Error('history table not found');

    const rows: ScrapeRow[] = [];
    let aircraftType = '';
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    while ((match = rowRegex.exec(historyTable)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(match[1])) !== null) {
        cells.push(
          cellMatch[1]
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim(),
        );
      }
      if (cells.length >= 7) {
        if (!aircraftType && cells[1]) aircraftType = cells[1];
        rows.push({
          date: cells[0],
          aircraftType: cells[1],
          origin: cells[2],
          destination: cells[3],
          departureRaw: cells[4],
          arrivalRaw: cells[5],
          durationRaw: cells[6],
        });
      }
    }

    const result: ScrapeResult = { aircraftType, rows };
    historyCache.set(tail, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error('[aircraft] FlightAware scrape error', err);
    // stale-while-revalidate: keep serving the old scrape
    return fresh(historyCache.get(tail), Infinity) ?? null;
  }
}

/** Extract "LRY" from FlightAware's "Harrisonville ( KLRY )" cell format */
function extractCode(cell: string): string {
  const m = cell.match(/\(\s*(\w+)\s*\)/);
  if (m) return m[1];
  return cell.replace(/\(\s*\?\s*\)/g, '').trim().slice(0, 4).trim();
}

function buildFlightLog(scrape: ScrapeResult | null): FlightLogEntry[] {
  if (!scrape) return [];
  return scrape.rows.map(row => {
    const depCode = extractCode(row.origin);
    const arrCode = extractCode(row.destination);
    const depTime = parseFlightTime(row.departureRaw);
    const arrTime = parseFlightTime(row.arrivalRaw);

    let status: FlightLogEntry['status'] = 'completed';
    if (!arrTime && depTime) status = 'in_progress';
    if (!depTime && !arrTime) status = 'planned';

    return {
      date: row.date,
      departure: depCode,
      departureAirport: lookupAirport(depCode),
      arrival: arrCode,
      arrivalAirport: lookupAirport(arrCode),
      departureTime: formatFlightTime(depTime),
      arrivalTime: formatFlightTime(arrTime),
      duration: formatDuration(row.durationRaw),
      status,
    };
  });
}

/** Pair departure/arrival alert events into completed legs for the ledger */
function alertLegs(alerts: AlertResult | null): MergeCandidate[] {
  if (!alerts) return [];
  const legs: MergeCandidate[] = [];
  const events = alerts.events; // newest first
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.type !== 'arrival') continue;
    const arrAt = new Date(ev.receivedAt).getTime();
    if (isNaN(arrAt)) continue;
    const arrParsed = parseSubject(ev.rawSubject);
    const dep = events[i + 1]?.type === 'departure' ? events[i + 1] : null;
    const depAt = dep ? new Date(dep.receivedAt).getTime() : NaN;
    const depParsed = dep ? parseSubject(dep.rawSubject) : null;

    const durationMin = dep && !isNaN(depAt) ? Math.round((arrAt - depAt) / 60_000) : null;
    legs.push({
      date: arrAt,
      departure: dep?.origin || depParsed?.origin || arrParsed.origin,
      arrival: ev.destination || arrParsed.destination,
      departureTime: dep && !isNaN(depAt)
        ? new Date(depAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })
        : '',
      arrivalTime: new Date(arrAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' }),
      // Email receipt deltas approximate block time; the tilde marks that
      duration: durationMin && durationMin > 0 && durationMin < 20 * 60 ? minutesToDuration(durationMin, true) : '',
      status: 'completed',
      source: 'flight-alerts',
    });
    if (dep) i++;
  }
  return legs;
}

const DISPLAY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ledgerToLog(flights: LedgerFlight[]): FlightLogEntry[] {
  return flights.map(f => {
    const [y, m, d] = f.date.split('-').map(Number);
    const display = m >= 1 && m <= 12 ? `${DISPLAY_MONTHS[m - 1]} ${d}, ${y}` : f.date;
    return {
      date: display,
      departure: f.departure,
      departureAirport: lookupAirport(f.departure),
      arrival: f.arrival,
      arrivalAirport: lookupAirport(f.arrival),
      departureTime: f.departureTime,
      arrivalTime: f.arrivalTime,
      duration: f.duration,
      status: f.status,
    };
  });
}

// ── Aircraft photo (planespotters pub API, 24h cache) ───────────────────────

async function fetchPhoto(tail: string): Promise<{ url: string; attribution: string } | null> {
  const cached = fresh(photoCache.get(tail), PHOTO_TTL);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(`https://api.planespotters.net/pub/photos/reg/${tail}`, {
      headers: {
        'User-Agent': 'CommandCenterDashboard/1.0 (+mailto:andrew@hartzler.us; personal aircraft tracker)',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const photo = data.photos?.[0];
    const result = photo
      ? {
          url: photo.thumbnail_large?.src ?? photo.thumbnail?.src ?? null,
          attribution: photo.photographer ?? '',
        }
      : null;
    const final = result?.url ? result : null;
    photoCache.set(tail, { data: final, ts: Date.now() });
    return final;
  } catch {
    photoCache.set(tail, { data: null, ts: Date.now() });
    return null;
  }
}

// ── Phase state machine ─────────────────────────────────────────────────────

function computePhase(opts: {
  live: LiveFix | null;
  lastFix: LiveFix | null;
  alerts: AlertResult | null;
  log: FlightLogEntry[];
  destination: Airport | null;
}): FlightPhase {
  const now = Date.now();
  const { live, alerts, log, destination } = opts;

  const dep = alerts?.lastDeparture ?? null;
  const arr = alerts?.lastArrival ?? null;
  const filed = alerts?.lastFiled ?? null;

  const departureActive = dep && (!arr || dep.at > arr.at) && now - dep.at < AIRBORNE_TIMEOUT_MS;
  const scrapeInProgress = log[0]?.status === 'in_progress';

  // Live airborne fix wins
  if (live && !live.onGround) {
    if (destination) {
      const remaining = distanceNm(live.lat, live.lon, destination.lat, destination.lon);
      const descending = (live.baroRateFpm ?? 0) < -200;
      if (remaining < 30 || ((live.altitudeFt ?? Infinity) < 4000 && descending)) {
        return 'approaching';
      }
    }
    return 'enroute';
  }

  // Landed: arrival email within hold window, or on-ground fix near destination
  if (arr && now - arr.at < LANDED_HOLD_MS && (!dep || arr.at > dep.at)) {
    return 'landed';
  }
  if (
    live?.onGround &&
    destination &&
    distanceNm(live.lat, live.lon, destination.lat, destination.lon) < 5 &&
    departureActive
  ) {
    return 'landed';
  }

  // Believed airborne but silent: departed briefly, then unknown after 6h
  if (departureActive || scrapeInProgress) {
    const depAt = dep?.at ?? 0;
    if (dep && now - depAt < 10 * 60_000 && !live) return 'departed';
    if (now - depAt > AIRBORNE_TIMEOUT_MS) return 'unknown';
    // No fix right now (GA coverage gaps are routine) but flight is active
    return 'enroute';
  }

  if (filed && now - filed.at < 3 * 60 * 60_000 && (!dep || filed.at > dep.at)) {
    return 'filed';
  }

  return 'idle';
}

// ── Route handler ───────────────────────────────────────────────────────────

const ACTIVE_PHASES: FlightPhase[] = ['filed', 'departed', 'enroute', 'approaching'];

export async function GET(request: NextRequest) {
  const tail = (request.nextUrl.searchParams.get('tail') || '').trim().toUpperCase();
  if (!tail) {
    return NextResponse.json({ error: 'tail parameter required' }, { status: 400 });
  }

  // Serve the whole response from cache when very fresh (multiple widgets)
  const cachedResponse = fresh(responseCache.get(tail), 10_000);
  if (cachedResponse) {
    return NextResponse.json({ ...cachedResponse, cached: true });
  }

  try {
    const [alerts, scrape] = await Promise.all([fetchAlerts(tail), scrapeHistory(tail)]);
    const log = buildFlightLog(scrape);

    // Determine whether a flight is believed active before spending an
    // ADS-B call; when idle, one live check per history TTL is enough to
    // catch flights the email worker missed.
    const dep = alerts?.lastDeparture ?? null;
    const arr = alerts?.lastArrival ?? null;
    const believedActive =
      (dep && (!arr || dep.at > arr.at) && Date.now() - dep.at < AIRBORNE_TIMEOUT_MS) ||
      log[0]?.status === 'in_progress' ||
      (alerts?.lastFiled && Date.now() - alerts.lastFiled.at < 3 * 60 * 60_000);

    let live: LiveFix | null = null;
    if (believedActive) {
      live = await fetchLiveFix(tail);
    } else {
      // Cheap idle check so departures are caught within minutes
      const lastLive = liveCache.get(tail);
      if (!lastLive || Date.now() - lastLive.ts > IDLE_LIVE_TTL) {
        live = await fetchLiveFix(tail);
      } else {
        live = fresh(lastLive, LIVE_TTL) ?? null;
      }
    }

    // Route endpoints: prefer live alert data, fall back to scrape row
    const originCode = dep?.origin || log[0]?.departure || '';
    const destinationCode =
      dep?.destination || alerts?.eta?.destination || log[0]?.arrival || '';
    const origin = lookupAirport(originCode);
    const destination = lookupAirport(destinationCode);

    const lastFix = lastFixStore.get(tail) ?? null;
    const phase = computePhase({ live, lastFix, alerts, log, destination });
    const isAirborne = phase === 'enroute' || phase === 'approaching' || phase === 'departed';

    // Route metrics only from measured data
    let route: RouteInfo | null = null;
    if (originCode || destinationCode) {
      let totalNm: number | null = null;
      let remainingNm: number | null = null;
      let progressPct: number | null = null;
      let etaMinutes: number | null = null;
      let etaSource: RouteInfo['etaSource'] = null;

      if (origin && destination) {
        totalNm = Math.round(distanceNm(origin.lat, origin.lon, destination.lat, destination.lon));
      }
      const fixForProgress = live && !live.onGround ? live : (isAirborne ? lastFix : null);
      if (fixForProgress && destination) {
        remainingNm = Math.round(
          distanceNm(fixForProgress.lat, fixForProgress.lon, destination.lat, destination.lon),
        );
        if (totalNm && totalNm > 0) {
          progressPct = Math.max(0, Math.min(100, Math.round((1 - remainingNm / totalNm) * 100)));
        }
        if (fixForProgress.groundspeedKts && fixForProgress.groundspeedKts > 30 && remainingNm !== null) {
          etaMinutes = Math.round((remainingNm / fixForProgress.groundspeedKts) * 60);
          etaSource = 'computed';
        }
      }
      // Alert-worker ETA wins when fresher than the computation
      if (alerts?.eta && alerts.eta.expectedAt > Date.now()) {
        etaMinutes = Math.round((alerts.eta.expectedAt - Date.now()) / 60_000);
        etaSource = 'alert';
      }

      route = {
        origin,
        originCode,
        destination,
        destinationCode,
        totalNm,
        remainingNm,
        progressPct,
        etaMinutes,
        etaSource,
      };
    }

    // Durable ledger: merge everything seen this poll (scrape window + alert
    // legs), then serve history FROM the ledger so flights never age out
    // when FlightAware's anonymous window rolls forward.
    const ledger = mergeFlights(tail, [
      ...log.map(f => ({
        date: f.date,
        departure: f.departure,
        arrival: f.arrival,
        departureTime: f.departureTime,
        arrivalTime: f.arrivalTime,
        duration: f.duration,
        status: f.status,
        source: 'flightaware-web',
      })),
      ...alertLegs(alerts),
    ]);
    const history = ledgerToLog(ledger).slice(0, 60);

    const monthIso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }).slice(0, 7);
    let flightsThisMonth = 0;
    let minutesThisMonth = 0;
    let longestMin = 0;
    for (const f of ledger) {
      const durMatch = f.duration.match(/(?:(\d+)h )?(\d+)m/);
      const mins = durMatch ? (parseInt(durMatch[1] || '0', 10) * 60 + parseInt(durMatch[2], 10)) : 0;
      if (f.date.startsWith(monthIso)) {
        flightsThisMonth++;
        minutesThisMonth += mins;
      }
      if (mins > longestMin) longestMin = mins;
    }

    const photo = await fetchPhoto(tail);
    const trail = (trailStore.get(tail) ?? []).map(
      ([lat, lon, alt]) => [lat, lon, alt] as [number, number, number | null],
    );

    const response: TrackerResponse = {
      tailNumber: tail,
      aircraftType: scrape?.aircraftType || '',
      hex: hexCache.get(tail) ?? null,
      phase,
      isAirborne,
      lastSeen: history[0]?.date ?? log[0]?.date ?? null,
      live: live && !live.onGround ? live : null,
      lastFix,
      trail: isAirborne ? trail : [],
      route: phase === 'idle' ? null : route,
      recentFlights: history,
      stats: {
        flightsThisMonth,
        minutesThisMonth,
        longestRecentLeg: longestMin > 0 ? minutesToDuration(longestMin) : null,
        totalFlights: ledger.length,
      },
      photo,
      source: live ? live.source : scrape ? 'flightaware-web' : alerts ? 'flight-alerts' : 'none',
    };

    // Clear the trail once idle again
    if (phase === 'idle' || phase === 'landed') {
      const t = trailStore.get(tail);
      if (phase === 'idle' && t?.length) trailStore.delete(tail);
    }

    responseCache.set(tail, { data: response, ts: Date.now() });
    return NextResponse.json(response);
  } catch (err) {
    console.error('[aircraft] fetch error', err);
    const stale = responseCache.get(tail);
    if (stale) {
      return NextResponse.json({ ...stale.data, cached: true, stale: true });
    }
    return NextResponse.json({ error: 'Failed to fetch aircraft data' }, { status: 500 });
  }
}
