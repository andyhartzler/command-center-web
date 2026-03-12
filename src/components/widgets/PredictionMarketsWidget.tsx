'use client';

import { useState, useEffect, useCallback } from 'react';
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

export function PredictionMarketsWidget({ config }: PredictionMarketsWidgetProps) {
  const [predictions, setPredictions] = useState<PredictionData[]>([]);

  const fetchPredictions = useCallback(async () => {
    try {
      const limit = config.maxEvents || 8;
      const res = await fetch(`/api/predictions?limit=${limit}`);
      if (!res.ok) return;
      const data: PredictionData[] = await res.json();
      if (Array.isArray(data)) {
        setPredictions(data);
      }
    } catch (err) {
      console.error('[PredictionMarketsWidget] fetch error', err);
    }
  }, [config.maxEvents]);

  useEffect(() => {
    fetchPredictions();
    const interval = setInterval(fetchPredictions, 120_000); // 120s - matches Swift
    return () => clearInterval(interval);
  }, [fetchPredictions]);

  if (predictions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden">
      {/* Header - matches Swift: "PREDICTIONS" tracking 4 */}
      <div
        className="text-[10px] font-bold text-white/30 uppercase mb-3"
        style={{ letterSpacing: '4px' }}
      >
        Predictions
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="flex flex-col gap-2.5">
          {predictions.map((pred, predIdx) => (
            <div key={pred.id}>
              <div className="py-1.5">
                {/* Market title - matches Swift: 11pt medium */}
                <div className="text-[11px] font-medium text-white/80 leading-tight mb-1.5 line-clamp-2">
                  {pred.title}
                </div>

                {/* Outcome probability bars — blue gradient */}
                <div className="space-y-1">
                  {pred.outcomes.slice(0, 3).map((outcome, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {/* Label */}
                      <span className="text-[9px] font-medium text-white/50 w-10 text-right truncate shrink-0">
                        {outcome.name}
                      </span>

                      {/* Bar — blue gradient */}
                      <div className="flex-1 h-1.5 rounded-sm bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${Math.max(outcome.probability, 2)}%`,
                            background: 'linear-gradient(90deg, rgba(59,130,246,0.6), rgba(59,130,246,0.25))',
                          }}
                        />
                      </div>

                      {/* Percentage - matches Swift: 10pt bold */}
                      <span className="text-[10px] font-bold text-white/60 tabular-nums w-[30px] text-right shrink-0">
                        {outcome.probability}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider - matches Swift: white 4% opacity, 0.5px */}
              {predIdx < predictions.length - 1 && (
                <div className="bg-white/[0.04]" style={{ height: '0.5px' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
