'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import type { SportsConfig, WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { WidgetShell, Freshness } from './WidgetShell';
import { TickingNumber } from '../motion/TickingNumber';
import { AnimatedList } from '../motion/AnimatedList';
import { publishMoment } from '@/lib/moments';

interface Game {
  id: string;
  league: string;
  name: string;
  shortName: string;
  startTime: string;
  homeTeam: string;
  homeAbbr: string;
  homeLogo: string;
  homeScore: string;
  homeWinner: boolean;
  awayTeam: string;
  awayAbbr: string;
  awayLogo: string;
  awayScore: string;
  awayWinner: boolean;
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
  widgetId?: string;
}

const POLL_INTERVAL = 60_000;
const LIVE_INTERVAL = 20_000;

function formatStartTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function periodClock(game: Game): string {
  if (game.period > 0 && game.displayClock) return `P${game.period} ${game.displayClock}`;
  return game.statusDetail || 'LIVE';
}

/** One-shot low-opacity row wash that replays whenever flashKey changes. */
function ScoreFlash({ flashKey }: { flashKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!flashKey || !ref.current) return;
    const anim = ref.current.animate(
      [{ opacity: 0.14 }, { opacity: 0 }],
      { duration: 1200, easing: 'ease-out' },
    );
    return () => anim.cancel();
  }, [flashKey]);
  return (
    <div
      ref={ref}
      className="absolute inset-0 rounded-lg pointer-events-none"
      style={{ background: 'var(--color-ok)', opacity: 0 }}
      aria-hidden
    />
  );
}

function TeamLogo({
  src,
  broken,
  onError,
  size,
}: {
  src: string;
  broken: boolean;
  onError: (src: string) => void;
  size: number;
}) {
  if (!src || broken) return null;
  return (
    <img
      src={src}
      alt=""
      className="object-contain shrink-0"
      style={{ width: size, height: size }}
      onError={() => onError(src)}
    />
  );
}

export function SportsWidget({ config, style, widgetId }: SportsWidgetProps) {
  const [brokenLogos, setBrokenLogos] = useState<Set<string>>(new Set());
  const [flashes, setFlashes] = useState<Record<string, number>>({});
  const prevScores = useRef<Map<string, { home: string; away: string }>>(new Map());
  const prevCompleted = useRef<Map<string, boolean>>(new Map());
  const [anyLive, setAnyLive] = useState(false);

  const leagues = config.leagues.join(',');
  const { data, isStale, lastUpdated, phase } = usePolledData<Game[]>(
    `/api/sports?leagues=${encodeURIComponent(leagues)}`,
    { interval: POLL_INTERVAL, liveInterval: LIVE_INTERVAL, live: anyLive },
  );

  const games = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const hasFavorites = (config.favoriteTeams?.length ?? 0) > 0;

  const isFavorite = useMemo(() => {
    const favs = (config.favoriteTeams ?? []).map(f => f.toLowerCase()).filter(Boolean);
    return (team: string): boolean => {
      if (!team) return false;
      const t = team.toLowerCase();
      return favs.some(f => t.includes(f) || f.includes(t));
    };
  }, [config.favoriteTeams]);

  const gameHasFavorite = useMemo(() => {
    return (g: Game): boolean =>
      isFavorite(g.homeTeam) || isFavorite(g.awayTeam) ||
      isFavorite(g.homeAbbr) || isFavorite(g.awayAbbr);
  }, [isFavorite]);

  // Favorites filter, then sort: live first, then scheduled by start, then finals
  const visibleGames = useMemo(() => {
    const filtered = hasFavorites ? games.filter(gameHasFavorite) : games;
    return [...filtered].sort((a, b) => {
      const rank = (g: Game) => (g.isLive ? 0 : !g.isCompleted ? 1 : 2);
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
  }, [games, hasFavorites, gameHasFavorite]);

  // Live favorite games promote to the hero tier
  const heroGames = useMemo(
    () => visibleGames.filter(g => g.isLive && hasFavorites && gameHasFavorite(g)),
    [visibleGames, hasFavorites, gameHasFavorite],
  );
  const heroIds = useMemo(() => new Set(heroGames.map(g => g.id)), [heroGames]);
  const listGames = useMemo(
    () => visibleGames.filter(g => !heroIds.has(g.id)),
    [visibleGames, heroIds],
  );

  // Adaptive polling while anything is live
  useEffect(() => {
    setAnyLive(games.some(g => g.isLive));
  }, [games]);

  // Scoring-change flashes + favorite-win moments
  useEffect(() => {
    if (games.length === 0) return;
    const now = Date.now();
    const nextFlashes: Record<string, number> = {};
    for (const g of games) {
      const prev = prevScores.current.get(g.id);
      if (prev && (g.isLive || g.isCompleted) && (prev.home !== g.homeScore || prev.away !== g.awayScore)) {
        nextFlashes[g.id] = now;
      }
      prevScores.current.set(g.id, { home: g.homeScore, away: g.awayScore });

      const wasCompleted = prevCompleted.current.get(g.id);
      if (wasCompleted === false && g.isCompleted) {
        const favWon =
          (g.homeWinner && (isFavorite(g.homeTeam) || isFavorite(g.homeAbbr))) ||
          (g.awayWinner && (isFavorite(g.awayTeam) || isFavorite(g.awayAbbr)));
        // TODO: WidgetFactory does not pass widgetId to SportsWidget yet; wire it there to enable game.won moments
        if (favWon && widgetId) {
          const winner = g.homeWinner ? g.homeTeam : g.awayTeam;
          const winScore = g.homeWinner ? g.homeScore : g.awayScore;
          const loseScore = g.homeWinner ? g.awayScore : g.homeScore;
          publishMoment({
            type: 'game.won',
            widgetId,
            headline: `${winner} win ${winScore} to ${loseScore}`,
          });
        }
      }
      prevCompleted.current.set(g.id, g.isCompleted);
    }
    if (Object.keys(nextFlashes).length > 0) {
      setFlashes(f => ({ ...f, ...nextFlashes }));
    }
  }, [games, isFavorite, widgetId]);

  const markBroken = (src: string) => {
    setBrokenLogos(prev => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  };

  const title = hasFavorites ? 'My Teams' : 'Scoreboard';

  let body;
  if (phase === 'loading' && games.length === 0) {
    body = (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--border-card)', borderTopColor: 'var(--color-text-3)' }}
        />
      </div>
    );
  } else if (phase === 'error' && games.length === 0) {
    body = (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4">
        <Trophy size={20} style={{ color: 'var(--color-text-3)' }} />
        <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
          Scores unavailable, retrying
        </span>
      </div>
    );
  } else if (visibleGames.length === 0) {
    body = (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4">
        <Trophy size={20} style={{ color: 'var(--color-text-3)' }} />
        <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
          {hasFavorites ? 'No games for your teams today' : 'No games today'}
        </span>
      </div>
    );
  } else {
    body = (
      <div className="w-full h-full flex flex-col px-3 pb-2 overflow-hidden">
        {/* Hero tier: live favorite games */}
        {heroGames.map(game => (
          <div
            key={game.id}
            className="relative material-well rounded-lg px-3 py-2.5 mb-1.5 shrink-0"
          >
            <ScoreFlash flashKey={flashes[game.id] ?? 0} />
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="font-mono text-[12px] uppercase"
                style={{ color: 'var(--color-text-3)', letterSpacing: 'var(--tracking-caps)' }}
              >
                {game.league}
              </span>
              <div className="flex items-center gap-2">
                <span className="live-dot live-dot--live" aria-hidden />
                <span
                  className="glass-chip px-2 py-0.5 font-mono text-[12px]"
                  style={{ color: 'var(--color-live)' }}
                >
                  {periodClock(game)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <TeamLogo src={game.awayLogo} broken={brokenLogos.has(game.awayLogo)} onError={markBroken} size={22} />
                <span
                  className="text-[13px] font-semibold truncate"
                  style={{ color: 'var(--color-text-1)' }}
                >
                  {game.awayAbbr || game.awayTeam}
                </span>
              </div>
              <div className="flex items-baseline gap-2 shrink-0">
                <TickingNumber
                  value={parseInt(game.awayScore, 10) || 0}
                  format={v => String(Math.round(v))}
                  className="type-value"
                />
                <span className="font-mono text-[13px]" style={{ color: 'var(--color-text-3)' }}>:</span>
                <TickingNumber
                  value={parseInt(game.homeScore, 10) || 0}
                  format={v => String(Math.round(v))}
                  className="type-value"
                />
              </div>
              <div className="flex items-center gap-2 justify-end min-w-0">
                <span
                  className="text-[13px] font-semibold truncate"
                  style={{ color: 'var(--color-text-1)' }}
                >
                  {game.homeAbbr || game.homeTeam}
                </span>
                <TeamLogo src={game.homeLogo} broken={brokenLogos.has(game.homeLogo)} onError={markBroken} size={22} />
              </div>
            </div>
          </div>
        ))}

        {/* Standard rows */}
        <AnimatedList className="flex-1 overflow-y-auto scrollbar-thin space-y-1 min-h-0">
          {listGames.map(game => {
            const scheduled = !game.isLive && !game.isCompleted;
            const homeFav = isFavorite(game.homeTeam) || isFavorite(game.homeAbbr);
            const awayFav = isFavorite(game.awayTeam) || isFavorite(game.awayAbbr);

            return (
              <div
                key={game.id}
                data-key={game.id}
                className="relative rounded-lg px-2.5 py-2"
                style={{
                  border: '1px solid var(--border-card)',
                  background: 'var(--color-well)',
                }}
              >
                <ScoreFlash flashKey={flashes[game.id] ?? 0} />
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="font-mono text-[12px] uppercase"
                    style={{ color: 'var(--color-text-3)', letterSpacing: 'var(--tracking-caps)' }}
                  >
                    {game.league}
                  </span>
                  {game.isLive ? (
                    <div className="flex items-center gap-1.5">
                      <span className="live-dot live-dot--live" aria-hidden />
                      <span className="font-mono text-[12px]" style={{ color: 'var(--color-live)' }}>
                        {periodClock(game)}
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                      {scheduled
                        ? formatStartTime(game.startTime) || game.statusDetail
                        : game.statusDetail || 'Final'}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {([
                    { side: 'away', team: game.awayAbbr || game.awayTeam, logo: game.awayLogo, score: game.awayScore, fav: awayFav },
                    { side: 'home', team: game.homeAbbr || game.homeTeam, logo: game.homeLogo, score: game.homeScore, fav: homeFav },
                  ]).map(row => (
                    <div key={row.side} className="flex items-center gap-2">
                      <TeamLogo src={row.logo} broken={brokenLogos.has(row.logo)} onError={markBroken} size={16} />
                      <span
                        className="text-[12px] flex-1 truncate"
                        style={{
                          color: row.fav ? 'var(--color-text-1)' : 'var(--color-text-2)',
                          fontWeight: row.fav ? 600 : 400,
                        }}
                      >
                        {row.team}
                      </span>
                      {!scheduled && (
                        <TickingNumber
                          value={parseInt(row.score, 10) || 0}
                          format={v => String(Math.round(v))}
                          className="text-[13px] font-semibold"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </AnimatedList>
      </div>
    );
  }

  return (
    <WidgetShell
      icon={<Trophy size={18} />}
      title={title}
      style={style}
      status={
        <Freshness
          lastUpdated={lastUpdated}
          interval={anyLive ? LIVE_INTERVAL : POLL_INTERVAL}
          isStale={isStale}
          live={anyLive}
        />
      }
    >
      {body}
    </WidgetShell>
  );
}
