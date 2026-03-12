'use client';

import React, { useState } from 'react';
import {
  Plane, AlertTriangle, Activity, Flame, Newspaper,
  Sun, ChevronDown, ChevronUp, Globe, Shield, Wifi,
  Satellite, Anchor, Camera, Radio, MapPin, Zap, Star, AlertOctagon
} from 'lucide-react';

export type LayerKey =
  | 'flights' | 'military' | 'private' | 'tracked'
  | 'earthquakes' | 'fires' | 'news_markers'
  | 'day_night' | 'gps_jamming'
  | 'satellites' | 'carriers' | 'cctv'
  | 'kiwisdr' | 'frontlines' | 'gdelt_incidents';

export type ActiveLayers = Record<LayerKey, boolean>;

export const DEFAULT_LAYERS: ActiveLayers = {
  flights: false,
  military: true,
  private: false,
  tracked: true,
  earthquakes: true,
  fires: true,
  news_markers: true,
  day_night: true,
  gps_jamming: true,
  satellites: false,
  carriers: true,
  cctv: false,
  kiwisdr: false,
  frontlines: true,
  gdelt_incidents: true,
};

interface LayerDef {
  id: LayerKey;
  name: string;
  source: string;
  icon: React.ElementType;
  color: string;
}

const LAYERS: LayerDef[] = [
  { id: 'tracked', name: 'Tracked / POTUS Fleet', source: 'adsb.lol LADD', icon: Star, color: 'text-pink-400' },
  { id: 'military', name: 'Military Flights', source: 'adsb.lol', icon: Shield, color: 'text-yellow-400' },
  { id: 'flights', name: 'Commercial Flights', source: 'adsb.lol', icon: Plane, color: 'text-cyan-400' },
  { id: 'private', name: 'Private / Jets', source: 'adsb.lol', icon: Plane, color: 'text-orange-400' },
  { id: 'gps_jamming', name: 'GPS Jamming Zones', source: 'ADS-B NACp', icon: AlertOctagon, color: 'text-rose-400' },
  { id: 'satellites', name: 'Satellites', source: 'CelesTrak', icon: Satellite, color: 'text-purple-400' },
  { id: 'carriers', name: 'Carrier Strike Groups', source: 'GDELT OSINT', icon: Anchor, color: 'text-blue-400' },
  { id: 'earthquakes', name: 'Earthquakes (24h)', source: 'USGS', icon: Activity, color: 'text-red-400' },
  { id: 'fires', name: 'Fire Hotspots', source: 'NASA FIRMS', icon: Flame, color: 'text-orange-500' },
  { id: 'frontlines', name: 'Ukraine Frontlines', source: 'DeepStateMap', icon: MapPin, color: 'text-red-500' },
  { id: 'gdelt_incidents', name: 'Military Incidents', source: 'GDELT', icon: Zap, color: 'text-red-300' },
  { id: 'news_markers', name: 'Global Incidents', source: 'RSS / GDELT', icon: AlertTriangle, color: 'text-amber-400' },
  { id: 'cctv', name: 'CCTV Cameras', source: 'TfL / SGP / NYC', icon: Camera, color: 'text-green-400' },
  { id: 'kiwisdr', name: 'KiwiSDR Receivers', source: 'kiwisdr.com', icon: Radio, color: 'text-amber-500' },
  { id: 'day_night', name: 'Day / Night Cycle', source: 'Solar Calc', icon: Sun, color: 'text-blue-300' },
];

interface Props {
  activeLayers: ActiveLayers;
  setActiveLayers: React.Dispatch<React.SetStateAction<ActiveLayers>>;
  counts: Record<string, number>;
  lastUpdated?: string;
}

export function GlobalLayerPanel({ activeLayers, setActiveLayers, counts, lastUpdated }: Props) {
  const [minimized, setMinimized] = useState(false);

  const toggle = (id: LayerKey) => {
    setActiveLayers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const activeCount = Object.values(activeLayers).filter(Boolean).length;

  return (
    <div className="w-full flex flex-col pointer-events-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="text-[10px] text-cyan-500/60 font-mono tracking-widest mb-1">
          TOP SECRET // SI-TK // NOFORN
        </div>
        <div className="flex items-center gap-2">
          <Globe size={20} className="text-cyan-400" />
          <h1 className="text-xl font-bold tracking-[0.15em] text-white/90">SHADOWBROKER</h1>
        </div>
        {lastUpdated && (
          <div className="text-[9px] text-white/30 font-mono mt-1">
            LAST SYNC: {new Date(lastUpdated).toLocaleTimeString()} · {activeCount} LAYERS
          </div>
        )}
      </div>

      {/* Layer list */}
      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl flex flex-col overflow-hidden">
        <div
          className="flex justify-between items-center p-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
          onClick={() => setMinimized(!minimized)}
        >
          <span className="text-[10px] text-white/40 font-mono tracking-widest">DATA LAYERS ({activeCount}/{LAYERS.length})</span>
          <button className="text-white/30 hover:text-white/60 transition-colors">
            {minimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {!minimized && (
          <div className="flex flex-col gap-4 p-3 pt-2 max-h-[60vh] overflow-y-auto styled-scrollbar">
            {LAYERS.map(layer => {
              const Icon = layer.icon;
              const active = activeLayers[layer.id];
              const count = counts[layer.id];

              return (
                <div
                  key={layer.id}
                  className="flex items-start justify-between group cursor-pointer"
                  onClick={() => toggle(layer.id)}
                >
                  <div className="flex gap-2.5">
                    <div className={`mt-0.5 ${active ? layer.color : 'text-gray-600 group-hover:text-gray-400'} transition-colors`}>
                      <Icon size={15} strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-medium ${active ? 'text-white/90' : 'text-white/40'} tracking-wide`}>
                        {layer.name}
                      </span>
                      <span className="text-[9px] text-white/25 font-mono tracking-wider mt-0.5">
                        {layer.source} · {active ? 'LIVE' : 'OFF'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {active && count !== undefined && count > 0 && (
                      <span className="text-[10px] text-white/40 font-mono">
                        {count.toLocaleString()}
                      </span>
                    )}
                    <div className={`text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded-full border ${
                      active
                        ? 'border-cyan-500/50 text-cyan-400 bg-cyan-950/30'
                        : 'border-white/10 text-white/25 bg-transparent'
                    }`}>
                      {active ? 'ON' : 'OFF'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
