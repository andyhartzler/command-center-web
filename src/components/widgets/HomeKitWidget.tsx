'use client';
import { useState, useEffect, useCallback } from 'react';
import { Power, Fan, Tv, Wind, Zap, Box } from 'lucide-react';
import { type WidgetStyle } from '@/types/widget';

interface Props {
  config: Record<string, never>;
  style: WidgetStyle;
}

export function HomeKitWidget({ config, style }: Props) {
  const [devices, setDevices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/homekit');
      if (!res.ok) throw new Error('Failed to fetch devices');
      const data = await res.json();
      setDevices(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <span className="text-xs text-red-400/60">Unavailable</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden bg-black/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-green-400" />
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Home</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1">
        {devices.map((device) => {
          const isOn = device.state === 'on' || device.state === 'playing' || device.state === 'healthy';
          return (
            <div 
              key={device.entity_id} 
              className={`p-3 rounded-xl flex flex-col gap-2 border transition-colors ${isOn ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5'}`}
            >
              <div className="flex justify-between items-start">
                <div className={`p-1.5 rounded-full ${isOn ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
                  {device.entity_id.includes('fan') ? <Wind size={14} /> :
                   device.entity_id.includes('media') ? <Tv size={14} /> :
                   device.entity_id.includes('vacuum') ? <Fan size={14} /> : <Box size={14} />}
                </div>
                <Power size={14} className={isOn ? 'text-green-400' : 'text-white/20'} />
              </div>
              <div className="flex flex-col mt-1">
                <span className="text-sm font-medium text-white/90 truncate">{device.attributes.friendly_name}</span>
                <span className="text-xs text-white/50 capitalize">{device.state}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
