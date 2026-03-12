'use client';
import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { type FAADelaysConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: FAADelaysConfig;
  style: WidgetStyle;
}

interface AirportStatus {
  airport: string;
  delay: boolean;
  delayType: string | null;
  avgDelay: string | null;
  reason: string | null;
}

export function FAADelaysWidget({ config }: Props) {
  const [airports, setAirports] = useState<AirportStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDelays = useCallback(async () => {
    if (config.watchedAirports.length === 0) return;
    try {
      const codes = config.watchedAirports.join(',');
      const res = await fetch(`/api/faa-delays?airports=${codes}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAirports(json.airports || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [config.watchedAirports]);

  useEffect(() => {
    fetchDelays();
    const interval = setInterval(fetchDelays, 2 * 60 * 1000); // 120s - matches Swift
    return () => clearInterval(interval);
  }, [fetchDelays]);

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-2">
        <AlertTriangle size={18} className="text-red-400/50" />
        <span className="text-xs text-red-400/60">{error}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4">
      {/* Header - matches Swift: "FAA DELAYS" tracking 4 */}
      <div
        className="text-[10px] font-bold text-white/30 uppercase mb-3"
        style={{ letterSpacing: '4px' }}
      >
        FAA Delays
      </div>

      {/* Airport grid - matches Swift: LazyVGrid 2 columns */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="grid grid-cols-2 gap-2">
          {airports.map((apt) => {
            const statusColor = apt.delay ? '#f97316' : '#22c55e';
            const statusText = apt.delay
              ? (apt.reason ? apt.reason.slice(0, 20) : 'Delay')
              : 'Normal';

            return (
              <div
                key={apt.airport}
                className="flex flex-col items-center gap-1.5 py-2 rounded-lg bg-white/[0.03]"
              >
                {/* Airport code - matches Swift: 16pt bold */}
                <span className="text-base font-bold text-white/90">
                  {apt.airport}
                </span>

                {/* Status dot - matches Swift: 8x8 circle with shadow */}
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: statusColor,
                    boxShadow: `0 0 8px ${statusColor}80`,
                  }}
                />

                {/* Status text - matches Swift: 8pt medium */}
                <span className="text-[8px] font-medium text-white/40 text-center px-1 truncate max-w-full">
                  {statusText}
                </span>

                {/* Average delay - matches Swift: 10pt orange */}
                {apt.delay && apt.avgDelay && (
                  <span className="text-[10px] text-orange-400/70">
                    {apt.avgDelay}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
