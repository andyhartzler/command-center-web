'use client';
import { TickingNumber } from '@/components/motion/TickingNumber';
import { Sparkline } from './Sparkline';

interface DeltaChipProps {
  changePercent: number;
}

function DeltaChip({ changePercent }: DeltaChipProps) {
  const up = changePercent >= 0;
  return (
    <span
      className="font-mono text-[12px] font-medium flex items-center justify-end gap-1 shrink-0"
      style={{ color: up ? 'var(--color-ok)' : 'var(--color-critical)', minWidth: 64 }}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden>
        {up ? <path d="M4 1 7.4 7H.6z" /> : <path d="M4 7 .6 1h6.8z" />}
      </svg>
      {Math.abs(changePercent).toFixed(2)}%
    </span>
  );
}

interface MarketRowProps {
  symbol: string;
  name?: string;
  /** null means the source had no quote; zero is never a real price */
  price: number | null;
  changePercent: number | null;
  /** price series for the sparkline, oldest first */
  spark?: number[];
  showName?: boolean;
  showSpark?: boolean;
  format: (v: number) => string;
}

/**
 * One market list row: symbol + name, optional sparkline, tweening price,
 * direction-colored delta chip. Red or green from across the room.
 */
export function MarketRow({
  symbol,
  name,
  price,
  changePercent,
  spark,
  showName = true,
  showSpark = true,
  format,
}: MarketRowProps) {
  const hasQuote = price !== null && price > 0;
  const up = (changePercent ?? 0) >= 0;

  return (
    <div className="flex items-center gap-3 py-1.5 min-w-0">
      <div className="flex items-baseline gap-2 min-w-0 flex-1">
        <span className="type-body font-medium shrink-0" style={{ color: 'var(--color-text-1)' }}>
          {symbol}
        </span>
        {showName && name && (
          <span className="text-[12px] truncate" style={{ color: 'var(--color-text-3)' }}>
            {name}
          </span>
        )}
      </div>

      {hasQuote && showSpark && spark && spark.length > 1 && (
        <Sparkline data={spark} up={up} className="shrink-0" />
      )}

      {hasQuote ? (
        <div className="flex items-center gap-2.5 shrink-0">
          <TickingNumber value={price} format={format} flash="auto" className="type-body" />
          {changePercent !== null && <DeltaChip changePercent={changePercent} />}
        </div>
      ) : (
        <span className="font-mono text-[12px] shrink-0" style={{ color: 'var(--color-text-3)' }}>
          --
        </span>
      )}
    </div>
  );
}
