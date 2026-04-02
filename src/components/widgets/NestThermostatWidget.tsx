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

  const isCompact = dims.w < 200;
  const isShort = dims.h < 300;

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
      <div className="w-full h-full flex items-center justify-center bg-black/20">
        <RefreshCw size={24} className="text-white/20 animate-spin" />
      </div>
    );
  }

  if (authUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-black/40 to-black/20">
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
      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-black/20 text-center">
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

  // Convert to Fahrenheit for US user
  const toF = (c: number) => (c * 9/5) + 32;

  const isActive = hvacState !== 'OFF';
  const modeIcon = mode === 'COOL' ? <Snowflake size={20} className={isActive ? "text-blue-400 animate-pulse" : "text-blue-400/60"} /> :
                   mode === 'HEAT' ? <Flame size={20} className={isActive ? "text-orange-400 animate-pulse" : "text-orange-400/60"} /> :
                   <Power size={20} className="text-white/40" />;

  const ringSize = isCompact ? 'w-24 h-24' : 'w-32 h-32';
  const tempSize = isCompact ? 'text-5xl' : 'text-6xl';
  const degreeSize = isCompact ? 'text-xl mt-1' : 'text-2xl mt-2';
  const padding = isCompact ? 'p-3' : 'p-5';
  const bottomGap = isCompact ? 'gap-2' : 'gap-4';
  const bottomPt = isCompact || isShort ? 'pt-2' : 'pt-4';
  const bottomMt = isCompact || isShort ? 'mt-1' : 'mt-2';

  return (
    <div ref={containerRef} className={`w-full h-full flex flex-col justify-between ${padding} overflow-hidden`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {modeIcon}
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white/90 uppercase tracking-tight">
              {traits["sdm.devices.traits.Info"]?.customName || 'Nest'}
            </span>
            <span className={`text-[10px] ${isActive ? 'text-emerald-400 font-bold' : 'text-white/30'}`}>
              {hvacState === 'COOLING' ? 'Cooling...' : hvacState === 'HEATING' ? 'Heating...' : 'Idle'}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">{mode}</span>
          <div className="flex gap-1">
            <div className={`w-1 h-1 rounded-full ${mode === 'COOL' ? 'bg-blue-400' : 'bg-white/10'}`} />
            <div className={`w-1 h-1 rounded-full ${mode === 'HEAT' ? 'bg-orange-400' : 'bg-white/10'}`} />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 relative">
        {/* Decorative Ring */}
        <div className={`absolute inset-0 m-auto ${ringSize} border-2 rounded-full opacity-10 ${isActive ? 'border-emerald-400 scale-110 duration-1000' : 'border-white'}`} />

        <div className="flex items-start">
          <span className={`${tempSize} font-light tracking-tighter text-white/90`}>
            {toF(ambientTemp).toFixed(0)}
          </span>
          <span className={`${degreeSize} font-light text-white/40`}>&deg;</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/40" />
          <span className="text-xs text-white/50 font-medium tracking-wide">Set to {toF(setpoint).toFixed(0)}&deg;</span>
        </div>
      </div>

      <div className={`grid grid-cols-2 ${bottomGap} ${bottomMt} ${bottomPt} border-t border-white/5`}>
        <div className="flex flex-col items-center border-r border-white/5">
          <span className="text-[10px] text-white/30 uppercase font-bold tracking-tighter mb-0.5">Humidity</span>
          <span className="text-sm font-medium text-white/80">{humidity}%</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-white/30 uppercase font-bold tracking-tighter mb-0.5">Mode</span>
          <span className="text-sm font-medium text-white/80 capitalize">{mode.toLowerCase()}</span>
        </div>
      </div>
    </div>
  );
}
