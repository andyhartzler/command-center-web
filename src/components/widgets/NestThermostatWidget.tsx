'use client';
import { useState, useEffect, useCallback } from 'react';
import { Thermometer, Flame, Snowflake, Power } from 'lucide-react';
import { type NestThermostatConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: NestThermostatConfig;
  style: WidgetStyle;
}

export function NestThermostatWidget({ config, style }: Props) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNest = useCallback(async () => {
    try {
      const res = await fetch(`/api/nest?projectId=${config.projectId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.devices?.[0]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, [config]);

  useEffect(() => {
    fetchNest();
    const interval = setInterval(fetchNest, 30000);
    return () => clearInterval(interval);
  }, [fetchNest]);

  if (error || !data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <Thermometer size={24} className="text-white/20 mb-2" />
        <span className="text-xs text-white/40 text-center">
          {error || 'Loading Nest...'}
        </span>
      </div>
    );
  }

  const traits = data.traits || {};
  const ambientTemp = traits["sdm.devices.traits.Temperature"]?.ambientTemperatureCelsius || 0;
  const humidity = traits["sdm.devices.traits.Humidity"]?.ambientHumidityPercent || 0;
  const mode = traits["sdm.devices.traits.ThermostatMode"]?.mode || "OFF";
  const setpoint = traits["sdm.devices.traits.ThermostatTemperatureSetpoint"]?.coolCelsius 
                || traits["sdm.devices.traits.ThermostatTemperatureSetpoint"]?.heatCelsius || ambientTemp;

  const modeIcon = mode === 'COOL' ? <Snowflake size={20} className="text-blue-400" /> :
                   mode === 'HEAT' ? <Flame size={20} className="text-orange-400" /> :
                   <Power size={20} className="text-white/40" />;

  return (
    <div className="w-full h-full flex flex-col justify-between p-5 overflow-hidden bg-gradient-to-br from-black/40 to-black/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {modeIcon}
          <span className="text-sm font-medium text-white/70">{traits["sdm.devices.traits.Info"]?.customName || 'Thermostat'}</span>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/10 text-white/70 tracking-widest">{mode}</span>
      </div>
      
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="flex items-start">
          <span className="text-6xl font-light tracking-tighter text-white/90">
            {ambientTemp.toFixed(1)}
          </span>
          <span className="text-2xl font-light text-white/50 mt-2">&deg;C</span>
        </div>
        <span className="text-sm text-white/50 mt-1">Target: {setpoint.toFixed(1)}&deg;C</span>
      </div>

      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Humidity</span>
          <span className="text-sm font-medium text-white/80">{humidity}%</span>
        </div>
      </div>
    </div>
  );
}
