'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function GlobalMapLegend() {
  const [minimized, setMinimized] = useState(true);

  const items = [
    { color: '#ec4899', label: 'Tracked / POTUS', shape: 'plane' },
    { color: '#eab308', label: 'Military Aircraft', shape: 'plane' },
    { color: '#06b6d4', label: 'Commercial Aircraft', shape: 'plane' },
    { color: '#FF8C00', label: 'Private / Jets', shape: 'plane' },
    { color: '#a78bfa', label: 'Satellites', shape: 'circle' },
    { color: '#3b82f6', label: 'Carrier Strike Group', shape: 'diamond' },
    { color: '#ef4444', label: 'GPS Jamming Zone', shape: 'rect' },
    { color: '#ef4444', label: 'Ukraine Frontlines', shape: 'line' },
    { color: '#f87171', label: 'Military Incident (GDELT)', shape: 'circle' },
    { color: '#22c55e', label: 'Earthquake (low mag)', shape: 'circle' },
    { color: '#ef4444', label: 'Earthquake (high mag)', shape: 'circle' },
    { color: '#ff8800', label: 'Fire Hotspot / Cluster', shape: 'circle' },
    { color: '#eab308', label: 'News Incident (medium)', shape: 'circle' },
    { color: '#ef4444', label: 'News Incident (high)', shape: 'circle' },
    { color: '#22c55e', label: 'CCTV Camera', shape: 'circle' },
    { color: '#f59e0b', label: 'KiwiSDR Receiver', shape: 'circle' },
    { color: '#2dd4bf', label: 'Maritime Vessel', shape: 'circle' },
    { color: '#ef4444', label: 'Tanker / Cargo Ship', shape: 'circle' },
    { color: '#fb923c', label: 'LiveUA Map Event', shape: 'circle' },
    { color: '#000020', label: 'Night Zone (solar)', shape: 'rect' },
  ];

  return (
    <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden pointer-events-auto">
      <div
        className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setMinimized(!minimized)}
      >
        <span className="text-[9px] text-white/40 font-mono tracking-widest">LEGEND</span>
        {minimized ? <ChevronDown size={10} className="text-white/30" /> : <ChevronUp size={10} className="text-white/30" />}
      </div>
      {!minimized && (
        <div className="flex flex-col gap-1 px-2.5 pb-2 max-h-[40vh] overflow-y-auto styled-scrollbar">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              {item.shape === 'circle' && (
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color, opacity: 0.7 }} />
              )}
              {item.shape === 'plane' && (
                <div className="w-2.5 h-2.5 shrink-0 text-center" style={{ fontSize: '8px', color: item.color }}>▲</div>
              )}
              {item.shape === 'diamond' && (
                <div className="w-2 h-2 rotate-45 shrink-0" style={{ backgroundColor: item.color, opacity: 0.8 }} />
              )}
              {item.shape === 'rect' && (
                <div className="w-2.5 h-2 shrink-0 rounded-[1px]" style={{ backgroundColor: item.color, opacity: 0.35 }} />
              )}
              {item.shape === 'line' && (
                <div className="w-2.5 h-0 shrink-0 border-t-[2px]" style={{ borderColor: item.color, opacity: 0.7 }} />
              )}
              <span className="text-[9px] text-white/40">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
