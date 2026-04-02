'use client';
import { useState, useEffect, useCallback } from 'react';
import { Power, Fan, Tv, Wind, Zap, Box, Thermometer, Shield, Droplets, Lightbulb, Smartphone, Activity } from 'lucide-react';
import { type WidgetStyle } from '@/types/widget';

interface Props {
  config: Record<string, never>;
  style: WidgetStyle;
}

export function HomeKitWidget({ config, style }: Props) {
  const [devices, setDevices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/homekit');
      if (!res.ok) throw new Error('Connection lost');
      const data = await res.json();
      setDevices(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-black/40">
        <Activity size={24} className="text-red-400/40 mb-2 animate-pulse" />
        <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{error}</span>
      </div>
    );
  }

  const getIcon = (id: string, state: string) => {
    const className = "shrink-0";
    const size = 16;
    if (id.includes('fan')) return <Wind size={size} className={className} />;
    if (id.includes('media_player')) return <Tv size={size} className={className} />;
    if (id.includes('vacuum')) return <Activity size={size} className={className} />;
    if (id.includes('sensor')) return <Droplets size={size} className={className} />;
    if (id.includes('light')) return <Lightbulb size={size} className={className} />;
    if (id.includes('lock')) return <Shield size={size} className={className} />;
    if (id.includes('thermometer') || id.includes('temp')) return <Thermometer size={size} className={className} />;
    return <Smartphone size={size} className={className} />;
  };

  const getStatusColor = (state: string) => {
    const s = state.toLowerCase();
    if (['on', 'playing', 'healthy', 'locked', 'home'].includes(s)) return 'text-emerald-400';
    if (['off', 'unavailable', 'unlocked', 'away'].includes(s)) return 'text-white/20';
    return 'text-amber-400';
  };

  const activeCount = devices.filter(d => ['on', 'playing', 'healthy', 'locked'].includes(d.state.toLowerCase())).length;

  return (
    <div className="w-full h-full flex flex-col p-5 overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Zap size={16} className="text-emerald-400 fill-emerald-400/20" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-white/90 uppercase tracking-[0.2em] leading-none">Smart Home</span>
            <span className="text-[10px] text-emerald-400/60 font-medium mt-1">{activeCount} Systems Active</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        </div>
      </div>
      
      {/* Device Grid */}
      <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 custom-scrollbar">
        {devices.map((device) => {
          const isOn = ['on', 'playing', 'healthy', 'locked'].includes(device.state.toLowerCase());
          return (
            <div 
              key={device.entity_id} 
              className={`group relative p-3.5 rounded-2xl border transition-all duration-300 overflow-hidden ${
                isOn 
                ? 'bg-white/10 border-white/20 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.5)]' 
                : 'bg-black/20 border-white/5 opacity-60 grayscale-[0.5]'
              }`}
            >
              {/* Active Background Glow */}
              {isOn && (
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 blur-[30px] rounded-full group-hover:bg-emerald-500/20 transition-colors" />
              )}

              <div className="relative z-10 flex flex-col h-full justify-between gap-3">
                <div className="flex justify-between items-start">
                  <div className={`p-2 rounded-lg transition-colors ${
                    isOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'
                  }`}>
                    {getIcon(device.entity_id, device.state)}
                  </div>
                  <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${isOn ? 'bg-emerald-400' : 'bg-white/10'}`} />
                </div>
                
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-white/90 truncate tracking-tight group-hover:text-white transition-colors">
                    {device.attributes.friendly_name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${getStatusColor(device.state)}`}>
                      {device.state}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}} />
    </div>
  );
}
