'use client';
import { useMemo } from 'react';
import type { EOCIncident } from '@/types/eoc';

interface EOCTickerProps {
  incidents: EOCIncident[];
  activeCount: number;
}

export function EOCTicker({ incidents, activeCount }: EOCTickerProps) {
  const recentCritical = useMemo(() => {
    return incidents
      .slice(0, 5)
      .filter(i => i.severity === 'critical' || i.severity === 'major');
  }, [incidents]);

  const hasCritical = recentCritical.length > 0;

  const tickerText = hasCritical
    ? recentCritical.map(i => `${i.emoji || '🔴'} ${i.title}`).join('  ///  ')
    : `EOC MONITORING ACTIVE \u2022 ${activeCount} ACTIVE INCIDENTS`;

  return (
    <div
      className={`shrink-0 h-9 flex items-center justify-center overflow-hidden border-t ${
        hasCritical
          ? 'bg-red-500/50 border-red-500/30'
          : 'bg-[#0d1421] border-cyan-500/15'
      }`}
    >
      <span
        className={`text-xs font-bold font-mono whitespace-nowrap ${
          hasCritical ? 'text-white/95' : 'text-cyan-400/80'
        }`}
      >
        {tickerText}
      </span>
    </div>
  );
}
