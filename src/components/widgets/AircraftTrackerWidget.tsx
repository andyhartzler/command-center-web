'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plane, PlaneTakeoff } from 'lucide-react';
import { type AircraftTrackerConfig, type WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { useSharedClock, formatAge } from '@/hooks/useSharedClock';
import { useAppleMap } from '@/hooks/useAppleMap';
import { publishMoment } from '@/lib/moments';
import { tokens } from '@/lib/tokens';
import { TickingNumber } from '../motion/TickingNumber';

// The flagship widget: Dad's plane on a live map.
// Trust rules: never render a number the pipeline did not measure; always
// show fix age while airborne; approximations carry a tilde.

type FlightPhase = 'idle' | 'filed' | 'departed' | 'enroute' | 'approaching' | 'landed' | 'unknown';

interface AirportInfo {
  code: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
}

interface LiveFix {
  lat: number;
  lon: number;
  altitudeFt: number | null;
  onGround: boolean;
  groundspeedKts: number | null;
  trackDeg: number | null;
  seenPosSec: number | null;
  fetchedAt: number;
  source: string;
}

interface FlightLogEntry {
  date: string;
  departure: string;
  departureAirport: AirportInfo | null;
  arrival: string;
  arrivalAirport: AirportInfo | null;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  status: 'completed' | 'in_progress' | 'planned';
}

interface TrackerData {
  tailNumber: string;
  aircraftType: string;
  phase: FlightPhase;
  isAirborne: boolean;
  lastSeen: string | null;
  live: LiveFix | null;
  lastFix: LiveFix | null;
  trail: Array<[number, number, number | null]>;
  route: {
    origin: AirportInfo | null;
    originCode: string;
    destination: AirportInfo | null;
    destinationCode: string;
    totalNm: number | null;
    remainingNm: number | null;
    progressPct: number | null;
    etaMinutes: number | null;
  } | null;
  recentFlights: FlightLogEntry[];
  stats: {
    flightsThisMonth: number;
    minutesThisMonth: number;
    longestRecentLeg: string | null;
    totalFlights: number;
  };
  photo: { url: string; attribution: string } | null;
}

const PHASE_LABEL: Record<FlightPhase, string> = {
  idle: 'On the ground',
  filed: 'Flight plan filed',
  departed: 'Departed',
  enroute: 'Airborne',
  approaching: 'Approaching',
  landed: 'Landed',
  unknown: 'Signal lost',
};

const PHASE_COLOR: Record<FlightPhase, string> = {
  idle: 'var(--color-text-3)',
  filed: 'var(--color-info)',
  departed: 'var(--color-ok)',
  enroute: 'var(--color-ok)',
  approaching: 'var(--color-warn)',
  landed: 'var(--color-ok)',
  unknown: 'var(--color-warn)',
};

const ACTIVE_PHASES: FlightPhase[] = ['filed', 'departed', 'enroute', 'approaching'];

// Home field fallback when history is empty (Lawrence Smith Memorial)
const HOME_FALLBACK = { lat: 38.6099, lon: -94.3435 };

interface AircraftTrackerWidgetProps {
  config: AircraftTrackerConfig;
  style: WidgetStyle;
  widgetId?: string;
}

function planeGlyph(color: string, size = 26): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" style="filter: drop-shadow(0 0 6px ${tokens.accentGlow})"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
}

export function AircraftTrackerWidget({ config, style, widgetId }: AircraftTrackerWidgetProps) {
  const now = useSharedClock();
  const [live, setLive] = useState(false);

  const { data, isStale, lastUpdated } = usePolledData<TrackerData>(
    `/api/aircraft?tail=${encodeURIComponent(config.tailNumber)}`,
    // 5 min idle (the server's idle ADS-B check rides this cadence, catching
    // a departure within minutes), 20s while a flight is active
    { interval: 5 * 60_000, liveInterval: 20_000, live },
  );

  // Adaptive cadence follows the server phase
  useEffect(() => {
    if (!data) return;
    setLive(ACTIVE_PHASES.includes(data.phase));
  }, [data]);

  // Publish moments on real phase transitions
  const prevPhase = useRef<FlightPhase | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = prevPhase.current;
    prevPhase.current = data.phase;
    if (!prev || prev === data.phase || !widgetId) return;

    const routeText = data.route
      ? `${data.route.originCode || '...'} to ${data.route.destinationCode || '...'}`
      : '';
    if ((prev === 'idle' || prev === 'filed') && (data.phase === 'departed' || data.phase === 'enroute')) {
      publishMoment({
        type: 'aircraft.departed',
        widgetId,
        headline: `${config.ownerLabel} departed ${routeText}`,
        priority: config.autoJump === false ? 'normal' : 'high',
      });
    }
    if (data.phase === 'landed' && prev !== 'landed') {
      publishMoment({
        type: 'aircraft.landed',
        widgetId,
        headline: `${config.ownerLabel} landed`,
        priority: config.autoJump === false ? 'normal' : 'high',
      });
    }
  }, [data, widgetId, config.ownerLabel, config.autoJump]);

  const phase: FlightPhase = data?.phase ?? 'idle';
  const isActive = ACTIVE_PHASES.includes(phase) || phase === 'landed';

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ opacity: style.opacity }}>
      <TrackerMap data={data} phase={phase} homeAirport={config.homeAirport} />

      {/* Identity chip */}
      <div className="absolute top-2.5 left-2.5 z-10 glass-chip flex items-center gap-2.5 px-3 py-2">
        {config.showPhoto !== false && data?.photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.photo.url}
            alt={`${config.tailNumber}`}
            className="w-12 h-9 object-cover rounded-[8px]"
            style={{ border: '1px solid var(--border-card)' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span
            className="w-8 h-8 rounded-[8px] flex items-center justify-center"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <Plane size={16} style={{ color: 'var(--color-accent-400)' }} aria-hidden />
          </span>
        )}
        <div className="flex flex-col">
          <span className="type-label" style={{ fontSize: 12 }}>{config.ownerLabel}</span>
          <span className="font-mono text-[16px] font-semibold" style={{ color: 'var(--color-text-1)' }}>
            {config.tailNumber}
          </span>
          {data?.aircraftType && (
            <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              {data.aircraftType === 'S22T' ? 'CIRRUS SR22T' : data.aircraftType}
            </span>
          )}
        </div>
      </div>

      {/* Phase chip */}
      <div className="absolute top-2.5 right-2.5 z-10 glass-chip flex items-center gap-2 px-3 py-1.5">
        {(phase === 'enroute' || phase === 'departed') && <span className="live-dot" aria-hidden />}
        {phase === 'filed' && (
          <span className="live-dot" style={{ background: 'var(--color-info)', animationDuration: '3.6s' }} aria-hidden />
        )}
        <span
          className="font-mono text-[13px] font-semibold uppercase"
          style={{ color: PHASE_COLOR[phase], letterSpacing: 'var(--tracking-caps)' }}
        >
          {PHASE_LABEL[phase]}
        </span>
        {isStale && lastUpdated && (
          <span className="font-mono text-[12px]" style={{ color: 'var(--color-warn)' }}>
            {formatAge(lastUpdated, now)}
          </span>
        )}
      </div>

      {/* Coverage-drop honesty: airborne without a live fix */}
      {(phase === 'enroute' || phase === 'departed' || phase === 'unknown') && !data?.live && data?.lastFix && (
        <div className="absolute top-14 right-2.5 z-10 glass-chip px-2.5 py-1">
          <span className="font-mono text-[12px]" style={{ color: 'var(--color-warn)' }}>
            LAST SEEN {formatAge(data.lastFix.fetchedAt, now).toUpperCase()}
          </span>
        </div>
      )}

      {/* Telemetry strip while flying, or landed summary, or idle rail */}
      {isActive && phase !== 'landed' && phase !== 'filed' && (
        <TelemetryStrip data={data} now={now} />
      )}
      {phase === 'landed' && <LandedCard data={data} />}
      {(phase === 'idle' || phase === 'filed') && <IdleRail data={data} now={now} phase={phase} />}
    </div>
  );
}

// ── Map layer ───────────────────────────────────────────────────────────────

function TrackerMap({ data, phase, homeAirport }: {
  data: TrackerData | null;
  phase: FlightPhase;
  homeAirport?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const home = useMemo(() => {
    const first = data?.recentFlights?.[0];
    return (
      first?.arrivalAirport ??
      first?.departureAirport ??
      { lat: HOME_FALLBACK.lat, lon: HOME_FALLBACK.lon }
    );
  }, [data?.recentFlights]);

  const { map, ready } = useAppleMap(containerRef, {
    center: [home.lat, home.lon],
    zoom: 9,
    interactive: false,
  });

  const planeAnnotationRef = useRef<mapkit.Annotation | null>(null);
  const deadReckonRef = useRef<number>(0);

  // Rebuild overlays when the route or phase changes
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    m.removeOverlays(m.overlays);
    m.removeAnnotations(m.annotations);
    planeAnnotationRef.current = null;

    const route = data?.route;
    const origin = route?.origin;
    const dest = route?.destination;
    const fix = data?.live ?? data?.lastFix ?? null;
    const flying = phase === 'enroute' || phase === 'approaching' || phase === 'departed';

    // Idle route-frequency web: last 10 legs as faint arcs
    if ((phase === 'idle' || phase === 'filed') && data?.recentFlights) {
      const seen = new Set<string>();
      for (const f of data.recentFlights.slice(0, 10)) {
        if (!f.departureAirport || !f.arrivalAirport) continue;
        const key = [f.departure, f.arrival].sort().join('-');
        if (seen.has(key)) continue;
        seen.add(key);
        m.addOverlay(new mapkit.PolylineOverlay(
          [
            new mapkit.Coordinate(f.departureAirport.lat, f.departureAirport.lon),
            new mapkit.Coordinate(f.arrivalAirport.lat, f.arrivalAirport.lon),
          ],
          { style: new mapkit.Style({ lineWidth: 1, strokeColor: tokens.accent400, strokeOpacity: 0.18 }) },
        ));
      }
    }

    // Airport dots + labels
    const airportDot = (ap: AirportInfo, emphasized: boolean) => {
      const annotation = new mapkit.Annotation(
        new mapkit.Coordinate(ap.lat, ap.lon),
        () => {
          const el = document.createElement('div');
          el.style.display = 'flex';
          el.style.flexDirection = 'column';
          el.style.alignItems = 'center';
          el.style.gap = '3px';
          el.innerHTML = `
            <div style="width:${emphasized ? 10 : 8}px;height:${emphasized ? 10 : 8}px;border-radius:50%;
              background:${emphasized ? tokens.accent300 : tokens.text3};
              border:1.5px solid ${tokens.bg0};box-shadow:0 0 8px ${tokens.accentGlow}"></div>
            <div style="font-family:var(--font-mono);font-size:11px;color:${tokens.text2};
              background:${tokens.glassBg};padding:1px 6px;border-radius:6px;white-space:nowrap">
              ${ap.code}${ap.city ? ` ${ap.city}` : ''}</div>`;
          return el;
        },
        { anchorOffset: new DOMPoint(0, 0) },
      );
      m.addAnnotation(annotation);
    };

    if (origin) airportDot(origin, false);
    if (dest) airportDot(dest, true);

    // Route line ANCHORED to the plane's real position, so the drawn line
    // always passes through the aircraft. A straight origin->dest split by
    // percentage floats off the marker because GPS never rides the exact
    // rhumb line. Flown = origin -> [breadcrumb trail] -> plane (solid);
    // remaining = plane -> dest (dashed).
    if (flying && origin && dest) {
      const toCoord = (c: number[]) => new mapkit.Coordinate(c[0], c[1]);
      if (fix) {
        const trail: number[][] =
          data?.trail && data.trail.length > 1
            ? data.trail.slice(-30).map(([lat, lon]) => [lat, lon])
            : [];
        const flown: number[][] = [
          [origin.lat, origin.lon],
          ...trail,
          [fix.lat, fix.lon],
        ];
        m.addOverlay(new mapkit.PolylineOverlay(flown.map(toCoord), {
          style: new mapkit.Style({ lineWidth: 2, strokeColor: tokens.accent400, strokeOpacity: 0.9 }),
        }));
        m.addOverlay(new mapkit.PolylineOverlay([[fix.lat, fix.lon], [dest.lat, dest.lon]].map(toCoord), {
          style: new mapkit.Style({ lineWidth: 2, strokeColor: tokens.accent400, strokeOpacity: 0.35, lineDash: [4, 6] }),
        }));
      } else {
        // No live fix yet: a faint straight origin->dest guide.
        m.addOverlay(new mapkit.PolylineOverlay([[origin.lat, origin.lon], [dest.lat, dest.lon]].map(toCoord), {
          style: new mapkit.Style({ lineWidth: 2, strokeColor: tokens.accent400, strokeOpacity: 0.35, lineDash: [4, 6] }),
        }));
      }
    }

    // The plane
    if (fix && (flying || phase === 'landed' || phase === 'idle' || phase === 'unknown')) {
      const hasSignal = !!data?.live;
      const dimmed = !hasSignal || phase === 'idle';
      const annotation = new mapkit.Annotation(
        new mapkit.Coordinate(fix.lat, fix.lon),
        () => {
          const el = document.createElement('div');
          el.style.transform = `rotate(${fix.trackDeg ?? 0}deg)`;
          el.style.opacity = dimmed ? '0.5' : '1';
          el.style.transition = 'opacity 800ms var(--ease-out)';
          el.innerHTML = planeGlyph(dimmed ? tokens.text3 : tokens.accent300, phase === 'idle' ? 18 : 26);
          return el;
        },
        { anchorOffset: new DOMPoint(0, 0) },
      );
      m.addAnnotation(annotation);
      planeAnnotationRef.current = annotation;
    }

    // Camera framing: include the plane's real position so it is always in
    // view even when it sits off the straight origin-dest line.
    if (flying && origin && dest) {
      const lats = [origin.lat, dest.lat];
      const lons = [origin.lon, dest.lon];
      if (fix) { lats.push(fix.lat); lons.push(fix.lon); }
      const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
      const lonMid = (Math.min(...lons) + Math.max(...lons)) / 2;
      const latSpan = Math.max(0.4, (Math.max(...lats) - Math.min(...lats)) * 1.5);
      const lonSpan = Math.max(0.4, (Math.max(...lons) - Math.min(...lons)) * 1.5);
      m.setRegionAnimated(
        new mapkit.CoordinateRegion(
          new mapkit.Coordinate(latMid, lonMid),
          new mapkit.CoordinateSpan(latSpan, lonSpan),
        ),
        true,
      );
    } else if (phase === 'approaching' && dest) {
      m.setRegionAnimated(
        new mapkit.CoordinateRegion(
          new mapkit.Coordinate(dest.lat, dest.lon),
          new mapkit.CoordinateSpan(0.5, 0.5),
        ),
        true,
      );
    } else if (!flying) {
      const center = fix ?? home;
      m.setRegionAnimated(
        new mapkit.CoordinateRegion(
          new mapkit.Coordinate(center.lat, center.lon),
          new mapkit.CoordinateSpan(1.6, 1.6),
        ),
        true,
      );
    }
  }, [map, ready, data, phase, home, homeAirport]);

  // Dead-reckoning: glide the marker along its track between polls
  useEffect(() => {
    const fix = data?.live;
    if (!fix || phase !== 'enroute' || !fix.groundspeedKts || !fix.trackDeg) return;

    const kts = fix.groundspeedKts;
    const trackRad = (fix.trackDeg * Math.PI) / 180;
    const startLat = fix.lat;
    const startLon = fix.lon;
    const startTime = performance.now();

    const stepFrame = () => {
      const annotation = planeAnnotationRef.current;
      if (!annotation) return;
      const elapsedHr = (performance.now() - startTime) / 3_600_000;
      const dNm = kts * elapsedHr;
      const dLat = (dNm / 60) * Math.cos(trackRad);
      const dLon = (dNm / 60) * Math.sin(trackRad) / Math.cos((startLat * Math.PI) / 180);
      annotation.coordinate = new mapkit.Coordinate(startLat + dLat, startLon + dLon);
      deadReckonRef.current = requestAnimationFrame(stepFrame);
    };
    deadReckonRef.current = requestAnimationFrame(stepFrame);
    return () => cancelAnimationFrame(deadReckonRef.current);
  }, [data?.live, phase]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

// ── Telemetry strip (enroute/approaching) ───────────────────────────────────

function TelemetryStrip({ data, now }: { data: TrackerData | null; now: number }) {
  const live = data?.live;
  const route = data?.route;

  const cells: Array<{ label: string; node: React.ReactNode }> = [];
  if (live?.altitudeFt != null) {
    cells.push({
      label: 'ALT',
      node: <><TickingNumber value={live.altitudeFt} className="text-[17px] font-medium" /> <span className="text-[12px]">FT</span></>,
    });
  }
  if (live?.groundspeedKts != null) {
    cells.push({
      label: 'GS',
      node: <><TickingNumber value={live.groundspeedKts} className="text-[17px] font-medium" /> <span className="text-[12px]">KTS</span></>,
    });
  }
  if (live?.trackDeg != null) {
    cells.push({ label: 'HDG', node: <span className="font-mono text-[17px] font-medium">{live.trackDeg}&deg;</span> });
  }
  if (route?.etaMinutes != null && route.etaMinutes >= 0) {
    cells.push({
      label: 'ETA',
      node: <><TickingNumber value={route.etaMinutes} className="text-[17px] font-medium" /> <span className="text-[12px]">MIN</span></>,
    });
  }

  return (
    <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 glass-chip px-4 pt-2 pb-2.5">
      <div className="flex items-center justify-between gap-3">
        {route && (
          <span className="font-mono text-[13px] shrink-0" style={{ color: 'var(--color-text-2)' }}>
            {route.originCode || '...'}
            <span style={{ color: 'var(--color-text-3)' }}> to </span>
            {route.destinationCode || '...'}
          </span>
        )}
        <div className="flex items-center gap-4 ml-auto">
          {cells.map(cell => (
            <div key={cell.label} className="flex items-baseline gap-1.5">
              <span className="type-label" style={{ fontSize: 11 }}>{cell.label}</span>
              <span style={{ color: 'var(--color-text-1)' }}>{cell.node}</span>
            </div>
          ))}
          {live && (
            <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              fix {formatAge(live.fetchedAt, now)}
            </span>
          )}
        </div>
      </div>
      {route?.progressPct != null && (
        <div className="mt-1.5 h-[2px] rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${route.progressPct}%`,
              background: 'var(--color-accent-400)',
              transition: 'width 2s var(--ease-out)',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Landed summary (holds 3 hours) ──────────────────────────────────────────

function LandedCard({ data }: { data: TrackerData | null }) {
  const lastFlight = data?.recentFlights?.[0];
  const dest = data?.route?.destination ?? lastFlight?.arrivalAirport ?? null;
  const destCode = data?.route?.destinationCode || lastFlight?.arrival || '';

  return (
    <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 glass-chip flex items-center gap-3 px-4 py-3">
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'rgba(95,206,143,0.15)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="type-body font-medium truncate" style={{ color: 'var(--color-text-1)' }}>
          Landed{destCode ? ` at ${destCode}` : ''}{dest?.city ? `, ${dest.city}` : ''}
        </div>
        <div className="font-mono text-[13px] truncate" style={{ color: 'var(--color-text-3)' }}>
          {lastFlight?.arrivalTime ? `${lastFlight.arrivalTime}` : ''}
          {lastFlight?.duration ? ` after ${lastFlight.duration}` : ''}
          {lastFlight?.departure ? ` from ${lastFlight.departure}` : ''}
        </div>
      </div>
    </div>
  );
}

// ── Idle rail: flight log + month stats ─────────────────────────────────────

function IdleRail({ data, now, phase }: { data: TrackerData | null; now: number; phase: FlightPhase }) {
  const flights = data?.recentFlights ?? [];
  const stats = data?.stats;

  return (
    <>
      {/* Status line, bottom-left */}
      <div className="absolute bottom-2.5 left-2.5 z-10 glass-chip px-3 py-1.5 flex items-center gap-2">
        <PlaneTakeoff size={13} style={{ color: 'var(--color-text-3)' }} aria-hidden />
        <span className="font-mono text-[13px]" style={{ color: 'var(--color-text-2)' }}>
          {phase === 'filed'
            ? 'Preparing to fly'
            : data?.lastSeen
              ? `Last flight ${data.lastSeen}`
              : 'No recent flights'}
        </span>
        {stats && stats.flightsThisMonth > 0 && (
          <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            {stats.flightsThisMonth} this month
            {stats.minutesThisMonth > 0 ? ` / ${Math.floor(stats.minutesThisMonth / 60)}h ${stats.minutesThisMonth % 60}m` : ''}
          </span>
        )}
        {stats && stats.totalFlights > 0 && (
          <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            {stats.totalFlights} logged
          </span>
        )}
      </div>

      {/* Flight log rail, hidden on narrow widgets */}
      {flights.length > 0 && (
        <div
          className="absolute top-2.5 bottom-12 right-2.5 z-10 glass-chip w-[220px] hidden flex-col overflow-hidden @[440px]:flex"
        >
          <div className="px-3 pt-2 pb-1 type-label" style={{ fontSize: 11 }}>Recent flights</div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {flights.slice(0, 14).map((f, i) => (
              <div
                key={`${f.date}-${f.departure}-${f.arrival}`}
                className="px-3 py-1.5"
                style={{
                  borderTop: '1px solid var(--border-card)',
                  background: i === 0 ? 'rgba(138,167,195,0.06)' : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[13px] font-medium" style={{ color: 'var(--color-text-1)' }}>
                    {f.departure} <span style={{ color: 'var(--color-text-3)' }}>to</span> {f.arrival || '...'}
                  </span>
                  <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>{f.duration}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] truncate" style={{ color: 'var(--color-text-3)' }}>
                    {f.arrivalAirport?.city || f.departureAirport?.city || ''}
                  </span>
                  <span className="font-mono text-[12px] shrink-0" style={{ color: 'var(--color-text-3)' }}>{f.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
