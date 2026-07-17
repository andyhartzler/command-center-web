'use client';

import { TrendingUp } from 'lucide-react';
import { WidgetShell, Freshness } from './WidgetShell';
import { usePolledData } from '@/hooks/usePolledData';
import { TickingNumber } from '@/components/motion/TickingNumber';
import type { PredictionMarketsConfig, WidgetStyle } from '@/types/widget';

interface PredictionOutcome {
  name: string;
  probability: number;
}

interface PredictionData {
  id: string;
  title: string;
  outcomes: PredictionOutcome[];
  volume24hr: number;
}

interface PredictionMarketsWidgetProps {
  config: PredictionMarketsConfig;
  style: WidgetStyle;
}

const POLL_INTERVAL = 120_000;

const formatPercent = (v: number) => `${Math.round(v)}%`;

export function PredictionMarketsWidget({ config, style }: PredictionMarketsWidgetProps) {
  const limit = config.maxEvents || 8;
  const { data, phase, isStale, lastUpdated } = usePolledData<PredictionData[]>(
    `/api/predictions?limit=${limit}`,
    { interval: POLL_INTERVAL },
  );

  const markets = Array.isArray(data) ? data : [];

  return (
    <WidgetShell
      icon={<TrendingUp size={18} />}
      title="Predictions"
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
      style={style}
    >
      <div className="w-full h-full overflow-y-auto scrollbar-thin px-3.5 pb-2">
        {phase === 'loading' && markets.length === 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-[10px] animate-pulse"
                style={{ background: 'var(--color-surface-2)', opacity: 0.5 }}
              />
            ))}
          </div>
        )}

        {phase !== 'loading' && markets.length === 0 && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <TrendingUp size={20} style={{ color: 'var(--color-text-3)' }} />
            <span className="type-body" style={{ color: 'var(--color-text-3)' }}>
              Markets unavailable
            </span>
          </div>
        )}

        {markets.length > 0 && (
          <div className="flex flex-col pt-1">
            {markets.map((market, marketIdx) => (
              <div key={market.id}>
                <div className="py-1.5">
                  <div
                    className="text-[13px] font-medium leading-tight mb-1.5 line-clamp-2"
                    style={{ color: 'var(--color-text-1)' }}
                  >
                    {market.title}
                  </div>

                  <div className="space-y-1">
                    {market.outcomes.slice(0, 3).map(outcome => (
                      <div key={outcome.name} className="flex items-center gap-2">
                        <span
                          className="text-[12px] font-medium w-12 text-right truncate shrink-0"
                          style={{ color: 'var(--color-text-2)' }}
                        >
                          {outcome.name}
                        </span>

                        {/* Thin probability bar */}
                        <div
                          className="flex-1 h-1.5 rounded-sm overflow-hidden"
                          style={{ background: 'var(--color-surface-2)' }}
                        >
                          <div
                            className="h-full rounded-sm"
                            style={{
                              width: `${Math.min(Math.max(outcome.probability, 2), 100)}%`,
                              background:
                                'linear-gradient(90deg, var(--color-accent-400), var(--color-accent-600))',
                              transition: 'width var(--motion-data) var(--ease-out)',
                            }}
                          />
                        </div>

                        <span
                          className="w-[42px] text-right shrink-0"
                          style={{ color: 'var(--color-text-2)' }}
                        >
                          <TickingNumber
                            value={outcome.probability}
                            format={formatPercent}
                            flash="auto"
                            className="text-[12px] font-semibold"
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {marketIdx < markets.length - 1 && (
                  <div style={{ height: '1px', background: 'var(--border-card)' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
