'use client';
import { useState, useEffect, useCallback } from 'react';
import { type FlightStatusConfig, type WidgetStyle } from '@/types/widget';
import { Plane, PlaneTakeoff, PlaneLanding, Clock, ArrowRightLeft } from 'lucide-react';

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

// Airline IATA to logo color mapping (brand colors for badge backgrounds)
const AIRLINE_COLORS: Record<string, string> = {
  WN: '#304CB2', AA: '#C8102E', DL: '#003366', UA: '#002244', NK: '#FFE600',
  AS: '#01426A', B6: '#003876', F9: '#00B140', G4: '#F37021', OO: '#003087',
  YV: '#1C3C6B', YX: '#003DA5', QX: '#003DA5', MQ: '#C8102E', OH: '#C8102E',
  ZW: '#003DA5', '9E': '#002244',
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: 'bg-[#6b8aab]/20', text: 'text-[#6b8aab]', label: 'Scheduled' },
  en_route: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'En Route' },
  landed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Landed' },
  delayed: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Delayed' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelled' },
  unknown: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Unknown' },
};

function formatTime(iso: string | null): string {
  if (!iso) return '--:--';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '--:--';
  }
}

function AirlineBadge({ iata, airline }: { iata: string; airline: string }) {
  const bg = AIRLINE_COLORS[iata] || '#475569';
  const initials = iata || airline.slice(0, 2).toUpperCase();
  return (
    <div
      className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
      style={{ backgroundColor: bg }}
    >
      {initials}
    </div>
  );
}

interface FlightStatusWidgetProps {
  config: FlightStatusConfig;
  style: WidgetStyle;
}

export function FlightStatusWidget({ config }: FlightStatusWidgetProps) {
  const [flights, setFlights] = useState<FlightInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'arrivals' | 'departures'>(config.mode);
  const [source, setSource] = useState('');

  const fetchFlights = useCallback(async () => {
    try {
      const res = await fetch(`/api/flights?airport=${config.airport}&type=${mode}&limit=${config.limit}`);
      if (res.ok) {
        const data = await res.json();
        setFlights(data.flights || []);
        setSource(data.source || '');
      }
    } catch (err) {
      console.error('[FlightStatus] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [config.airport, config.limit, mode]);

  useEffect(() => {
    setLoading(true);
    fetchFlights();
    const interval = setInterval(fetchFlights, 120_000);
    return () => clearInterval(interval);
  }, [fetchFlights]);

  return (
    <div className="w-full h-full flex flex-col bg-[#1a1a1c] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <Plane size={14} className="text-sky-400" />
          <span className="text-[11px] font-semibold text-white/90 tracking-wide uppercase">
            {config.airport} {mode === 'arrivals' ? 'Arrivals' : 'Departures'}
          </span>
        </div>
        <button
          onClick={() => setMode(m => m === 'arrivals' ? 'departures' : 'arrivals')}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowRightLeft size={10} className="text-white/50" />
          <span className="text-[9px] text-white/50">
            {mode === 'arrivals' ? 'DEP' : 'ARR'}
          </span>
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-3 py-1 text-[8px] font-medium text-white/30 uppercase tracking-wider border-b border-white/5 shrink-0">
        <span className="w-8" />
        <span className="flex-1 min-w-0">Flight</span>
        <span className="w-12 text-center">{mode === 'arrivals' ? 'From' : 'To'}</span>
        <span className="w-16 text-center">Time</span>
        <span className="w-16 text-right">Status</span>
      </div>

      {/* Flight list */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {loading && flights.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Plane size={20} className="text-white/20 animate-pulse" />
              <span className="text-[10px] text-white/30">Loading flights...</span>
            </div>
          </div>
        ) : flights.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <PlaneLanding size={20} className="text-white/20" />
              <span className="text-[10px] text-white/30">No flight data available</span>
              {source === 'none' && (
                <span className="text-[8px] text-white/20">Set AVIATIONSTACK_KEY or FLIGHTAWARE_KEY</span>
              )}
            </div>
          </div>
        ) : (
          flights.map((flight, i) => {
            const statusStyle = STATUS_STYLES[flight.status] || STATUS_STYLES.unknown;
            const displayTime = flight.actualTime || flight.estimatedTime || flight.scheduledTime;
            const isDelayed = flight.status === 'delayed';
            const cityCode = mode === 'arrivals' ? flight.origin : flight.destination;

            return (
              <div
                key={`${flight.flightNumber}-${i}`}
                className={`flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.03] transition-colors ${
                  i !== flights.length - 1 ? 'border-b border-white/[0.04]' : ''
                }`}
              >
                <AirlineBadge iata={flight.airlineIata} airline={flight.airline} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-white/90 truncate">
                      {flight.flightNumber}
                    </span>
                    {flight.aircraft && (
                      <span className="text-[8px] text-white/25 font-mono">{flight.aircraft}</span>
                    )}
                  </div>
                  <span className="text-[9px] text-white/40 truncate block">{flight.airline}</span>
                </div>

                <div className="w-12 text-center">
                  <span className="text-[11px] font-mono font-semibold text-white/70">{cityCode || '--'}</span>
                </div>

                <div className="w-16 text-center flex flex-col items-center">
                  <span className={`text-[11px] font-mono ${isDelayed ? 'text-amber-400' : 'text-white/70'}`}>
                    {formatTime(displayTime)}
                  </span>
                  {isDelayed && flight.scheduledTime !== displayTime && (
                    <span className="text-[8px] text-white/25 line-through font-mono">
                      {formatTime(flight.scheduledTime)}
                    </span>
                  )}
                </div>

                <div className="w-16 flex justify-end">
                  <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                    {statusStyle.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {source && flights.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-1">
            <Clock size={8} className="text-white/20" />
            <span className="text-[8px] text-white/20">Updated {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          <span className="text-[8px] text-white/15">{flights.length} flights</span>
        </div>
      )}
    </div>
  );
}
