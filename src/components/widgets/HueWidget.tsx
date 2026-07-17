'use client';
import { useEffect, useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { WidgetShell, Freshness } from './WidgetShell';
import { SetupCard } from './SetupCard';
import { usePolledData } from '@/hooks/usePolledData';
import { useAppState } from '@/context/AppState';
import { type HueConfig, type WidgetStyle } from '@/types/widget';

interface HueLightState {
  on: boolean;
  bri?: number;
  hue?: number;
  sat?: number;
  xy?: [number, number];
  reachable?: boolean;
}

interface HueLight {
  name: string;
  state: HueLightState;
}

const POLL_INTERVAL = 10_000;

/** Convert Hue bridge light state to a CSS color for the swatch, NaN-guarded. */
function lightColor(state: HueLightState): string {
  const bri = Number.isFinite(state.bri) ? (state.bri as number) : 254;
  const lightness = 42 + (Math.min(Math.max(bri, 1), 254) / 254) * 26;

  if (Number.isFinite(state.hue) && Number.isFinite(state.sat)) {
    const h = ((state.hue as number) / 65535) * 360;
    const s = ((state.sat as number) / 254) * 100;
    if (Number.isFinite(h) && Number.isFinite(s)) {
      return `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${lightness.toFixed(0)}%)`;
    }
  }

  if (Array.isArray(state.xy) && state.xy.length === 2) {
    const [x, y] = state.xy;
    if (Number.isFinite(x) && Number.isFinite(y) && y > 0) {
      const Y = Math.min(Math.max(bri, 1), 254) / 254;
      const X = (Y / y) * x;
      const Z = (Y / y) * (1 - x - y);
      let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
      let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
      let b = X * 0.051713 - Y * 0.121364 + Z * 1.01153;
      const gamma = (c: number) =>
        c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
      r = gamma(Math.max(0, r));
      g = gamma(Math.max(0, g));
      b = gamma(Math.max(0, b));
      const max = Math.max(r, g, b, 1);
      const to255 = (c: number) => Math.round((c / max) * 255);
      const rgb = [to255(r), to255(g), to255(b)];
      if (rgb.every(Number.isFinite)) return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
  }

  // Untinted bulbs read as warm white
  return `hsl(38, 45%, ${lightness.toFixed(0)}%)`;
}

interface Props {
  config: HueConfig;
  style: WidgetStyle;
}

export function HueWidget({ config, style }: Props) {
  const { isDisplayMode } = useAppState();
  const configured = Boolean(config.bridgeIp && config.applicationKey);

  const init = useMemo<RequestInit>(
    () => ({ headers: { 'x-hue-application-key': config.applicationKey } }),
    [config.applicationKey],
  );

  const { data, phase, isStale, lastUpdated, refresh } = usePolledData<Record<string, HueLight>>(
    configured ? `/api/hue?bridgeIp=${encodeURIComponent(config.bridgeIp)}` : null,
    { interval: POLL_INTERVAL, init },
  );

  // Optimistic toggle state, reconciled against every fresh server payload
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (lastUpdated) setOverrides({});
  }, [lastUpdated]);

  const toggle = async (id: string, next: boolean) => {
    setOverrides(prev => ({ ...prev, [id]: next }));
    try {
      const res = await fetch('/api/hue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bridgeIp: config.bridgeIp,
          applicationKey: config.applicationKey,
          lightId: id,
          state: { on: next },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refresh();
    } catch {
      setOverrides(prev => {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      });
    }
  };

  if (!configured) {
    return (
      <SetupCard
        icon={<Lightbulb size={22} />}
        title="Hue bridge setup"
        description="Add the bridge IP and application key in the widget settings."
        items={[
          { label: 'Bridge IP', done: Boolean(config.bridgeIp) },
          { label: 'Application key', done: Boolean(config.applicationKey) },
        ]}
        wallMode={isDisplayMode}
        wallLabel="Hue not connected"
      />
    );
  }

  const lights = data ? Object.entries(data) : [];

  return (
    <WidgetShell
      icon={<Lightbulb size={18} />}
      title="Hue Lights"
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />}
      style={style}
    >
      <div className="w-full h-full overflow-y-auto scrollbar-thin px-3.5 pb-2">
        {phase === 'loading' && !data && (
          <div className="flex flex-col gap-2 pt-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-[10px] animate-pulse"
                style={{ background: 'var(--color-surface-2)', opacity: 0.5 }}
              />
            ))}
          </div>
        )}

        {phase === 'error' && !data && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Lightbulb size={20} style={{ color: 'var(--color-text-3)' }} />
            <span className="type-body" style={{ color: 'var(--color-text-3)' }}>
              Bridge unreachable
            </span>
          </div>
        )}

        {data && lights.length === 0 && (
          <div className="w-full h-full flex items-center justify-center">
            <span className="type-body" style={{ color: 'var(--color-text-3)' }}>
              No lights on this bridge
            </span>
          </div>
        )}

        {lights.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {lights.map(([id, light]) => {
              const isOn = overrides[id] ?? light.state.on;
              const bri = Number.isFinite(light.state.bri) ? (light.state.bri as number) : 254;
              const briPercent = Math.round((Math.min(Math.max(bri, 1), 254) / 254) * 100);
              const swatch = lightColor(light.state);

              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[10px]"
                  style={{
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--border-card)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{
                        background: isOn ? swatch : 'var(--color-surface-3)',
                        boxShadow: isOn
                          ? `0 0 8px ${swatch}, inset 0 0 0 1px var(--border-card)`
                          : 'inset 0 0 0 1px var(--border-card)',
                        transition: 'background var(--motion-standard) var(--ease-out)',
                      }}
                      aria-hidden
                    />
                    <div className="flex flex-col min-w-0">
                      <span
                        className="type-body font-medium truncate"
                        style={{ color: 'var(--color-text-1)' }}
                      >
                        {light.name}
                      </span>
                      <span className="text-[12px] font-mono" style={{ color: 'var(--color-text-3)' }}>
                        {isOn ? `${briPercent}%` : 'off'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggle(id, !isOn)}
                    className="w-11 h-6 rounded-full p-1 shrink-0 cursor-pointer"
                    style={{
                      background: isOn ? 'var(--color-accent-500)' : 'var(--color-surface-3)',
                      transition: 'background var(--motion-standard) var(--ease-out)',
                    }}
                    aria-label={isOn ? `Turn off ${light.name}` : `Turn on ${light.name}`}
                  >
                    <span
                      className="block w-4 h-4 rounded-full"
                      style={{
                        background: 'var(--color-text-1)',
                        transform: isOn ? 'translateX(20px)' : 'translateX(0)',
                        transition: 'transform var(--motion-standard) var(--ease-spring)',
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
