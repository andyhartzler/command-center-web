'use client';
import { House, Tv, Wind, Thermometer, Shield, Droplets, Lightbulb, Smartphone, Activity } from 'lucide-react';
import { WidgetShell, Freshness } from './WidgetShell';
import { usePolledData } from '@/hooks/usePolledData';
import { type WidgetStyle } from '@/types/widget';

interface HADevice {
  entity_id: string;
  state: string;
  attributes: { friendly_name?: string };
}

const POLL_INTERVAL = 10_000;

const ACTIVE_STATES = ['on', 'playing', 'healthy', 'locked', 'home'];
const IDLE_STATES = ['off', 'unavailable', 'unlocked', 'away'];

function deviceIcon(id: string) {
  const size = 16;
  if (id.includes('fan')) return <Wind size={size} />;
  if (id.includes('media_player')) return <Tv size={size} />;
  if (id.includes('vacuum')) return <Activity size={size} />;
  if (id.includes('sensor')) return <Droplets size={size} />;
  if (id.includes('light')) return <Lightbulb size={size} />;
  if (id.includes('lock')) return <Shield size={size} />;
  if (id.includes('thermometer') || id.includes('temp')) return <Thermometer size={size} />;
  return <Smartphone size={size} />;
}

function stateColor(state: string): string {
  const s = state.toLowerCase();
  if (ACTIVE_STATES.includes(s)) return 'var(--color-ok)';
  if (IDLE_STATES.includes(s)) return 'var(--color-text-3)';
  return 'var(--color-warn)';
}

interface Props {
  config: Record<string, never>;
  style: WidgetStyle;
}

export function HomeKitWidget({ style }: Props) {
  const { data, phase, isStale, lastUpdated } = usePolledData<HADevice[]>('/api/homekit', {
    interval: POLL_INTERVAL,
  });

  const devices = Array.isArray(data) ? data : [];
  const activeCount = devices.filter(d => ACTIVE_STATES.includes(d.state.toLowerCase())).length;

  return (
    <WidgetShell
      icon={<House size={18} />}
      title="Smart Home"
      status={
        <>
          {devices.length > 0 && (
            <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              {activeCount} active
            </span>
          )}
          <Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} />
        </>
      }
      style={style}
    >
      <div className="w-full h-full overflow-y-auto scrollbar-thin px-3.5 pb-2">
        {phase === 'loading' && !data && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-[74px] rounded-[10px] animate-pulse"
                style={{ background: 'var(--color-surface-2)', opacity: 0.5 }}
              />
            ))}
          </div>
        )}

        {phase === 'error' && !data && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <House size={20} style={{ color: 'var(--color-text-3)' }} />
            <span className="type-body" style={{ color: 'var(--color-text-3)' }}>
              Home Assistant unreachable
            </span>
          </div>
        )}

        {data && devices.length === 0 && (
          <div className="w-full h-full flex items-center justify-center">
            <span className="type-body" style={{ color: 'var(--color-text-3)' }}>
              No devices reported
            </span>
          </div>
        )}

        {devices.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {devices.map(device => {
              const isActive = ACTIVE_STATES.includes(device.state.toLowerCase());
              const color = stateColor(device.state);
              return (
                <div
                  key={device.entity_id}
                  className="flex flex-col justify-between gap-2 p-3 rounded-[10px] min-h-[74px]"
                  style={{
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--border-card)',
                    opacity: isActive ? 1 : 0.65,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <span style={{ color: isActive ? 'var(--color-accent-400)' : 'var(--color-text-3)' }}>
                      {deviceIcon(device.entity_id)}
                    </span>
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1"
                      style={{ background: color }}
                      aria-hidden
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-[13px] font-medium truncate"
                      style={{ color: 'var(--color-text-1)' }}
                    >
                      {device.attributes.friendly_name || device.entity_id}
                    </span>
                    <span
                      className="text-[12px] uppercase"
                      style={{ color, letterSpacing: 'var(--tracking-caps)' }}
                    >
                      {device.state}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
