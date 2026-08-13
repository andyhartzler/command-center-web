'use client';
import { type ReactNode } from 'react';
import { useSharedClock, formatAge } from '@/hooks/useSharedClock';
import { type WidgetStyle } from '@/types/widget';
import { FitText } from '@/components/motion/FitText';

// The one widget chrome: header row (icon, title, status slot), body, footer.
// Freshness is ambient across the wall via the status slot contract.

interface FreshnessProps {
  /** epoch ms of last successful fetch */
  lastUpdated: number | null;
  /** poll interval in ms */
  interval: number;
  isStale?: boolean;
  /** show the breathing live dot when fresh */
  live?: boolean;
}

export function Freshness({ lastUpdated, interval, isStale = false, live = true }: FreshnessProps) {
  const now = useSharedClock();
  if (!lastUpdated) return null;
  const age = now - lastUpdated;

  if (isStale || age > interval * 5) {
    return (
      <span
        className="glass-chip px-2 py-0.5 font-mono text-[12px]"
        style={{ color: 'var(--color-critical)' }}
      >
        stale, retrying
      </span>
    );
  }
  if (age > interval * 2) {
    return (
      <span
        className="glass-chip px-2 py-0.5 font-mono text-[12px]"
        style={{ color: 'var(--color-warn)' }}
      >
        updated {formatAge(lastUpdated, now)}
      </span>
    );
  }
  if (live) return <span className="live-dot" aria-hidden />;
  return null;
}

interface WidgetShellProps {
  /** 18px lucide icon element, tinted accent-400 by the shell */
  icon: ReactNode;
  title: string;
  /** right-aligned status slot: Freshness, a phase chip, a count */
  status?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  style?: WidgetStyle;
  /** widgets in the ambient tier render chrome-free */
  chromeless?: boolean;
  className?: string;
}

export function WidgetShell({
  icon,
  title,
  status,
  footer,
  children,
  style,
  chromeless = false,
  className = '',
}: WidgetShellProps) {
  const showHeader = !chromeless && (style?.showTitle ?? true);

  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-1.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="shrink-0 flex items-center"
              style={{ color: 'var(--color-accent-400)' }}
              aria-hidden
            >
              {icon}
            </span>
            <FitText className="type-label">{title}</FitText>
          </div>
          {status && <div className="flex items-center gap-1.5 shrink-0">{status}</div>}
        </div>
      )}
      <div className="flex-1 min-h-0 relative">{children}</div>
      {footer && <div className="shrink-0 px-3.5 pb-2.5 pt-1">{footer}</div>}
    </div>
  );
}
