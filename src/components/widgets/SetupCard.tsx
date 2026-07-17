'use client';
import { type ReactNode } from 'react';

// Shared onboarding card for widgets that need account or key setup
// (Nest, Withings, Hue, iCloud Album, Aircraft). Configuration hints live
// here and in the editor config panel only, never on the wall display.

interface SetupItem {
  label: string;
  done?: boolean;
  error?: string | null;
  action?: ReactNode;
}

interface SetupCardProps {
  icon: ReactNode;
  title: string;
  description?: string;
  items?: SetupItem[];
  /** when true (display mode), renders the quiet wall variant instead */
  wallMode?: boolean;
  /** quiet copy for the wall, e.g. "Not connected" */
  wallLabel?: string;
}

export function SetupCard({
  icon,
  title,
  description,
  items = [],
  wallMode = false,
  wallLabel = 'Not connected',
}: SetupCardProps) {
  if (wallMode) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <span style={{ color: 'var(--color-text-3)', opacity: 0.6 }}>{icon}</span>
        <span className="type-label">{wallLabel}</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
      <span style={{ color: 'var(--color-accent-400)' }}>{icon}</span>
      <div className="text-center">
        <div className="type-body font-medium" style={{ color: 'var(--color-text-1)' }}>{title}</div>
        {description && (
          <div className="text-[13px] mt-1" style={{ color: 'var(--color-text-3)' }}>{description}</div>
        )}
      </div>
      {items.length > 0 && (
        <div className="w-full max-w-sm flex flex-col gap-1.5">
          {items.map(item => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px]"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--border-card)' }}
            >
              <div className="min-w-0">
                <span className="text-[13px]" style={{ color: 'var(--color-text-2)' }}>{item.label}</span>
                {item.error && (
                  <div className="text-[12px] truncate" style={{ color: 'var(--color-critical)' }}>{item.error}</div>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {item.done && <span style={{ color: 'var(--color-ok)' }}>done</span>}
                {item.action}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
