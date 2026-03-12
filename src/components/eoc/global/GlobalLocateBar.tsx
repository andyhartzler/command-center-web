'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Search, MapPin, X } from 'lucide-react';

interface Props {
  onFlyTo: (lat: number, lng: number, name?: string) => void;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

export function GlobalLocateBar({ onFlyTo }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    // Check for direct coordinate input (lat, lng)
    const coordMatch = q.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setResults([{ display_name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat: String(lat), lon: String(lng), type: 'coordinate' }]);
        setShowResults(true);
        return;
      }
    }

    setIsSearching(true);
    try {
      // Nominatim geocoding (free, rate-limited to 1 req/sec)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`,
        { headers: { 'User-Agent': 'CommandCenter/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setShowResults(true);
      }
    } catch {}
    setIsSearching(false);
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => search(value), 400);
  };

  const handleSelect = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    onFlyTo(lat, lng, result.display_name);
    setQuery(result.display_name.split(',')[0]);
    setShowResults(false);
  };

  return (
    <div className="relative pointer-events-auto">
      <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5">
        <Search size={12} className="text-white/30" />
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Search location or coordinates..."
          className="bg-transparent text-white/80 text-xs font-mono placeholder:text-white/20 outline-none w-48"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setShowResults(false); }}
            className="text-white/20 hover:text-white/50"
          >
            <X size={10} />
          </button>
        )}
        {isSearching && (
          <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-black/90 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden z-50">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full flex items-start gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
            >
              <MapPin size={10} className="text-cyan-400 mt-0.5 shrink-0" />
              <span className="text-[11px] text-white/70 line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
