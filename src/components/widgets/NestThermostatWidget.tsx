'use client';
import { Thermometer, ExternalLink } from 'lucide-react';
import { type NestThermostatConfig, type WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { WidgetShell, Freshness } from './WidgetShell';
import { ArcGauge } from './gauges/ArcGauge';

interface NestTraits {
  'sdm.devices.traits.Temperature'?: { ambientTemperatureCelsius?: number };
  'sdm.devices.traits.Humidity'?: { ambientHumidityPercent?: number };
  'sdm.devices.traits.ThermostatMode'?: { mode?: string };
  'sdm.devices.traits.ThermostatHvac'?: { status?: string };
  'sdm.devices.traits.ThermostatTemperatureSetpoint'?: { coolCelsius?: number; heatCelsius?: number };
  'sdm.devices.traits.Info'?: { customName?: string };
}

interface NestDevice {
  name?: string;
  traits?: NestTraits;
}

interface NestResponse {
  devices?: NestDevice[];
}

interface Props {
  config: NestThermostatConfig;
  style: WidgetStyle;
}

const POLL_MS = 60_000;
const GAUGE_MIN_F = 50;
const GAUGE_MAX_F = 90;

const toF = (c: number) => (c * 9) / 5 + 32;

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex flex-col items-center gap-0.5">
      <span
        className="text-[12px] uppercase leading-none"
        style={{ color: 'var(--color-text-3)', letterSpacing: 'var(--tracking-caps)' }}
      >
        {label}
      </span>
      <span className="font-mono text-[13px] leading-none truncate" style={{ color: 'var(--color-text-2)' }}>
        {value}
      </span>
    </div>
  );
}

export function NestThermostatWidget({ config: _config, style }: Props) {
  const { data, error, phase, isStale, lastUpdated } = usePolledData<NestResponse>(
    '/api/nest',
    { interval: POLL_MS },
  );

  const device = data?.devices?.[0] ?? null;
  const traits = device?.traits;
  const needsAuth = !device && error === 'HTTP 401';

  let body: React.ReactNode;
  let footer: React.ReactNode = null;
  let title = 'Thermostat';

  if (needsAuth) {
    body = (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
        <span className="text-[13px]" style={{ color: 'var(--color-text-2)' }}>
          Nest is disconnected
        </span>
        <a
          href="/api/nest/auth"
          className="glass-chip flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
          style={{ color: 'var(--color-accent-300)' }}
        >
          Connect Nest <ExternalLink size={12} />
        </a>
      </div>
    );
  } else if (!device) {
    body = (
      <div className="w-full h-full flex items-center justify-center p-4 text-center">
        {phase === 'loading' ? (
          <span className="live-dot" aria-label="Loading thermostat" />
        ) : (
          <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            Thermostat unavailable, retrying
          </span>
        )}
      </div>
    );
  } else {
    title = traits?.['sdm.devices.traits.Info']?.customName || 'Thermostat';

    const ambientC = traits?.['sdm.devices.traits.Temperature']?.ambientTemperatureCelsius ?? null;
    const humidity = traits?.['sdm.devices.traits.Humidity']?.ambientHumidityPercent ?? null;
    const mode = traits?.['sdm.devices.traits.ThermostatMode']?.mode ?? 'OFF';
    const hvac = traits?.['sdm.devices.traits.ThermostatHvac']?.status ?? 'OFF';
    const setpoint = traits?.['sdm.devices.traits.ThermostatTemperatureSetpoint'];
    const heatC = setpoint?.heatCelsius ?? null;
    const coolC = setpoint?.coolCelsius ?? null;

    // Ring color follows what the HVAC is doing right now
    const modeColor =
      hvac === 'HEATING'
        ? 'var(--color-warn)'
        : hvac === 'COOLING'
          ? 'var(--color-info)'
          : 'var(--color-text-3)';
    const hvacLabel = hvac === 'HEATING' ? 'Heating' : hvac === 'COOLING' ? 'Cooling' : 'Idle';

    const target =
      mode === 'HEATCOOL' && heatC !== null && coolC !== null
        ? `${toF(heatC).toFixed(0)}-${toF(coolC).toFixed(0)}°`
        : coolC !== null
          ? `${toF(coolC).toFixed(0)}°`
          : heatC !== null
            ? `${toF(heatC).toFixed(0)}°`
            : '--';

    body =
      ambientC !== null ? (
        <div className="w-full h-full px-3 pb-1 overflow-hidden">
          <ArcGauge
            value={toF(ambientC)}
            min={GAUGE_MIN_F}
            max={GAUGE_MAX_F}
            color={modeColor}
            label={hvacLabel}
            format={v => `${Math.round(v)}°`}
          />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            No temperature reading
          </span>
        </div>
      );

    footer = (
      <div className="grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-2">
        <FooterStat label="Humidity" value={humidity !== null ? `${humidity}%` : '--'} />
        <FooterStat label="Target" value={target} />
        <FooterStat label="Mode" value={mode === 'HEATCOOL' ? 'Heat/Cool' : mode.charAt(0) + mode.slice(1).toLowerCase()} />
      </div>
    );
  }

  return (
    <WidgetShell
      icon={<Thermometer size={18} />}
      title={title}
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={POLL_MS} isStale={isStale} />}
      footer={footer}
    >
      {body}
    </WidgetShell>
  );
}
