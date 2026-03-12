'use client';

import React, { useState } from 'react';
import { Settings, X, ChevronDown, ChevronUp, Sun, Monitor, Gauge, Layers, Sparkles, Focus, Shield } from 'lucide-react';

interface SettingsConfig {
  crtEnabled: boolean;
  bloomEnabled: boolean;
  sharpenAmount: number; // 0-100
  tacticalMode: boolean;
  refreshRate: 'fast' | 'normal' | 'slow';
  maxFlightMarkers: number;
  showCoordinates: boolean;
  showBottomBar: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsConfig;
  onSettingsChange: (settings: SettingsConfig) => void;
}

const DATA_SOURCES = [
  { name: 'adsb.lol', desc: 'Flight tracking (ADS-B)', status: 'active', free: true },
  { name: 'USGS', desc: 'Earthquake data', status: 'active', free: true },
  { name: 'NASA FIRMS', desc: 'Fire hotspots (VIIRS)', status: 'active', free: true },
  { name: 'CelesTrak', desc: 'Satellite TLE data', status: 'active', free: true },
  { name: 'GDELT', desc: 'Global conflict events', status: 'active', free: true },
  { name: 'DeepStateMap', desc: 'Ukraine frontlines', status: 'active', free: true },
  { name: 'NOAA SWPC', desc: 'Space weather scales', status: 'active', free: true },
  { name: 'Broadcastify', desc: 'Radio scanner feeds', status: 'active', free: true },
  { name: 'KiwiSDR', desc: 'SDR receiver network', status: 'active', free: true },
  { name: 'TfL / NYC / SGP', desc: 'CCTV cameras', status: 'active', free: true },
  { name: 'AIS Stream', desc: 'Maritime vessel tracking', status: 'active', free: false },
  { name: 'NASA GIBS', desc: 'MODIS Terra satellite imagery', status: 'active', free: true },
  { name: 'IODA', desc: 'Internet outage detection', status: 'active', free: true },
  { name: 'DC Map', desc: 'Data center locations', status: 'active', free: true },
  { name: 'LiveUAMap', desc: 'Conflict zone events', status: 'active', free: true },
];

export function GlobalSettingsPanel({ isOpen, onClose, settings, onSettingsChange }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>('display');

  if (!isOpen) return null;

  const toggleSection = (s: string) => setExpandedSection(expandedSection === s ? null : s);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed left-0 top-0 bottom-0 w-[400px] bg-[#0a0e1a]/95 backdrop-blur-xl border-r border-cyan-900/30 z-[9999] flex flex-col shadow-[4px_0_40px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Settings size={16} className="text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold tracking-[0.2em] text-white/90 font-mono">SYSTEM CONFIG</h2>
              <span className="text-[9px] text-white/30 font-mono tracking-widest">SETTINGS & DATA SOURCES</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-white/10 hover:border-red-500/50 flex items-center justify-center text-white/30 hover:text-red-400 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto styled-scrollbar p-4 space-y-3">
          {/* Display Section */}
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => toggleSection('display')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Monitor size={12} className="text-cyan-400" />
                <span className="text-[10px] text-white/60 font-mono tracking-widest">DISPLAY</span>
              </div>
              {expandedSection === 'display' ? <ChevronUp size={12} className="text-white/30" /> : <ChevronDown size={12} className="text-white/30" />}
            </button>
            {expandedSection === 'display' && (
              <div className="px-4 pb-4 space-y-3">
                {/* CRT Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-white/70 font-mono">CRT Scanline Effect</span>
                    <p className="text-[9px] text-white/30 font-mono">Retro CRT monitor overlay</p>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ ...settings, crtEnabled: !settings.crtEnabled })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings.crtEnabled ? 'bg-cyan-500/30 border-cyan-500/50' : 'bg-white/5 border-white/10'} border`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full transition-all absolute top-0.5 ${settings.crtEnabled ? 'left-5 bg-cyan-400' : 'left-0.5 bg-white/30'}`} />
                  </button>
                </div>

                {/* Show Coordinates */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-white/70 font-mono">Coordinate Display</span>
                    <p className="text-[9px] text-white/30 font-mono">Show lat/lng on map</p>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ ...settings, showCoordinates: !settings.showCoordinates })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings.showCoordinates ? 'bg-cyan-500/30 border-cyan-500/50' : 'bg-white/5 border-white/10'} border`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full transition-all absolute top-0.5 ${settings.showCoordinates ? 'left-5 bg-cyan-400' : 'left-0.5 bg-white/30'}`} />
                  </button>
                </div>

                {/* Bottom Bar */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-white/70 font-mono">Bottom Status Bar</span>
                    <p className="text-[9px] text-white/30 font-mono">Stats, UTC clock, markets</p>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ ...settings, showBottomBar: !settings.showBottomBar })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings.showBottomBar ? 'bg-cyan-500/30 border-cyan-500/50' : 'bg-white/5 border-white/10'} border`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full transition-all absolute top-0.5 ${settings.showBottomBar ? 'left-5 bg-cyan-400' : 'left-0.5 bg-white/30'}`} />
                  </button>
                </div>

                {/* Bloom Effect */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-white/70 font-mono">Bloom Effect</span>
                    <p className="text-[9px] text-white/30 font-mono">Glow on bright map elements</p>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ ...settings, bloomEnabled: !settings.bloomEnabled })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings.bloomEnabled ? 'bg-purple-500/30 border-purple-500/50' : 'bg-white/5 border-white/10'} border`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full transition-all absolute top-0.5 ${settings.bloomEnabled ? 'left-5 bg-purple-400' : 'left-0.5 bg-white/30'}`} />
                  </button>
                </div>

                {/* Sharpen */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs text-white/70 font-mono">Sharpen</span>
                      <p className="text-[9px] text-white/30 font-mono">Enhance map edge clarity</p>
                    </div>
                    <span className="text-[9px] text-white/40 font-mono">{settings.sharpenAmount}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.sharpenAmount}
                    onChange={e => onSettingsChange({ ...settings, sharpenAmount: Number(e.target.value) })}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                {/* Tactical Mode */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-white/70 font-mono">Tactical Mode</span>
                    <p className="text-[9px] text-white/30 font-mono">Hide all UI panels for focus</p>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ ...settings, tacticalMode: !settings.tacticalMode })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings.tacticalMode ? 'bg-red-500/30 border-red-500/50' : 'bg-white/5 border-white/10'} border`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full transition-all absolute top-0.5 ${settings.tacticalMode ? 'left-5 bg-red-400' : 'left-0.5 bg-white/30'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Performance Section */}
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => toggleSection('performance')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Gauge size={12} className="text-orange-400" />
                <span className="text-[10px] text-white/60 font-mono tracking-widest">PERFORMANCE</span>
              </div>
              {expandedSection === 'performance' ? <ChevronUp size={12} className="text-white/30" /> : <ChevronDown size={12} className="text-white/30" />}
            </button>
            {expandedSection === 'performance' && (
              <div className="px-4 pb-4 space-y-3">
                {/* Refresh Rate */}
                <div>
                  <span className="text-xs text-white/70 font-mono block mb-2">Refresh Rate</span>
                  <div className="flex gap-2">
                    {(['fast', 'normal', 'slow'] as const).map(rate => (
                      <button
                        key={rate}
                        onClick={() => onSettingsChange({ ...settings, refreshRate: rate })}
                        className={`flex-1 py-1.5 rounded text-[9px] font-mono tracking-widest border transition-colors ${
                          settings.refreshRate === rate
                            ? 'border-cyan-500/50 text-cyan-400 bg-cyan-950/20'
                            : 'border-white/10 text-white/30 hover:text-white/50'
                        }`}
                      >
                        {rate === 'fast' ? '30s' : rate === 'normal' ? '60s' : '120s'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Markers */}
                <div>
                  <span className="text-xs text-white/70 font-mono block mb-2">Max Flight Markers</span>
                  <div className="flex gap-2">
                    {[1000, 2000, 3000, 5000].map(n => (
                      <button
                        key={n}
                        onClick={() => onSettingsChange({ ...settings, maxFlightMarkers: n })}
                        className={`flex-1 py-1.5 rounded text-[9px] font-mono border transition-colors ${
                          settings.maxFlightMarkers === n
                            ? 'border-cyan-500/50 text-cyan-400 bg-cyan-950/20'
                            : 'border-white/10 text-white/30 hover:text-white/50'
                        }`}
                      >
                        {n.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Data Sources Section */}
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => toggleSection('sources')}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers size={12} className="text-green-400" />
                <span className="text-[10px] text-white/60 font-mono tracking-widest">DATA SOURCES ({DATA_SOURCES.length})</span>
              </div>
              {expandedSection === 'sources' ? <ChevronUp size={12} className="text-white/30" /> : <ChevronDown size={12} className="text-white/30" />}
            </button>
            {expandedSection === 'sources' && (
              <div className="px-4 pb-3 space-y-1.5">
                {DATA_SOURCES.map((src, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div>
                      <span className="text-[10px] text-white/70 font-mono">{src.name}</span>
                      <span className="text-[9px] text-white/25 font-mono ml-2">{src.desc}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {src.free && <span className="text-[8px] text-green-400/60 font-mono">FREE</span>}
                      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                        src.status === 'active'
                          ? 'border-green-500/30 text-green-400 bg-green-950/20'
                          : 'border-yellow-500/30 text-yellow-400 bg-yellow-950/20'
                      }`}>
                        {src.status === 'active' ? 'LIVE' : 'NO KEY'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-between text-[9px] text-white/25 font-mono">
            <span>SHADOWBROKER v2.1</span>
            <span>{DATA_SOURCES.filter(s => s.status === 'active').length} ACTIVE SOURCES</span>
          </div>
        </div>
      </div>
    </>
  );
}

// Default settings
export const DEFAULT_SETTINGS: SettingsConfig = {
  crtEnabled: false,
  bloomEnabled: false,
  sharpenAmount: 0,
  tacticalMode: false,
  refreshRate: 'normal',
  maxFlightMarkers: 3000,
  showCoordinates: true,
  showBottomBar: true,
};

export type { SettingsConfig };
