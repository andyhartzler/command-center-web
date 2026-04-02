'use client';
import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, LightbulbOff } from 'lucide-react';
import { type HueConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: HueConfig;
  style: WidgetStyle;
}

export function HueWidget({ config, style }: Props) {
  const [lights, setLights] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchLights = useCallback(async () => {
    try {
      const res = await fetch(`/api/hue?bridgeIp=${config.bridgeIp}&applicationKey=${config.applicationKey}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLights(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, [config]);

  useEffect(() => {
    fetchLights();
    const interval = setInterval(fetchLights, 10000);
    return () => clearInterval(interval);
  }, [fetchLights]);

  if (error || Object.keys(lights).length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <Lightbulb size={24} className="text-white/20 mb-2" />
        <span className="text-xs text-white/40 text-center">
          {error || 'No lights found'}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden bg-black/20">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={14} className="text-amber-400" />
        <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Hue Lights</span>
      </div>
      
      <div className="flex flex-col gap-2 overflow-y-auto pr-1">
        {Object.entries(lights).map(([id, light]) => {
          const isOn = light.state.on;
          const briPercent = Math.round((light.state.bri / 254) * 100);
          
          return (
            <div key={id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isOn ? 'bg-amber-400/20 text-amber-400' : 'bg-white/5 text-white/30'}`}>
                  {isOn ? <Lightbulb size={16} /> : <LightbulbOff size={16} />}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white/90">{light.name}</span>
                  <span className="text-xs text-white/50">{isOn ? `${briPercent}% Brightness` : 'Off'}</span>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isOn ? 'bg-amber-400' : 'bg-white/10'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
