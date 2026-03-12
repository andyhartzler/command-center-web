'use client';
import { useState, useEffect, useCallback } from 'react';
import { type AircraftTrackerConfig, type WidgetStyle } from '@/types/widget';
import { Plane, MapPin, Clock, Calendar } from 'lucide-react';

interface FlightLog {
  date: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  status: 'completed' | 'in_progress' | 'planned';
}

interface TrackerData {
  tailNumber: string;
  owner: string;
  aircraftType: string;
  lastSeen: string | null;
  isAirborne: boolean;
  currentFlight: {
    departure: string;
    arrival: string;
    altitude: number;
    speed: number;
    heading: number;
    lat: number;
    lon: number;
  } | null;
  recentFlights: FlightLog[];
  source: string;
}

interface AircraftTrackerWidgetProps {
  config: AircraftTrackerConfig;
  style: WidgetStyle;
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function AircraftTrackerWidget({ config }: AircraftTrackerWidgetProps) {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/aircraft?tail=${encodeURIComponent(config.tailNumber)}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setError(null);
      } else {
        setError('Failed to fetch aircraft data');
      }
    } catch (err) {
      console.error('[AircraftTracker] fetch error', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [config.tailNumber]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000); // check every minute
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="w-full h-full flex flex-col bg-[#1a1a1c] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center">
            <Plane size={12} className="text-violet-400" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-white/90 tracking-wide">
              {config.ownerLabel}
            </span>
            <span className="text-[9px] text-white/40 ml-1.5 font-mono">{config.tailNumber}</span>
          </div>
        </div>
        {data?.isAirborne && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-semibold text-emerald-400">AIRBORNE</span>
          </div>
        )}
      </div>

      {/* Current flight info when airborne */}
      {data?.isAirborne && data.currentFlight && (
        <div className="px-3 py-2 mx-2 mb-1 rounded-lg bg-white/[0.04] border border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/60">{data.currentFlight.departure}</span>
            <div className="flex-1 flex items-center mx-2">
              <div className="flex-1 h-px bg-white/10" />
              <Plane size={10} className="text-violet-400 mx-1 -rotate-45" />
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <span className="text-[10px] text-white/60">{data.currentFlight.arrival || '???'}</span>
          </div>
          <div className="flex items-center gap-3 text-[9px] text-white/30">
            <span>ALT {data.currentFlight.altitude.toLocaleString()}ft</span>
            <span>{data.currentFlight.speed}kts</span>
            <span>HDG {data.currentFlight.heading}°</span>
          </div>
        </div>
      )}

      {/* Flight log list */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Plane size={20} className="text-white/20 animate-pulse" />
              <span className="text-[10px] text-white/30">Tracking {config.tailNumber}...</span>
            </div>
          </div>
        ) : error || !data ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Plane size={20} className="text-white/20" />
              <span className="text-[10px] text-white/30">{error || 'No data available'}</span>
              <span className="text-[8px] text-white/20">Set FLIGHTAWARE_KEY or ADSBX_KEY</span>
            </div>
          </div>
        ) : data.recentFlights.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Calendar size={18} className="text-white/20" />
              <span className="text-[10px] text-white/30">No recent flights</span>
              <span className="text-[8px] text-white/20">Last seen: {data.lastSeen || 'Unknown'}</span>
            </div>
          </div>
        ) : (
          data.recentFlights.map((flight, i) => (
            <div
              key={`${flight.date}-${flight.departure}-${i}`}
              className={`px-3 py-2 hover:bg-white/[0.03] transition-colors ${
                i !== data.recentFlights.length - 1 ? 'border-b border-white/[0.04]' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-white/50">{flight.date}</span>
                  {flight.status === 'in_progress' && (
                    <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">LIVE</span>
                  )}
                </div>
                <span className="text-[9px] text-white/30">{flight.duration}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1">
                  <MapPin size={8} className="text-white/30" />
                  <span className="text-[11px] font-semibold text-white/80">{flight.departure}</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-px bg-white/15" />
                  <Plane size={8} className="text-violet-400/60 mx-0.5" />
                  <div className="w-4 h-px bg-white/15" />
                </div>
                <span className="text-[11px] font-semibold text-white/80">{flight.arrival}</span>
                <div className="flex-1" />
                <div className="flex items-center gap-1 text-[9px] text-white/30">
                  <Clock size={8} />
                  <span>{flight.departureTime} - {flight.arrivalTime}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {data && (
        <div className="flex items-center justify-between px-3 py-1 border-t border-white/5 shrink-0">
          <span className="text-[8px] text-white/20">{data.aircraftType || config.tailNumber}</span>
          <span className="text-[8px] text-white/15">via {data.source}</span>
        </div>
      )}
    </div>
  );
}
