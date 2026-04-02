'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Thermometer, Flame, Snowflake, Power, ExternalLink, RefreshCw } from 'lucide-react';
import { type NestThermostatConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: NestThermostatConfig;
  style: WidgetStyle;
}

export function NestThermostatWidget({ config, style }: Props) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 300, h: 300 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fetchNest = useCallback(async () => {
    try {
      const res = await fetch(`/api/nest`);
      const json = await res.json();

      if (res.status === 401) {
        setAuthUrl(json.authUrl);
        setData(null);
        setError(null);
      } else if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch');
      } else {
        setData(json.devices?.[0]);
        setError(null);
        setAuthUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNest();
    const interval = setInterval(fetchNest, 60000);
    return () => clearInterval(interval);
  }, [fetchNest]);

  if (isLoading && !data) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <RefreshCw size={24} className="text-white/20 animate-spin" />
      </div>
    );
  }

  if (authUrl) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center p-6">
        <div className="p-3 rounded-full bg-white/5 mb-4">
          <Thermometer size={32} className="text-white/40" />
        </div>
        <h3 className="text-sm font-medium text-white/90 mb-1 text-center">Nest Disconnected</h3>
        <p className="text-[10px] text-white/40 text-center mb-4 max-w-[140px]">Connect your Google account to see your thermostat.</p>
        <a
          href={authUrl}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-xs font-semibold hover:bg-white/90 transition-colors"
        >
          Connect Nest <ExternalLink size={12} />
        </a>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
        <Thermometer size={24} className="text-red-400/40 mb-2" />
        <span className="text-[10px] text-white/40 max-w-[120px]">
          {error || 'No device found'}
        </span>
        <div className="flex gap-4 mt-3">
          <button
            onClick={() => { setIsLoading(true); fetchNest(); }}
            className="text-[10px] text-emerald-400/60 hover:text-emerald-400 underline"
          >
            Retry
          </button>
          <a
            href="/api/nest/logout"
            className="text-[10px] text-red-400/60 hover:text-red-400 underline"
          >
            Reset session
          </a>
        </div>
      </div>
    );
  }

  const traits = data.traits || {};
  const ambientTemp = traits["sdm.devices.traits.Temperature"]?.ambientTemperatureCelsius || 0;
  const humidity = traits["sdm.devices.traits.Humidity"]?.ambientHumidityPercent || 0;
  const mode = traits["sdm.devices.traits.ThermostatMode"]?.mode || "OFF";
  const hvacState = traits["sdm.devices.traits.ThermostatHvac"]?.status || "OFF";
  const setpoint = traits["sdm.devices.traits.ThermostatTemperatureSetpoint"]?.coolCelsius
                || traits["sdm.devices.traits.ThermostatTemperatureSetpoint"]?.heatCelsius || ambientTemp;

  const toF = (c: number) => (c * 9/5) + 32;
  const isActive = hvacState !== 'OFF';

  // Scale everything based on container dimensions
  const s = Math.min(dims.w / 200, dims.h / 320);
  const iconSize = Math.max(12, 18 * s);
  const ringPx = Math.max(60, 120 * s);
  const tempFontPx = Math.max(28, 56 * s);
  const degreeFontPx = Math.max(12, 22 * s);
  const labelFontPx = Math.max(7, 10 * s);
  const valueFontPx = Math.max(10, 14 * s);
  const setFontPx = Math.max(8, 12 * s);
  const headerFontPx = Math.max(8, 11 * s);
  const statusFontPx = Math.max(7, 10 * s);
  const modeFontPx = Math.max(7, 9 * s);
  const pad = Math.max(8, 16 * s);
  const dotSize = Math.max(3, 5 * s);

  const modeIcon = mode === 'COOL'
    ? <Snowflake size={iconSize} className={isActive ? "text-blue-400 animate-pulse" : "text-blue-400/60"} />
    : mode === 'HEAT'
    ? <Flame size={iconSize} className={isActive ? "text-orange-400 animate-pulse" : "text-orange-400/60"} />
    : <Power size={iconSize} className="text-white/40" />;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col justify-between overflow-hidden" style={{ padding: pad }}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center" style={{ gap: 4 * s }}>
          {modeIcon}
          <div className="flex flex-col">
            <span className="font-semibold text-white/90 uppercase tracking-tight" style={{ fontSize: headerFontPx, lineHeight: 1.2 }}>
              {traits["sdm.devices.traits.Info"]?.customName || 'Nest'}
            </span>
            <span className={`${isActive ? 'text-emerald-400 font-bold' : 'text-white/30'}`} style={{ fontSize: statusFontPx, lineHeight: 1.2 }}>
              {hvacState === 'COOLING' ? 'Cooling...' : hvacState === 'HEATING' ? 'Heating...' : 'Idle'}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-bold text-white/40 uppercase tracking-widest leading-none" style={{ fontSize: modeFontPx, marginBottom: 2 * s }}>{mode}</span>
          <div className="flex" style={{ gap: 2 * s }}>
            <div className="rounded-full" style={{ width: dotSize, height: dotSize, background: mode === 'COOL' ? '#60a5fa' : 'rgba(255,255,255,0.1)' }} />
            <div className="rounded-full" style={{ width: dotSize, height: dotSize, background: mode === 'HEAT' ? '#fb923c' : 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>
      </div>

      {/* Center: temp display */}
      <div className="flex flex-col items-center justify-center flex-1 relative">
        <div
          className={`absolute rounded-full border-2 opacity-10 ${isActive ? 'border-emerald-400 scale-110 duration-1000' : 'border-white'}`}
          style={{ width: ringPx, height: ringPx, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        />
        <div className="flex items-start relative">
          <span className="font-light tracking-tighter text-white/90" style={{ fontSize: tempFontPx, lineHeight: 1 }}>
            {toF(ambientTemp).toFixed(0)}
          </span>
          <span className="font-light text-white/40" style={{ fontSize: degreeFontPx, marginTop: 2 * s }}>&deg;</span>
        </div>
        <div className="flex items-center" style={{ gap: 4 * s, marginTop: 3 * s }}>
          <div className="rounded-full bg-emerald-400/40" style={{ width: dotSize, height: dotSize }} />
          <span className="text-white/50 font-medium tracking-wide" style={{ fontSize: setFontPx, lineHeight: 1 }}>Set to {toF(setpoint).toFixed(0)}&deg;</span>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 border-t border-white/5 shrink-0" style={{ gap: 4 * s, paddingTop: 6 * s, marginTop: 4 * s }}>
        <div className="flex flex-col items-center border-r border-white/5">
          <span className="text-white/30 uppercase font-bold tracking-tighter" style={{ fontSize: labelFontPx, lineHeight: 1, marginBottom: 2 }}>Humidity</span>
          <span className="font-medium text-white/80" style={{ fontSize: valueFontPx, lineHeight: 1 }}>{humidity}%</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-white/30 uppercase font-bold tracking-tighter" style={{ fontSize: labelFontPx, lineHeight: 1, marginBottom: 2 }}>Mode</span>
          <span className="font-medium text-white/80 capitalize" style={{ fontSize: valueFontPx, lineHeight: 1 }}>{mode.toLowerCase()}</span>
        </div>
      </div>
    </div>
  );
}
