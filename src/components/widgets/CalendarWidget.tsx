'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Clock, MapPin, ChevronRight } from 'lucide-react';
import { type WidgetStyle } from '@/types/widget';

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

interface CalendarConfig {
  feeds?: { name: string; url: string }[];
}

interface CalendarWidgetProps {
  config: CalendarConfig;
  style: WidgetStyle;
}

function formatEventTime(start: string, end: string, allDay: boolean): string {
  if (allDay) return 'All Day';
  try {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${fmt(s)} - ${fmt(e)}`;
  } catch {
    return '';
  }
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();
}

function groupLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function CalendarWidget({ config }: CalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const feeds = (config as CalendarConfig).feeds || [];
  const hasFeeds = feeds.length > 0;

  const fetchEvents = useCallback(async () => {
    if (!hasFeeds) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/calendar?feeds=${encodeURIComponent(JSON.stringify(feeds))}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('[Calendar] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [hasFeeds, feeds]);

  useEffect(() => {
    fetchEvents();
    if (hasFeeds) {
      const interval = setInterval(fetchEvents, 300_000);
      return () => clearInterval(interval);
    }
  }, [fetchEvents, hasFeeds]);

  // Group events by day
  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const date = new Date(ev.start);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (!hasFeeds) {
    return (
      <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#0c1220] to-[#101828] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <Calendar size={14} className="text-red-400" />
          <span className="text-[11px] font-semibold text-white/90 tracking-wide">Calendar</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <Calendar size={28} className="text-white/15" />
          <div className="text-center">
            <p className="text-[11px] text-white/40 mb-1">No calendars connected</p>
            <p className="text-[9px] text-white/25 max-w-[180px] leading-relaxed">
              Add calendar feed URLs in the widget settings. Supports iCloud, Google Calendar, and Outlook ICS feeds.
            </p>
          </div>
          <div className="mt-2 space-y-1.5 w-full max-w-[200px]">
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <div className="w-3 h-3 rounded-sm bg-blue-500/30" />
              <span className="text-[9px] text-white/30">iCloud Calendar</span>
              <ChevronRight size={8} className="text-white/15 ml-auto" />
            </div>
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <div className="w-3 h-3 rounded-sm bg-green-500/30" />
              <span className="text-[9px] text-white/30">Google Calendar</span>
              <ChevronRight size={8} className="text-white/15 ml-auto" />
            </div>
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
              <div className="w-3 h-3 rounded-sm bg-violet-500/30" />
              <span className="text-[9px] text-white/30">Outlook Calendar</span>
              <ChevronRight size={8} className="text-white/15 ml-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-gradient-to-br from-[#0c1220] to-[#101828] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 shrink-0">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-red-400" />
          <span className="text-[11px] font-semibold text-white/90 tracking-wide">Calendar</span>
        </div>
        <span className="text-[9px] text-white/30">{todayStr}</span>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-4 h-4 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <Calendar size={20} className="text-white/15" />
              <span className="text-[10px] text-white/30">No upcoming events</span>
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([key, dayEvents]) => {
            const date = new Date(dayEvents[0].start);
            const label = groupLabel(date);
            const isCurrentDay = isToday(date);

            return (
              <div key={key} className="px-3">
                <div className={`text-[9px] font-bold uppercase tracking-wider pt-2 pb-1 ${isCurrentDay ? 'text-red-400/70' : 'text-white/25'}`}>
                  {label}
                </div>
                {dayEvents.map((event, i) => (
                  <div
                    key={event.id}
                    className={`flex items-start gap-2 py-1.5 ${i !== dayEvents.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                  >
                    <div className="w-0.5 h-full min-h-[24px] rounded-full shrink-0 mt-0.5" style={{ backgroundColor: event.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-white/85 leading-tight truncate">
                        {event.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          <Clock size={8} className="text-white/25" />
                          <span className="text-[9px] text-white/35">
                            {formatEventTime(event.start, event.end, event.allDay)}
                          </span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-0.5">
                            <MapPin size={7} className="text-white/20" />
                            <span className="text-[8px] text-white/25 truncate max-w-[100px]">
                              {event.location}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-[8px] text-white/15">{event.calendar}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
