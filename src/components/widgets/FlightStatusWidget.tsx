'use client';
import { useEffect, useState } from 'react';
import { type FlightStatusConfig, type WidgetStyle } from '@/types/widget';
import { Plane, PlaneLanding, ArrowRightLeft } from 'lucide-react';
import { WidgetShell, Freshness } from './WidgetShell';
import { usePolledData } from '@/hooks/usePolledData';

interface FlightInfo {
  flightNumber: string;
  airline: string;
  airlineIata: string;
  origin: string;
  destination: string;
  scheduledTime: string;
  estimatedTime: string | null;
  actualTime: string | null;
  status: 'scheduled' | 'en_route' | 'landed' | 'delayed' | 'cancelled' | 'unknown';
  aircraft: string;
  gate: string | null;
  terminal: string | null;
}

interface FlightsPayload {
  flights?: FlightInfo[];
  source?: string;
}

const POLL_INTERVAL = 120_000;

const STATUS_TOKENS: Record<FlightInfo['status'], { color: string; label: string }> = {
  scheduled: { color: 'var(--color-info)', label: 'Scheduled' },
  en_route: { color: 'var(--color-ok)', label: 'En Route' },
  landed: { color: 'var(--color-text-2)', label: 'Landed' },
  delayed: { color: 'var(--color-warn)', label: 'Delayed' },
  cancelled: { color: 'var(--color-critical)', label: 'Cancelled' },
  unknown: { color: 'var(--color-text-3)', label: 'Unknown' },
};

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '--:--';
  // If already a short time like "02:56a CDT" or "3:23PM CST", clean it up
  const rawMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(a|p|am|pm)\s*\w*$/i);
  if (rawMatch) {
    let hour = parseInt(rawMatch[1]);
    const min = rawMatch[2];
    const ampm = rawMatch[3].toLowerCase().startsWith('p') ? 'PM' : 'AM';
    if (hour === 0) hour = 12;
    return `${hour}:${min} ${ampm}`;
  }
  // Try as ISO date
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'America/Chicago',
    });
  } catch {
    return '--:--';
  }
}

// Map ICAO 3-letter codes to IATA 2-letter codes for logo lookup
const ICAO_TO_IATA: Record<string, string> = {
  SWA: 'WN', AAL: 'AA', DAL: 'DL', UAL: 'UA', NKS: 'NK',
  ASA: 'AS', JBU: 'B6', FFT: 'F9', AAY: 'G4', SKW: 'OO',
  ASH: 'YV', RPA: 'YX', QXE: 'QX', ENY: 'MQ', JIA: 'OH',
  AWI: 'ZW', EDV: '9E', UPS: '5X', FDX: 'FX',
};

function AirlineBadge({ iata, airline, icaoIdent }: { iata: string; airline: string; icaoIdent?: string }) {
  // Try to resolve IATA code from ICAO ident prefix
  const resolvedIata = iata || (icaoIdent ? ICAO_TO_IATA[icaoIdent.replace(/[0-9]/g, '')] : '') || '';
  const initials = resolvedIata || airline.slice(0, 2).toUpperCase();
  // Google Flights dark-background logos - high quality, consistent style
  const logoUrl = resolvedIata
    ? `https://www.gstatic.com/flights/airline_logos/70px/dark/${resolvedIata}.png`
    : '';

  return (
    <div
      className="w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-mono font-semibold shrink-0 overflow-hidden"
      style={{
        backgroundColor: logoUrl ? 'transparent' : 'var(--color-surface-3)',
        color: 'var(--color-text-2)',
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={resolvedIata}
          className="w-full h-full object-contain"
          onError={(e) => {
            // Fallback to initials if logo fails
            const el = e.currentTarget;
            el.style.display = 'none';
            if (el.parentElement) {
              el.parentElement.style.backgroundColor = 'var(--color-surface-3)';
              el.parentElement.textContent = initials;
            }
          }}
        />
      ) : (
        initials
      )}
    </div>
  );
}

interface FlightStatusWidgetProps {
  config: FlightStatusConfig;
  style: WidgetStyle;
}

export function FlightStatusWidget({ config, style }: FlightStatusWidgetProps) {
  // Mode derives from config; the toggle is a session-local override that
  // resets whenever the configured mode changes.
  const [override, setOverride] = useState<'arrivals' | 'departures' | null>(null);
  useEffect(() => { setOverride(null); }, [config.mode]);
  const mode = override ?? config.mode;

  const { data, phase, isStale, lastUpdated } = usePolledData<FlightsPayload>(
    `/api/flights?airport=${encodeURIComponent(config.airport)}&type=${mode}&limit=${config.limit}`,
    { interval: POLL_INTERVAL },
  );

  const flights = data?.flights ?? [];

  return (
    <WidgetShell
      icon={<Plane size={18} />}
      title={`${config.airport} ${mode === 'arrivals' ? 'Arrivals' : 'Departures'}`}
      status={
        <>
          <button
            onClick={() => setOverride(mode === 'arrivals' ? 'departures' : 'arrivals')}
            className="glass-chip flex items-center gap-1 px-2 py-0.5 cursor-pointer"
            style={{ color: 'var(--color-text-2)' }}
          >
            <ArrowRightLeft size={12} aria-hidden />
            <span className="text-[12px] uppercase" style={{ letterSpacing: 'var(--tracking-caps)' }}>
              {mode === 'arrivals' ? 'Dep' : 'Arr'}
            </span>
          </button>
          <Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />
        </>
      }
      footer={
        lastUpdated ? (
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-mono" style={{ color: 'var(--color-text-3)' }}>
              Fetched {new Date(lastUpdated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
            <span className="text-[12px] font-mono" style={{ color: 'var(--color-text-3)' }}>
              {flights.length} flights
            </span>
          </div>
        ) : undefined
      }
      style={style}
    >
      <div className="w-full h-full flex flex-col">
        {/* Column headers */}
        <div
          className="flex items-center px-3.5 py-1 text-[12px] uppercase shrink-0"
          style={{
            color: 'var(--color-text-3)',
            letterSpacing: 'var(--tracking-caps)',
            borderBottom: '1px solid var(--border-card)',
          }}
        >
          <span className="w-9" />
          <span className="flex-1 min-w-0">Flights</span>
          <span className="w-12 text-center">{mode === 'arrivals' ? 'From' : 'To'}</span>
          <span className="w-16 text-center">Time</span>
          <span className="w-20 text-right">Status</span>
        </div>

        {/* Flight list */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
          {phase === 'loading' && flights.length === 0 ? (
            <div className="flex flex-col gap-1.5 px-3.5 pt-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-[10px] animate-pulse"
                  style={{ background: 'var(--color-surface-2)', opacity: 0.5 }}
                />
              ))}
            </div>
          ) : flights.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-2">
                <PlaneLanding size={20} style={{ color: 'var(--color-text-3)' }} />
                <span className="type-body" style={{ color: 'var(--color-text-3)' }}>
                  No flights reported
                </span>
              </div>
            </div>
          ) : (
            flights.map((flight, i) => {
              const status = STATUS_TOKENS[flight.status] || STATUS_TOKENS.unknown;
              const displayTime = flight.actualTime || flight.estimatedTime || flight.scheduledTime;
              const isDelayed = flight.status === 'delayed';
              const cityCode = mode === 'arrivals' ? flight.origin : flight.destination;

              return (
                <div
                  key={`${flight.flightNumber}-${i}`}
                  className="flex items-center gap-2 px-3.5 py-1.5"
                  style={{
                    borderBottom: i !== flights.length - 1 ? '1px solid var(--border-card)' : undefined,
                  }}
                >
                  <AirlineBadge iata={flight.airlineIata} airline={flight.airline} icaoIdent={flight.flightNumber} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className="text-[13px] font-mono font-semibold truncate"
                        style={{ color: 'var(--color-text-1)' }}
                      >
                        {flight.flightNumber}
                      </span>
                      {flight.aircraft && (
                        <span className="text-[12px] font-mono" style={{ color: 'var(--color-text-3)' }}>
                          {flight.aircraft}
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] truncate block" style={{ color: 'var(--color-text-3)' }}>
                      {flight.airline}
                    </span>
                  </div>

                  <div className="w-12 text-center">
                    <span className="text-[13px] font-mono font-semibold" style={{ color: 'var(--color-text-2)' }}>
                      {cityCode || '--'}
                    </span>
                  </div>

                  <div className="w-16 text-center flex flex-col items-center">
                    <span
                      className="text-[13px] font-mono"
                      style={{ color: isDelayed ? 'var(--color-warn)' : 'var(--color-text-2)' }}
                    >
                      {formatTime(displayTime)}
                    </span>
                    {isDelayed && flight.scheduledTime !== displayTime && (
                      <span
                        className="text-[12px] font-mono line-through"
                        style={{ color: 'var(--color-text-3)' }}
                      >
                        {formatTime(flight.scheduledTime)}
                      </span>
                    )}
                  </div>

                  <div className="w-20 flex justify-end">
                    <span
                      className="text-[12px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        color: status.color,
                        background: `color-mix(in srgb, ${status.color} 16%, transparent)`,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
