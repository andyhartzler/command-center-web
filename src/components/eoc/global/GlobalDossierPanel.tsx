'use client';

import React, { useState } from 'react';
import { X, MapPin, Globe, User, Building, Languages, Coins, Loader2 } from 'lucide-react';

interface DossierData {
  coordinates: { lat: number; lng: number };
  location: {
    city: string;
    state: string;
    country: string;
    countryCode: string;
    displayName: string;
  };
  country: {
    name: string;
    officialName: string;
    leader: string;
    governmentType: string;
    population: number;
    capital: string;
    languages: string[];
    currencies: string[];
    region: string;
    subregion: string;
    areaKm2: number;
    flagEmoji: string;
  } | null;
  local: {
    name: string;
    state: string;
    description: string;
    summary: string;
    thumbnail: string;
  } | null;
}

interface Props {
  lat: number;
  lng: number;
  onClose: () => void;
}

export function GlobalDossierPanel({ lat, lng, onClose }: Props) {
  const [data, setData] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/global/dossier?lat=${lat}&lng=${lng}`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError('Failed to load dossier'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [lat, lng]);

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[320px] z-30 pointer-events-auto">
      <div className="bg-black/80 backdrop-blur-md border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-cyan-400" />
            <span className="text-[10px] text-white/40 font-mono tracking-widest">REGION DOSSIER</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto styled-scrollbar">
          {loading && (
            <div className="flex items-center justify-center gap-2 p-8">
              <Loader2 size={16} className="text-cyan-400 animate-spin" />
              <span className="text-[11px] text-white/40 font-mono">Compiling intelligence...</span>
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-red-400/60 text-xs font-mono">{error}</div>
          )}

          {data && !loading && (
            <div className="flex flex-col gap-0">
              {/* Coordinates */}
              <div className="p-3 border-b border-white/5">
                <div className="text-[9px] text-white/25 font-mono tracking-widest mb-1">COORDINATES</div>
                <div className="text-[12px] text-white/80 font-mono">
                  {lat.toFixed(4)}°, {lng.toFixed(4)}°
                </div>
                {data.location?.displayName && (
                  <div className="text-[10px] text-white/40 mt-1 line-clamp-2">{data.location.displayName}</div>
                )}
              </div>

              {/* Country */}
              {data.country && (
                <div className="p-3 border-b border-white/5">
                  <div className="text-[9px] text-white/25 font-mono tracking-widest mb-2">COUNTRY</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{data.country.flagEmoji}</span>
                    <div>
                      <div className="text-[13px] text-white/90 font-medium">{data.country.name}</div>
                      {data.country.officialName && data.country.officialName !== data.country.name && (
                        <div className="text-[9px] text-white/30">{data.country.officialName}</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-start gap-1.5">
                      <User size={10} className="text-white/20 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[9px] text-white/25 font-mono">LEADER</div>
                        <div className="text-[10px] text-white/60">{data.country.leader}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Building size={10} className="text-white/20 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[9px] text-white/25 font-mono">CAPITAL</div>
                        <div className="text-[10px] text-white/60">{data.country.capital}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Globe size={10} className="text-white/20 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[9px] text-white/25 font-mono">POPULATION</div>
                        <div className="text-[10px] text-white/60">{(data.country.population || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPin size={10} className="text-white/20 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[9px] text-white/25 font-mono">REGION</div>
                        <div className="text-[10px] text-white/60">{data.country.subregion || data.country.region}</div>
                      </div>
                    </div>
                  </div>

                  {data.country.governmentType && data.country.governmentType !== 'Unknown' && (
                    <div className="mt-2 text-[9px] text-white/25 font-mono">
                      GOV: <span className="text-white/40">{data.country.governmentType}</span>
                    </div>
                  )}

                  {data.country.languages.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <Languages size={9} className="text-white/20 shrink-0" />
                      <span className="text-[9px] text-white/35">{data.country.languages.join(', ')}</span>
                    </div>
                  )}

                  {data.country.currencies.length > 0 && (
                    <div className="mt-1 flex items-center gap-1">
                      <Coins size={9} className="text-white/20 shrink-0" />
                      <span className="text-[9px] text-white/35">{data.country.currencies.join(', ')}</span>
                    </div>
                  )}

                  {data.country.areaKm2 > 0 && (
                    <div className="mt-1 text-[9px] text-white/25 font-mono">
                      AREA: {data.country.areaKm2.toLocaleString()} km²
                    </div>
                  )}
                </div>
              )}

              {/* Local info */}
              {data.local && (
                <div className="p-3">
                  <div className="text-[9px] text-white/25 font-mono tracking-widest mb-2">LOCAL INTEL</div>
                  {data.local.thumbnail && (
                    <img
                      src={data.local.thumbnail}
                      alt=""
                      className="w-full h-24 object-cover rounded-md mb-2 opacity-80"
                    />
                  )}
                  {data.local.name && (
                    <div className="text-[12px] text-white/80 font-medium mb-1">{data.local.name}</div>
                  )}
                  {data.local.description && (
                    <div className="text-[10px] text-white/40 italic mb-1">{data.local.description}</div>
                  )}
                  {data.local.summary && (
                    <div className="text-[10px] text-white/50 leading-relaxed line-clamp-6">
                      {data.local.summary}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
