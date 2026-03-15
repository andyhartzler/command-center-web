'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Heart, Scale, Moon, Footprints, Droplet, Percent,
  Activity, Loader2, RefreshCw, ExternalLink,
} from 'lucide-react';
import type { HealthConfig, WidgetStyle } from '@/types/widget';

interface MeasureData {
  latest: {
    weight: number | null;
    fatRatio: number | null;
    fatMass: number | null;
    fatFreeMass: number | null;
    muscleMass: number | null;
    boneMass: number | null;
    hydration: number | null;
    heartRate: number | null;
    systolic: number | null;
    diastolic: number | null;
    spo2: number | null;
    bodyTemp: number | null;
    skinTemp: number | null;
    pulseWaveVelocity: number | null;
    vo2max: number | null;
    vascularAge: number | null;
    date: string | null;
  };
  history: { date: string; weight: number }[];
}

interface SleepData {
  lastNight: {
    totalSleep: number | null;
    timeInBed: number | null;
    sleepEfficiency: number | null;
    sleepLatency: number | null;
    wakeupLatency: number | null;
    deepSleep: number | null;
    lightSleep: number | null;
    remSleep: number | null;
    awake: number | null;
    remEpisodes: number | null;
    sleepScore: number | null;
    wakeupCount: number | null;
    wakeDuration: number | null;
    outOfBedCount: number | null;
    hrAvg: number | null;
    hrMin: number | null;
    hrMax: number | null;
    rrAvg: number | null;
    rrMin: number | null;
    rrMax: number | null;
    breathingDisturbances: number | null;
    snoring: number | null;
    snoringEpisodes: number | null;
    nightEvents: number | null;
    apneaIndex: number | null;
    date: string;
  } | null;
}

interface ActivityData {
  today: {
    steps: number;
    distance: number;
    calories: number;
    totalCalories: number;
    elevation: number;
    softMinutes: number;
    moderateMinutes: number;
    intenseMinutes: number;
    activeMinutes: number;
    hrAvg: number | null;
    hrMin: number | null;
    hrMax: number | null;
    hrZone0: number;
    hrZone1: number;
    hrZone2: number;
    hrZone3: number;
  } | null;
}

interface WithingsData {
  connected: boolean;
  measures: MeasureData | null;
  sleep: SleepData | null;
  activity: ActivityData | null;
}

interface Props {
  config: HealthConfig;
  style: WidgetStyle;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatMinutes(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '--';
  return `${Math.round(seconds / 60)}m`;
}

function formatNumber(val: number | null | undefined, unit?: string): string {
  if (val === null || val === undefined) return '--';
  return `${val}${unit || ''}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// Mini SVG line chart for weight history
function WeightChart({ history }: { history: { date: string; weight: number }[] }) {
  if (history.length < 2) return null;

  const weights = history.map(h => h.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const w = 280;
  const h = 80;
  const pad = 4;

  const points = history.map((entry, i) => {
    const x = pad + (i / (history.length - 1)) * (w - pad * 2);
    const y = h - pad - ((entry.weight - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 80 }}>
      <polyline
        points={points}
        fill="none"
        stroke="#f472b6"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <text x={w - pad} y={pad + 10} textAnchor="end" className="fill-white/30" fontSize="9">
        {max.toFixed(1)}
      </text>
      <text x={w - pad} y={h - pad} textAnchor="end" className="fill-white/30" fontSize="9">
        {min.toFixed(1)}
      </text>
    </svg>
  );
}

function CompositionBar({ label, value, max, color }: { label: string; value: number | null; max: number; color: string }) {
  const pct = value !== null ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-white/50 w-12 text-right font-mono">
        {value !== null ? `${value}%` : '--'}
      </span>
    </div>
  );
}

function SleepStagesBar({ data }: { data: NonNullable<SleepData['lastNight']> }) {
  const total = (data.deepSleep ?? 0) + (data.lightSleep ?? 0) + (data.remSleep ?? 0) + (data.awake ?? 0);
  if (total === 0) return null;

  const segments = [
    { label: 'Deep', value: data.deepSleep ?? 0, color: '#6366f1' },
    { label: 'Light', value: data.lightSleep ?? 0, color: '#38bdf8' },
    { label: 'REM', value: data.remSleep ?? 0, color: '#a855f7' },
    { label: 'Awake', value: data.awake ?? 0, color: '#ef4444' },
  ];

  return (
    <div className="space-y-1.5">
      <div className="h-3 rounded-full overflow-hidden flex">
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            className="h-full"
          />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[9px] text-white/40">{s.label} {formatDuration(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, dimmed }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  color: string;
  dimmed?: boolean;
}) {
  return (
    <div className={`rounded-lg p-2.5 ${dimmed ? 'bg-white/[0.02]' : 'bg-white/[0.04]'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color: dimmed ? '#ffffff30' : color }}><Icon size={12} /></span>
        <span className="text-[9px] text-white/30 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-base font-semibold ${dimmed ? 'text-white/20' : 'text-white/80'}`}>
        {value}
      </div>
    </div>
  );
}

// Compact metric row
function MetricRow({ label, value, unit, color }: { label: string; value: number | null | undefined; unit?: string; color?: string }) {
  const display = value !== null && value !== undefined ? `${value}${unit || ''}` : '--';
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-white/40">{label}</span>
      <span className="text-[10px] font-mono" style={{ color: color || 'rgba(255,255,255,0.6)' }}>{display}</span>
    </div>
  );
}

// Not connected state
function NotConnected() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
      <Heart size={28} className="text-white/20" />
      <span className="text-xs font-medium text-white/40">Connect Withings</span>
      <button
        onClick={() => window.open('/api/withings/auth', '_blank')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f472b6]/20 text-[#f472b6] text-[11px] font-medium hover:bg-[#f472b6]/30 transition-colors"
      >
        <ExternalLink size={12} />
        Authorize
      </button>
    </div>
  );
}

// Summary mode: 2x3 grid of key metrics
function SummaryView({ data }: { data: WithingsData }) {
  const m = data.measures?.latest;
  const s = data.sleep?.lastNight;
  const a = data.activity?.today;

  return (
    <div className="grid grid-cols-2 gap-2 p-3 h-full content-center">
      <MetricCard icon={Scale} label="Weight" value={formatNumber(m?.weight ?? null, ' lbs')} color="#f472b6" dimmed={!m?.weight} />
      <MetricCard icon={Percent} label="Body Fat" value={formatNumber(m?.fatRatio ?? null, '%')} color="#fb923c" dimmed={!m?.fatRatio} />
      <MetricCard icon={Moon} label="Sleep" value={s?.sleepScore !== null && s?.sleepScore !== undefined ? `${s.sleepScore}` : '--'} color="#6366f1" dimmed={!s?.sleepScore} />
      <MetricCard icon={Footprints} label="Steps" value={a?.steps ? a.steps.toLocaleString() : '--'} color="#22c55e" dimmed={!a?.steps} />
      <MetricCard icon={Heart} label="Heart Rate" value={formatNumber(m?.heartRate ?? null, ' bpm')} color="#ef4444" dimmed={!m?.heartRate} />
      <MetricCard icon={Droplet} label="SpO2" value={formatNumber(m?.spo2 ?? null, '%')} color="#38bdf8" dimmed={!m?.spo2} />
    </div>
  );
}

// Weight mode: current weight, chart, body composition, vitals
function WeightView({ data }: { data: WithingsData }) {
  const m = data.measures;
  if (!m) return <div className="p-4 text-center text-white/30 text-xs">No measurement data</div>;

  const l = m.latest;

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      <div className="text-center">
        <div className="text-3xl font-bold text-white/90">
          {l.weight !== null ? `${l.weight} lbs` : '--'}
        </div>
        {l.date && (
          <div className="text-[10px] text-white/30 mt-0.5">{timeAgo(l.date)}</div>
        )}
      </div>

      <WeightChart history={m.history} />

      <div className="space-y-1.5">
        <CompositionBar label="Body Fat" value={l.fatRatio} max={50} color="#fb923c" />
        <CompositionBar label="Muscle" value={l.muscleMass !== null && l.weight && l.weight > 0 ? Math.round((l.muscleMass / l.weight) * 100) : null} max={100} color="#6366f1" />
        <CompositionBar label="Bone" value={l.boneMass !== null && l.weight && l.weight > 0 ? Math.round((l.boneMass / l.weight) * 100) : null} max={20} color="#94a3b8" />
        <CompositionBar label="Hydration" value={l.hydration} max={100} color="#38bdf8" />
      </div>

    </div>
  );
}

// Sleep mode: comprehensive sleep data
function SleepView({ data }: { data: WithingsData }) {
  const s = data.sleep?.lastNight;
  if (!s) return <div className="p-4 text-center text-white/30 text-xs">No sleep data</div>;

  const scoreColor = (s.sleepScore ?? 0) >= 80 ? '#22c55e' : (s.sleepScore ?? 0) >= 60 ? '#eab308' : '#ef4444';
  const effColor = (s.sleepEfficiency ?? 0) >= 85 ? '#22c55e' : (s.sleepEfficiency ?? 0) >= 75 ? '#eab308' : '#ef4444';

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Score and efficiency header */}
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <div className="text-3xl font-bold" style={{ color: scoreColor }}>
            {s.sleepScore ?? '--'}
          </div>
          <div className="text-[9px] text-white/30">Score</div>
        </div>
        <div className="w-px h-10 bg-white/10" />
        <div className="text-center">
          <div className="text-2xl font-bold" style={{ color: effColor }}>
            {s.sleepEfficiency !== null ? `${Math.round(s.sleepEfficiency)}%` : '--'}
          </div>
          <div className="text-[9px] text-white/30">Efficiency</div>
        </div>
      </div>

      {/* Sleep stages */}
      <SleepStagesBar data={s} />

      {/* Duration metrics */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-white/40">Total Sleep</span>
          <span className="text-[10px] font-mono text-white/60">{formatDuration(s.totalSleep)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-white/40">In Bed</span>
          <span className="text-[10px] font-mono text-white/60">{formatDuration(s.timeInBed)}</span>
        </div>
      </div>

      {/* Timing */}
      <div className="space-y-0.5 pt-1 border-t border-white/5">
        <div className="text-[9px] text-white/20 uppercase tracking-wider mb-1">Timing</div>
        <MetricRow label="Fell asleep in" value={s.sleepLatency !== null ? Math.round(s.sleepLatency / 60) : null} unit=" min" />
        <MetricRow label="Wakeup latency" value={s.wakeupLatency !== null ? Math.round(s.wakeupLatency / 60) : null} unit=" min" />
        <MetricRow label="Wake count" value={s.wakeupCount} unit="x" />
        <MetricRow label="Awake duration" value={s.wakeDuration !== null ? Math.round(s.wakeDuration / 60) : null} unit=" min" color="#ef4444" />
        <MetricRow label="Out of bed" value={s.outOfBedCount} unit="x" />
      </div>

      {/* Heart & Respiratory */}
      <div className="space-y-0.5 pt-1 border-t border-white/5">
        <div className="text-[9px] text-white/20 uppercase tracking-wider mb-1">Heart & Breathing</div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-white/40">Heart Rate</span>
          <span className="text-[10px] font-mono text-white/60">
            {s.hrMin ?? '--'} / <span style={{ color: '#ef4444' }}>{s.hrAvg ?? '--'}</span> / {s.hrMax ?? '--'} bpm
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-white/40">Respiratory</span>
          <span className="text-[10px] font-mono text-white/60">
            {s.rrMin ?? '--'} / {s.rrAvg ?? '--'} / {s.rrMax ?? '--'} br/m
          </span>
        </div>
        {s.breathingDisturbances !== null && (
          <MetricRow label="Breathing dist." value={Math.round(s.breathingDisturbances)} />
        )}
        {s.snoringEpisodes !== null && s.snoringEpisodes > 0 && (
          <MetricRow label="Snoring episodes" value={s.snoringEpisodes} />
        )}
        {s.snoring !== null && s.snoring > 0 && (
          <MetricRow label="Snoring duration" value={Math.round(s.snoring / 60)} unit=" min" />
        )}
        {s.apneaIndex !== null && (
          <MetricRow label="Apnea index" value={Math.round(s.apneaIndex * 10) / 10} />
        )}
      </div>

      {/* REM detail */}
      {s.remEpisodes !== null && (
        <div className="text-[9px] text-white/20 text-center">
          {s.remEpisodes} REM episodes
        </div>
      )}

      <div className="text-[9px] text-white/20 text-center">{s.date}</div>
    </div>
  );
}

// Activity intensity bar
function IntensityBar({ soft, moderate, intense }: { soft: number; moderate: number; intense: number }) {
  const total = soft + moderate + intense;
  if (total === 0) return null;

  const segments = [
    { label: 'Light', value: soft, color: '#94a3b8' },
    { label: 'Moderate', value: moderate, color: '#fb923c' },
    { label: 'Intense', value: intense, color: '#ef4444' },
  ];

  return (
    <div className="space-y-1.5">
      <div className="h-2.5 rounded-full overflow-hidden flex">
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            className="h-full"
          />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[9px] text-white/40">{s.label} {s.value}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// HR Zone bars
function HRZoneBars({ zones }: { zones: [number, number, number, number] }) {
  const max = Math.max(...zones, 1);
  const labels = ['Rest', 'Light', 'Moderate', 'Intense'];
  const colors = ['#94a3b8', '#22c55e', '#fb923c', '#ef4444'];

  return (
    <div className="space-y-1">
      {zones.map((val, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[9px] text-white/30 w-14 shrink-0">{labels[i]}</span>
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(val / max) * 100}%`, backgroundColor: colors[i] }} />
          </div>
          <span className="text-[9px] text-white/40 w-8 text-right font-mono">{val}s</span>
        </div>
      ))}
    </div>
  );
}

// Activity mode: comprehensive activity data
function ActivityView({ data }: { data: WithingsData }) {
  const a = data.activity?.today;
  if (!a) return <div className="p-4 text-center text-white/30 text-xs">No activity data</div>;

  const stepTarget = 10000;
  const stepPct = Math.min((a.steps / stepTarget) * 100, 100);
  const hasHRZones = a.hrZone0 > 0 || a.hrZone1 > 0 || a.hrZone2 > 0 || a.hrZone3 > 0;
  const hasIntensity = a.softMinutes > 0 || a.moderateMinutes > 0 || a.intenseMinutes > 0;

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      {/* Steps */}
      <div className="text-center">
        <div className="text-3xl font-bold text-white/90">{a.steps.toLocaleString()}</div>
        <div className="text-[10px] text-white/30">steps</div>
      </div>

      <div className="space-y-1">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#22c55e] transition-all"
            style={{ width: `${stepPct}%` }}
          />
        </div>
        <div className="text-[9px] text-white/30 text-right">{stepPct.toFixed(0)}% of 10K goal</div>
      </div>

      {/* Core metrics */}
      <div className="space-y-1">
        <MetricRow label="Distance" value={a.distance > 0 ? Math.round(a.distance / 100) / 10 : null} unit=" km" />
        <MetricRow label="Active Calories" value={a.calories > 0 ? a.calories : null} unit=" kcal" color="#fb923c" />
        <MetricRow label="Total Calories" value={a.totalCalories > 0 ? a.totalCalories : null} unit=" kcal" />
        {a.elevation > 0 && <MetricRow label="Elevation" value={a.elevation} unit=" m" />}
      </div>

      {/* Activity intensity */}
      {hasIntensity && (
        <div className="pt-1 border-t border-white/5">
          <div className="text-[9px] text-white/20 uppercase tracking-wider mb-1.5">Activity Intensity</div>
          <IntensityBar soft={a.softMinutes} moderate={a.moderateMinutes} intense={a.intenseMinutes} />
          <div className="text-[10px] text-white/40 text-center mt-1.5">
            <span className="font-mono text-white/60">{a.activeMinutes}</span> active min
          </div>
        </div>
      )}

      {/* Heart rate */}
      {a.hrAvg !== null && (
        <div className="pt-1 border-t border-white/5">
          <div className="text-[9px] text-white/20 uppercase tracking-wider mb-1">Heart Rate</div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white/40">Min / Avg / Max</span>
            <span className="text-[10px] font-mono text-white/60">
              {a.hrMin ?? '--'} / <span style={{ color: '#ef4444' }}>{a.hrAvg}</span> / {a.hrMax ?? '--'} bpm
            </span>
          </div>
        </div>
      )}

      {/* HR Zones */}
      {hasHRZones && (
        <div className="pt-1 border-t border-white/5">
          <div className="text-[9px] text-white/20 uppercase tracking-wider mb-1.5">HR Zones</div>
          <HRZoneBars zones={[a.hrZone0, a.hrZone1, a.hrZone2, a.hrZone3]} />
        </div>
      )}
    </div>
  );
}

export function HealthWidget({ config, style: _style }: Props) {
  const [data, setData] = useState<WithingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/withings?action=all');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.connected === false) {
        setConnected(false);
        return;
      }
      setConnected(true);
      setData(json);
      setError(null);
    } catch (err) {
      console.error('[Health] fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (connected !== true) return;
    const ms = (config.refreshInterval || 300) * 1000;
    intervalRef.current = setInterval(fetchData, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [connected, config.refreshInterval, fetchData]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-white/20" />
      </div>
    );
  }

  if (connected === false) {
    return <NotConnected />;
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
        <Activity size={20} className="text-red-400/60" />
        <span className="text-[10px] text-red-400/60">{error}</span>
        <button
          onClick={fetchData}
          className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-[10px] text-white/40 hover:bg-white/10"
        >
          <RefreshCw size={10} /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  switch (config.displayMode) {
    case 'weight':
      return <WeightView data={data} />;
    case 'sleep':
      return <SleepView data={data} />;
    case 'activity':
      return <ActivityView data={data} />;
    default:
      return <SummaryView data={data} />;
  }
}
