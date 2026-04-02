import { NextRequest, NextResponse } from 'next/server';

const LEAGUE_MAP: Record<string, { sport: string; league: string }> = {
  nfl: { sport: 'football', league: 'nfl' },
  nba: { sport: 'basketball', league: 'nba' },
  mlb: { sport: 'baseball', league: 'mlb' },
  nhl: { sport: 'hockey', league: 'nhl' },
  mls: { sport: 'soccer', league: 'usa.1' },
  wnba: { sport: 'basketball', league: 'wnba' },
  nwsl: { sport: 'soccer', league: 'usa.nwsl' },
  ncaaf: { sport: 'football', league: 'college-football' },
  ncaab: { sport: 'basketball', league: 'mens-college-basketball' },
  epl: { sport: 'soccer', league: 'eng.1' },
  laliga: { sport: 'soccer', league: 'esp.1' },
  bundesliga: { sport: 'soccer', league: 'ger.1' },
  seriea: { sport: 'soccer', league: 'ita.1' },
  ligue1: { sport: 'soccer', league: 'fra.1' },
  ucl: { sport: 'soccer', league: 'uefa.champions' },
  liga_mx: { sport: 'soccer', league: 'mex.1' },
};

interface ESPNCompetitor {
  team?: {
    displayName?: string;
    abbreviation?: string;
    logo?: string;
  };
  score?: string;
  homeAway?: string;
  winner?: boolean;
}

interface ESPNCompetition {
  competitors?: ESPNCompetitor[];
  status?: {
    type?: {
      name?: string;
      shortDetail?: string;
      completed?: boolean;
    };
    displayClock?: string;
    period?: number;
  };
}

interface ESPNEvent {
  id?: string;
  name?: string;
  shortName?: string;
  competitions?: ESPNCompetition[];
}

interface ESPNResponse {
  events?: ESPNEvent[];
}

export interface NormalizedGame {
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

export async function GET(request: NextRequest) {
  const leagueParam = request.nextUrl.searchParams.get('leagues') || 'nfl,nba,mlb';
  const leagues = leagueParam.split(',').map(l => l.trim().toLowerCase());

  try {
    const results: NormalizedGame[] = [];

    const fetches = leagues.map(async (leagueKey) => {
      const mapping = LEAGUE_MAP[leagueKey];
      if (!mapping) return [];

      const url = `https://site.api.espn.com/apis/site/v2/sports/${mapping.sport}/${mapping.league}/scoreboard`;

      try {
        const res = await fetch(url, { next: { revalidate: 15 } });
        if (!res.ok) return [];

        const data: ESPNResponse = await res.json();
        const events = data.events || [];

        return events.map((event): NormalizedGame => {
          const comp = event.competitions?.[0];
          const competitors = comp?.competitors || [];
          const home = competitors.find(c => c.homeAway === 'home');
          const away = competitors.find(c => c.homeAway === 'away');
          const status = comp?.status;
          const statusName = status?.type?.name || '';

          return {
            id: event.id || '',
            league: leagueKey.toUpperCase(),
            name: event.name || '',
            shortName: event.shortName || '',
            homeTeam: home?.team?.displayName || 'TBD',
            homeAbbr: home?.team?.abbreviation || '',
            homeLogo: home?.team?.logo || '',
            homeScore: home?.score || '0',
            awayTeam: away?.team?.displayName || 'TBD',
            awayAbbr: away?.team?.abbreviation || '',
            awayLogo: away?.team?.logo || '',
            awayScore: away?.score || '0',
            statusName,
            statusDetail: status?.type?.shortDetail || '',
            isLive: statusName === 'STATUS_IN_PROGRESS',
            isCompleted: status?.type?.completed || false,
            displayClock: status?.displayClock || '',
            period: status?.period || 0,
          };
        });
      } catch {
        console.error(`[sports] Failed to fetch ${leagueKey}`);
        return [];
      }
    });

    const allGames = await Promise.all(fetches);
    allGames.forEach(games => results.push(...games));

    return NextResponse.json(results);
  } catch (err) {
    console.error('[sports] fetch error', err);
    return NextResponse.json({ error: 'Failed to fetch sports data' }, { status: 500 });
  }
}
