'use client';

import React, { useState } from 'react';
import { Layers, ChevronDown } from 'lucide-react';

export type MapStyleId = 'dark' | 'light' | 'satellite';

interface Props {
  current: MapStyleId;
  onChange: (style: MapStyleId) => void;
}

const STYLES: { id: MapStyleId; label: string; preview: string }[] = [
  { id: 'dark', label: 'Dark', preview: '🌑' },
  { id: 'light', label: 'Light', preview: '☀️' },
  { id: 'satellite', label: 'Satellite', preview: '🛰' },
];

export function GlobalMapStyleSwitcher({ current, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative pointer-events-auto">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1.5 hover:bg-white/5 transition-colors"
      >
        <Layers size={12} className="text-white/40" />
        <span className="text-[9px] text-white/50 font-mono">{STYLES.find(s => s.id === current)?.label.toUpperCase()}</span>
        <ChevronDown size={10} className="text-white/30" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 right-0 bg-black/90 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden min-w-[100px]">
          {STYLES.map(style => (
            <button
              key={style.id}
              onClick={() => { onChange(style.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/5 transition-colors ${
                current === style.id ? 'bg-cyan-500/10' : ''
              }`}
            >
              <span className="text-[10px]">{style.preview}</span>
              <span className={`text-[10px] font-mono ${current === style.id ? 'text-cyan-400' : 'text-white/50'}`}>
                {style.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Map style definitions
export function getMapStyle(id: MapStyleId): any {
  switch (id) {
    case 'light':
      return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'carto-light': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
          },
        },
        layers: [
          { id: 'carto-light-layer', type: 'raster', source: 'carto-light', minzoom: 0, maxzoom: 22 },
        ],
      };
    case 'satellite':
      return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
          },
        },
        layers: [
          { id: 'esri-satellite-layer', type: 'raster', source: 'esri-satellite', minzoom: 0, maxzoom: 18 },
        ],
      };
    default: // dark
      return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
          },
        },
        layers: [
          { id: 'carto-dark-layer', type: 'raster', source: 'carto-dark', minzoom: 0, maxzoom: 22 },
        ],
      };
  }
}
