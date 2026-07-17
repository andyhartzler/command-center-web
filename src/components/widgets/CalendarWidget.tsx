'use client';
import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, ChevronRight, AlertCircle } from 'lucide-react';
import { type WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { useSharedClock } from '@/hooks/useSharedClock';
import { WidgetShell, Freshness } from './WidgetShell';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  allDay: boolean;
  calendar: string;
  color: string;
}

interface CalendarResponse {
  events?: CalendarEvent[];
  errors?: string[];
  error?: string;
  message?: string;
}

interface CalendarConfig {
  feeds?: { name: string; url: string }[];
}

interface CalendarWidgetProps {
  config: CalendarConfig;
  style: WidgetStyle;
}

const POLL_INTERVAL = 300_000;
/** The hero progress bar fills over the final hour before an event. */
const APPROACH_WINDOW_MS = 60 * 60_000;

function formatEventTime(start: string, end: string, allDay: boolean): string {
  if (allDay) return 'All day';
  try {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${fmt(s)} to ${fmt(e)}`;
  } catch {
    return '';
  }
}

function formatCountdown(msUntil: number): string {
  const mins = Math.max(0, Math.round(msUntil / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rem = mins % 60;
    return rem > 0 ? `in ${hours}h ${rem}m` : `in ${hours}h`;
  }
  return `in ${Math.round(hours / 24)}d`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function groupLabel(date: Date, now: Date): string {
  if (isSameDay(date, now)) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(date, tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function OnboardingRow({ label, swatch }: { label: string; swatch: string }) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
      style={{ background: 'var(--color-well)', border: '1px solid var(--border-card)' }}
    >
      <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: swatch }} />
      <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>{label}</span>
      <ChevronRight size={12} className="ml-auto shrink-0" style={{ color: 'var(--color-text-3)' }} />
    </div>
  );
}

function EventRow({ event, past }: { event: CalendarEvent; past: boolean }) {
  return (
    <div
      className="flex items-stretch gap-2 py-1.5"
      style={{ opacity: past ? 0.45 : 1, transition: 'opacity 400ms var(--ease-out)' }}
    >
      <div
        className="rounded-full shrink-0 self-stretch"
        style={{ width: 3, minHeight: 24, backgroundColor: event.color }}
        title={event.calendar}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium leading-tight truncate" style={{ color: 'var(--color-text-1)' }}>
          {event.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1">
            <Clock size={11} style={{ color: 'var(--color-text-3)' }} />
            <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              {formatEventTime(event.start, event.end, event.allDay)}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-1 min-w-0">
              <MapPin size={11} className="shrink-0" style={{ color: 'var(--color-text-3)' }} />
              <span className="text-[12px] truncate max-w-[120px]" style={{ color: 'var(--color-text-3)' }}>
                {event.location}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CalendarWidget({ config, style }: CalendarWidgetProps) {
  const now = useSharedClock();

  const feeds = config.feeds || [];
  const validFeeds = useMemo(() => feeds.filter(f => f.url && f.url.trim().length > 5), [feeds]);
  const hasFeeds = validFeeds.length > 0;
  const feedsKey = JSON.stringify(validFeeds);

  // Debounce config edits so typing a URL does not flood the API
  const [debouncedKey, setDebouncedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!hasFeeds) {
      setDebouncedKey(null);
      return;
    }
    const t = setTimeout(() => setDebouncedKey(feedsKey), 1500);
    return () => clearTimeout(t);
  }, [feedsKey, hasFeeds]);

  const url = debouncedKey ? `/api/calendar?feeds=${encodeURIComponent(debouncedKey)}` : null;
  const { data, phase, isStale, lastUpdated } = usePolledData<CalendarResponse>(url, {
    interval: POLL_INTERVAL,
  });

  const events = useMemo(() => data?.events ?? [], [data]);

  // Next upcoming timed event drives the hero row
  const heroEvent = useMemo(() => {
    return events.find(ev => !ev.allDay && new Date(ev.start).getTime() > now) ?? null;
  }, [events, now]);

  const listEvents = useMemo(
    () => events.filter(ev => ev.id !== heroEvent?.id),
    [events, heroEvent],
  );

  // Group by day, keeping API order (already sorted by start)
  const grouped = useMemo(() => {
    const groups: { key: string; date: Date; events: CalendarEvent[] }[] = [];
    for (const ev of listEvents) {
      const date = new Date(ev.start);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.events.push(ev);
      else groups.push({ key, date, events: [ev] });
    }
    return groups;
  }, [listEvents]);

  const nowDate = new Date(now);

  if (!hasFeeds) {
    const hasPartialFeeds = feeds.length > 0;
    return (
      <WidgetShell icon={<Calendar size={18} />} title="Calendars" style={style}>
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
          {hasPartialFeeds ? (
            <>
              <div
                className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--border-card)', borderTopColor: 'var(--color-text-3)' }}
              />
              <p className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>Waiting for a calendar URL</p>
              <p className="text-[12px] text-center max-w-[220px]" style={{ color: 'var(--color-text-3)' }}>
                Paste an ICS feed URL in the widget settings. Changes save automatically.
              </p>
            </>
          ) : (
            <>
              <Calendar size={26} style={{ color: 'var(--color-text-3)' }} />
              <div className="text-center">
                <p className="text-[13px] mb-1" style={{ color: 'var(--color-text-2)' }}>No calendars connected</p>
                <p className="text-[12px] max-w-[220px] leading-relaxed" style={{ color: 'var(--color-text-3)' }}>
                  Open this widget in the editor and add calendar ICS feed URLs.
                </p>
              </div>
              <div className="mt-1 space-y-1.5 w-full max-w-[220px]">
                <OnboardingRow label="iCloud Calendar" swatch="var(--color-accent-500)" />
                <OnboardingRow label="Google Calendar" swatch="var(--color-ok)" />
                <OnboardingRow label="Outlook Calendar" swatch="var(--color-info)" />
              </div>
            </>
          )}
        </div>
      </WidgetShell>
    );
  }

  const heroStart = heroEvent ? new Date(heroEvent.start).getTime() : 0;
  const msUntilHero = heroStart - now;
  const heroProgress = heroEvent
    ? Math.min(1, Math.max(0, 1 - msUntilHero / APPROACH_WINDOW_MS))
    : 0;

  let body;
  if (phase === 'loading' && events.length === 0) {
    body = (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <div
          className="w-4 h-4 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--border-card)', borderTopColor: 'var(--color-text-3)' }}
        />
        <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
          Loading {validFeeds.length} {validFeeds.length === 1 ? 'feed' : 'feeds'}
        </span>
      </div>
    );
  } else if (events.length === 0 && (phase === 'error' || (data?.errors?.length ?? 0) > 0)) {
    // Failure state: no data landed and at least one feed errored. Distinct
    // from a genuinely empty schedule below.
    body = (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
        <AlertCircle size={18} style={{ color: 'var(--color-critical)' }} />
        <span className="text-[12px] text-center" style={{ color: 'var(--color-text-3)' }}>
          Calendars unreachable, retrying
        </span>
      </div>
    );
  } else if (events.length === 0) {
    body = (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
        <Calendar size={20} style={{ color: 'var(--color-text-3)' }} />
        <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>No upcoming events</span>
        <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
          {validFeeds.length} {validFeeds.length === 1 ? 'feed' : 'feeds'} connected
        </span>
      </div>
    );
  } else {
    body = (
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* Hero: next upcoming event with live countdown + approach bar */}
        {heroEvent && (
          <div className="material-well rounded-lg mx-3 mb-1.5 px-3 py-2.5 shrink-0 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="rounded-full shrink-0"
                style={{ width: 3, height: 16, backgroundColor: heroEvent.color }}
                title={heroEvent.calendar}
              />
              <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>
                {heroEvent.title}
              </span>
              <span
                className="glass-chip px-2 py-0.5 font-mono text-[12px] ml-auto shrink-0"
                style={{ color: msUntilHero < APPROACH_WINDOW_MS ? 'var(--color-warn)' : 'var(--color-text-2)' }}
              >
                {formatCountdown(msUntilHero)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={11} style={{ color: 'var(--color-text-3)' }} />
              <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                {formatEventTime(heroEvent.start, heroEvent.end, heroEvent.allDay)}
              </span>
              {heroEvent.location && (
                <span className="text-[12px] truncate" style={{ color: 'var(--color-text-3)' }}>
                  {heroEvent.location}
                </span>
              )}
            </div>
            {/* Approach bar: fills via scaleX from the shared clock */}
            <div
              className="absolute left-0 right-0 bottom-0 h-[2px]"
              style={{ background: 'var(--border-card)' }}
            >
              <div
                className="h-full origin-left"
                style={{
                  background: 'var(--color-accent-400)',
                  transform: `scaleX(${heroProgress})`,
                  transition: 'transform 1s linear',
                }}
              />
            </div>
          </div>
        )}

        {/* Day-grouped list with a now hairline between past and upcoming */}
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
          {grouped.map(group => {
            const isCurrentDay = isSameDay(group.date, nowDate);
            // Index of the first event still in progress or upcoming today
            const firstUpcomingIdx = isCurrentDay
              ? group.events.findIndex(ev => new Date(ev.end).getTime() >= now)
              : -1;

            return (
              <div key={group.key} className="px-3">
                <div
                  className="font-mono text-[12px] font-medium uppercase pt-2 pb-1"
                  style={{
                    letterSpacing: 'var(--tracking-caps)',
                    color: isCurrentDay ? 'var(--color-accent-400)' : 'var(--color-text-3)',
                  }}
                >
                  {groupLabel(group.date, nowDate)}
                </div>
                {group.events.map((event, i) => {
                  const past = isCurrentDay
                    ? (firstUpcomingIdx === -1 || i < firstUpcomingIdx)
                    : group.date.getTime() < now && !isCurrentDay && new Date(event.end).getTime() < now;
                  const showHairline = isCurrentDay && firstUpcomingIdx === i && i > 0;

                  return (
                    <div key={event.id}>
                      {showHairline && (
                        <div className="flex items-center gap-2 py-0.5" aria-hidden>
                          <div className="flex-1 h-px" style={{ background: 'var(--color-live)', opacity: 0.5 }} />
                          <span className="font-mono text-[12px]" style={{ color: 'var(--color-live)' }}>
                            now
                          </span>
                          <div className="w-4 h-px" style={{ background: 'var(--color-live)', opacity: 0.5 }} />
                        </div>
                      )}
                      <EventRow event={event} past={past} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <WidgetShell
      icon={<Calendar size={18} />}
      title="Calendars"
      style={style}
      status={
        <Freshness lastUpdated={lastUpdated} interval={POLL_INTERVAL} isStale={isStale} live={false} />
      }
    >
      {body}
    </WidgetShell>
  );
}
