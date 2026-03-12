'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy } from 'lucide-react';
import type { SportsConfig, WidgetStyle } from '@/types/widget';

interface Game {
  id: string;
  league: string;
  name: string;
  shortName: string;
  homeTeam: string;
  homeAbbr: string;
  homeLogo: string;
  homeScore: string;
  awayTeam: string;
  awayAbbr: string;
  awayLogo: string;
  awayScore: string;
  statusName: string;
  statusDetail: string;
  isLive: boolean;
  isCompleted: boolean;
  displayClock: string;
  period: number;
}

interface SportsWidgetProps {
  config: SportsConfig;
  style: WidgetStyle;
}

function getLeagueColor(league: string): string {
  switch (league) {
    case 'NFL': return 'text-green-500/70';
    case 'NBA': return 'text-orange-400/70';
    case 'MLB': return 'text-[#6b8aab]/70';
    case 'NHL': return 'text-sky-400/70';
    case 'MLS': return 'text-emerald-400/70';
    default: return 'text-white/40';
  }
}

function getLeagueBorderColor(league: string): string {
  switch (league) {
    case 'NFL': return 'border-green-500/20';
    case 'NBA': return 'border-orange-400/20';
    case 'MLB': return 'border-[#6b8aab]/20';
    case 'NHL': return 'border-sky-400/20';
    case 'MLS': return 'border-emerald-400/20';
    default: return 'border-white/10';
  }
}

export function SportsWidget({ config }: SportsWidgetProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const imgErrorsRef = useRef<Set<string>>(new Set());

  const fetchSports = useCallback(async () => {
    try {
      const leagues = config.leagues.join(',');
      const res = await fetch(`/api/sports?leagues=${leagues}`);
      if (!res.ok) return;
      const data: Game[] = await res.json();
      if (Array.isArray(data)) {
        // Sort: live games first, then scheduled, then completed
        data.sort((a, b) => {
          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;
          if (!a.isCompleted && b.isCompleted) return -1;
          if (a.isCompleted && !b.isCompleted) return 1;
          return 0;
        });
        setGames(data);
      }
    } catch (err) {
      console.error('[SportsWidget] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [config.leagues]);

  useEffect(() => {
    fetchSports();
    const interval = setInterval(fetchSports, 30_000);
    return () => clearInterval(interval);
  }, [fetchSports]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <Trophy size={20} className="text-white/20" />
        <span className="text-xs text-white/30">No games today</span>
      </div>
    );
  }

  // Highlight favorite teams
  const isFavorite = (team: string): boolean =>
    config.favoriteTeams?.some(
      (fav) =>
        team.toLowerCase().includes(fav.toLowerCase()) ||
        fav.toLowerCase().includes(team.toLowerCase()),
    ) || false;

  return (
    <div className="w-full h-full flex flex-col p-3 overflow-hidden">
      {/* Header */}
      <div
        className="text-[10px] font-bold text-white/30 uppercase mb-2"
        style={{ letterSpacing: '4px' }}
      >
        Scoreboard
      </div>

      {/* Games */}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1">
        {games.map((game) => {
          const homeFav = isFavorite(game.homeTeam);
          const awayFav = isFavorite(game.awayTeam);

          return (
            <div
              key={game.id}
              className={`rounded-lg px-2.5 py-2 border ${getLeagueBorderColor(game.league)} bg-white/[0.02]`}
            >
              {/* League + status row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[9px] font-bold uppercase tracking-wider ${getLeagueColor(game.league)}`}>
                  {game.league}
                </span>

                {game.isLive ? (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: '#22c55e', boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)' }}
                    />
                    <span className="text-[9px] font-semibold text-green-400/80">
                      {game.statusDetail || 'LIVE'}
                    </span>
                  </div>
                ) : (
                  <span className="text-[9px] text-white/25">
                    {game.statusDetail || game.statusName}
                  </span>
                )}
              </div>

              {/* Teams */}
              <div className="flex flex-col gap-1">
                {/* Away team row */}
                <div className="flex items-center gap-2">
                  {game.awayLogo && !imgErrorsRef.current.has(game.awayLogo) && (
                    <img
                      src={game.awayLogo}
                      alt=""
                      className="w-4 h-4 object-contain shrink-0"
                      onError={(e) => {
                        imgErrorsRef.current.add(game.awayLogo);
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <span
                    className={`text-xs flex-1 truncate ${
                      awayFav
                        ? 'font-semibold text-white/90'
                        : 'font-normal text-white/60'
                    }`}
                  >
                    {game.awayAbbr || game.awayTeam}
                  </span>
                  <span
                    className={`text-sm tabular-nums ${
                      game.isLive || game.isCompleted
                        ? 'font-bold text-white/80'
                        : 'text-white/30'
                    }`}
                  >
                    {game.awayScore}
                  </span>
                </div>

                {/* Home team row */}
                <div className="flex items-center gap-2">
                  {game.homeLogo && !imgErrorsRef.current.has(game.homeLogo) && (
                    <img
                      src={game.homeLogo}
                      alt=""
                      className="w-4 h-4 object-contain shrink-0"
                      onError={(e) => {
                        imgErrorsRef.current.add(game.homeLogo);
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <span
                    className={`text-xs flex-1 truncate ${
                      homeFav
                        ? 'font-semibold text-white/90'
                        : 'font-normal text-white/60'
                    }`}
                  >
                    {game.homeAbbr || game.homeTeam}
                  </span>
                  <span
                    className={`text-sm tabular-nums ${
                      game.isLive || game.isCompleted
                        ? 'font-bold text-white/80'
                        : 'text-white/30'
                    }`}
                  >
                    {game.homeScore}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
