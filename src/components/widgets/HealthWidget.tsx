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

interface Size {
  w: number;
  h: number;
}

// Hook: observe container size
function useContainerSize(): [React.RefObject<HTMLDivElement | null>, Size] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
function WeightChart({ history, height }: { history: { date: string; weight: number }[]; height: number }) {
  if (history.length < 2) return null;

  const weights = history.map(h => h.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const w = 280;
  const h = Math.max(height, 40);
  const pad = 4;

  const points = history.map((entry, i) => {
    const x = pad + (i / (history.length - 1)) * (w - pad * 2);
    const y = h - pad - ((entry.weight - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full flex-shrink" style={{ maxHeight: height }}>
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

function SleepStagesBar({ data, compact }: { data: NonNullable<SleepData['lastNight']>; compact?: boolean }) {
  const total = (data.deepSleep ?? 0) + (data.lightSleep ?? 0) + (data.remSleep ?? 0) + (data.awake ?? 0);
  if (total === 0) return null;

  const segments = [
    { label: 'Deep', value: data.deepSleep ?? 0, color: '#6366f1' },
    { label: 'Light', value: data.lightSleep ?? 0, color: '#38bdf8' },
    { label: 'REM', value: data.remSleep ?? 0, color: '#a855f7' },
    { label: 'Awake', value: data.awake ?? 0, color: '#ef4444' },
  ];

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className={`${compact ? 'h-2' : 'h-3'} rounded-full overflow-hidden flex`}>
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

function MetricCard({ icon: Icon, label, value, color, dimmed, compact }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  color: string;
  dimmed?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-lg ${compact ? 'p-1.5' : 'p-2.5'} ${dimmed ? 'bg-white/[0.02]' : 'bg-white/[0.04]'}`}>
      <div className={`flex items-center gap-1 ${compact ? 'mb-0.5' : 'mb-1'}`}>
        <span style={{ color: dimmed ? '#ffffff30' : color }}><Icon size={compact ? 10 : 12} /></span>
        <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} text-white/30 uppercase tracking-wider`}>{label}</span>
      </div>
      <div className={`${compact ? 'text-sm' : 'text-base'} font-semibold ${dimmed ? 'text-white/20' : 'text-white/80'}`}>
        {value}
      </div>
    </div>
  );
}

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

// Summary mode: 2x3 grid that fills the container
function SummaryView({ data, size }: { data: WithingsData; size: Size }) {
  const m = data.measures?.latest;
  const s = data.sleep?.lastNight;
  const a = data.activity?.today;
  const compact = size.h < 220;

  return (
    <div className={`grid grid-cols-2 h-full content-stretch p-2 ${compact ? 'gap-1' : 'gap-2'}`}
      style={{ gridTemplateRows: 'repeat(3, 1fr)' }}>
      <MetricCard icon={Scale} label="Weight" value={formatNumber(m?.weight ?? null, ' lbs')} color="#f472b6" dimmed={!m?.weight} compact={compact} />
      <MetricCard icon={Percent} label="Body Fat" value={formatNumber(m?.fatRatio ?? null, '%')} color="#fb923c" dimmed={!m?.fatRatio} compact={compact} />
      <MetricCard icon={Moon} label="Sleep" value={s?.sleepScore !== null && s?.sleepScore !== undefined ? `${s.sleepScore}` : '--'} color="#6366f1" dimmed={!s?.sleepScore} compact={compact} />
      <MetricCard icon={Footprints} label="Steps" value={a?.steps ? a.steps.toLocaleString() : '--'} color="#22c55e" dimmed={!a?.steps} compact={compact} />
      <MetricCard icon={Heart} label="Heart Rate" value={formatNumber(m?.heartRate ?? null, ' bpm')} color="#ef4444" dimmed={!m?.heartRate} compact={compact} />
      <MetricCard icon={Droplet} label="SpO2" value={formatNumber(m?.spo2 ?? null, '%')} color="#38bdf8" dimmed={!m?.spo2} compact={compact} />
    </div>
  );
}

// Weight mode: weight + chart + composition, all flex to fill
function WeightView({ data, size }: { data: WithingsData; size: Size }) {
  const m = data.measures;
  if (!m) return <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">No measurement data</div>;

  const l = m.latest;
  const compact = size.h < 250;
  const chartHeight = Math.max(Math.min(size.h * 0.25, 100), 40);

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      <div className="text-center shrink-0">
        <div className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold text-white/90`}>
          {l.weight !== null ? `${l.weight} lbs` : '--'}
        </div>
        {l.date && (
          <div className="text-[10px] text-white/30">{timeAgo(l.date)}</div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center gap-2">
        <WeightChart history={m.history} height={chartHeight} />

        <div className="space-y-1.5">
          <CompositionBar label="Body Fat" value={l.fatRatio} max={50} color="#fb923c" />
          <CompositionBar label="Muscle" value={l.muscleMass !== null && l.weight && l.weight > 0 ? Math.round((l.muscleMass / l.weight) * 100) : null} max={100} color="#6366f1" />
          <CompositionBar label="Bone" value={l.boneMass !== null && l.weight && l.weight > 0 ? Math.round((l.boneMass / l.weight) * 100) : null} max={20} color="#94a3b8" />
          <CompositionBar label="Hydration" value={l.hydration} max={100} color="#38bdf8" />
        </div>
      </div>
    </div>
  );
}

// Sleep score arc gauge
function SleepScoreArc({ score, radius }: { score: number | null; radius: number }) {
  const val = score ?? 0;
  const strokeWidth = Math.max(radius * 0.14, 4);
  const r = radius - strokeWidth / 2;
  const cx = radius;
  const cy = radius;

  // Semicircular arc: left (cx-r, cy) to right (cx+r, cy), curving upward
  const trackD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Fill arc: sweep val% of the semicircle from left
  const sweepRad = (Math.min(val, 100) / 100) * Math.PI;
  const endAngle = Math.PI - sweepRad; // math angle from right horizontal
  const endX = cx + r * Math.cos(endAngle);
  const endY = cy - r * Math.sin(endAngle);
  // Always large-arc-flag=0: max sweep is 180deg (semicircle), never exceeds 180deg of ellipse
  const fillD = val > 0
    ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`
    : '';

  // Color: red < 50, orange 50-65, yellow 65-80, green 80+
  const color = val >= 80 ? '#22c55e' : val >= 65 ? '#eab308' : val >= 50 ? '#fb923c' : '#ef4444';
  const glowColor = val >= 80 ? '#22c55e40' : val >= 65 ? '#eab30840' : val >= 50 ? '#fb923c40' : '#ef444440';

  const fontSize = Math.max(radius * 0.55, 14);
  const labelSize = Math.max(radius * 0.18, 8);
  const labelPad = labelSize + 6;
  const svgH = radius + strokeWidth / 2 + labelPad;

  return (
    <svg width={radius * 2} height={svgH} viewBox={`0 0 ${radius * 2} ${svgH}`}>
      {/* Track */}
      <path d={trackD} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} strokeLinecap="round" />
      {/* Glow */}
      {fillD && <path d={fillD} fill="none" stroke={glowColor} strokeWidth={strokeWidth + 4} strokeLinecap="round" />}
      {/* Fill */}
      {fillD && <path d={fillD} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />}
      {/* Score text */}
      <text x={cx} y={cy - radius * 0.08} textAnchor="middle" dominantBaseline="central"
        fill={score !== null ? color : 'rgba(255,255,255,0.2)'}
        fontSize={fontSize} fontWeight="700" fontFamily="system-ui, sans-serif">
        {score ?? '--'}
      </text>
      {/* Label */}
      <text x={cx} y={cy + labelSize + 2} textAnchor="middle"
        fill="rgba(255,255,255,0.25)" fontSize={labelSize} fontFamily="system-ui, sans-serif">
        Sleep Score
      </text>
    </svg>
  );
}

// Sleep stage vertical pill bars
function SleepStagePills({ data, height }: { data: NonNullable<SleepData['lastNight']>; height: number }) {
  const stages = [
    { label: 'Deep', value: data.deepSleep ?? 0, color: '#6366f1' },
    { label: 'Light', value: data.lightSleep ?? 0, color: '#38bdf8' },
    { label: 'REM', value: data.remSleep ?? 0, color: '#a855f7' },
    { label: 'Awake', value: data.awake ?? 0, color: '#ef4444' },
  ];

  const maxVal = Math.max(...stages.map(s => s.value), 1);
  const barHeight = Math.max(height - 28, 16);

  return (
    <div className="flex items-end justify-center gap-3">
      {stages.map(s => {
        const pct = (s.value / maxVal) * 100;
        return (
          <div key={s.label} className="flex flex-col items-center gap-1">
            <div className="relative" style={{ height: barHeight, width: 20 }}>
              <div className="absolute inset-0 rounded-full bg-white/[0.04]" />
              <div
                className="absolute bottom-0 left-0 right-0 rounded-full transition-all"
                style={{ height: `${Math.max(pct, 8)}%`, backgroundColor: s.color, opacity: s.value > 0 ? 1 : 0.2 }}
              />
            </div>
            <span className="text-[8px] text-white/30 leading-none">{s.label}</span>
            <span className="text-[9px] font-mono text-white/50 leading-none">{formatDuration(s.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// Vital range bar (shows min/avg/max on a range)
function VitalRange({ label, min, avg, max, unit, color }: {
  label: string; min: number | null; avg: number | null; max: number | null; unit: string; color: string;
}) {
  if (min === null && avg === null && max === null) return null;
  const lo = min ?? avg ?? 0;
  const hi = max ?? avg ?? 0;
  const mid = avg ?? 0;
  const rangeMin = Math.floor(lo * 0.85);
  const rangeMax = Math.ceil(hi * 1.15) || 1;
  const span = rangeMax - rangeMin || 1;

  const loP = ((lo - rangeMin) / span) * 100;
  const hiP = ((hi - rangeMin) / span) * 100;
  const midP = ((mid - rangeMin) / span) * 100;

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center">
        <span className="text-[9px] text-white/30">{label}</span>
        <span className="text-[9px] font-mono text-white/40">{lo} / <span style={{ color }}>{mid}</span> / {hi} {unit}</span>
      </div>
      <div className="h-1.5 bg-white/[0.04] rounded-full relative">
        {/* Range bar */}
        <div className="absolute top-0 h-full rounded-full" style={{
          left: `${loP}%`,
          width: `${Math.max(hiP - loP, 2)}%`,
          backgroundColor: color,
          opacity: 0.25,
        }} />
        {/* Avg dot */}
        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-black/30" style={{
          left: `${midP}%`,
          marginLeft: -4,
          backgroundColor: color,
        }} />
      </div>
    </div>
  );
}

// Sleep metric mini card
function SleepStat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-semibold font-mono" style={{ color: color || 'rgba(255,255,255,0.7)' }}>
        {value}
      </div>
      <div className="text-[8px] text-white/25 leading-tight">{label}</div>
      {sub && <div className="text-[7px] text-white/15 leading-tight">{sub}</div>}
    </div>
  );
}

// Sleep mode: redesigned from scratch
function SleepView({ data, size }: { data: WithingsData; size: Size }) {
  const s = data.sleep?.lastNight;
  if (!s) return <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">No sleep data</div>;

  // Responsive sizing
  const compact = size.h < 220;
  const medium = size.h >= 280;
  const tall = size.h >= 380;
  const wide = size.w >= 280;

  // Arc gauge size scales with container
  const arcRadius = compact ? Math.min(size.w * 0.2, 40) : Math.min(size.w * 0.25, 60);

  // Withings may return efficiency as 0-1 decimal or 0-100 percentage
  const rawEff = s.sleepEfficiency ?? 0;
  const efficiency = rawEff > 0 && rawEff <= 1 ? Math.round(rawEff * 100) : Math.round(rawEff);
  const effColor = efficiency >= 85 ? '#22c55e' : efficiency >= 75 ? '#eab308' : '#ef4444';
  const pillHeight = compact ? 50 : medium ? 70 : 55;

  return (
    <div className="flex flex-col h-full p-2.5 gap-1.5 overflow-hidden">

      {/* Row 1: Score arc + total sleep + stage pills */}
      <div className="flex items-center shrink-0" style={{ minHeight: compact ? 60 : 80 }}>
        {/* Score arc */}
        <div className="flex-shrink-0 flex items-center justify-center" style={{ width: arcRadius * 2 + 8 }}>
          <SleepScoreArc score={s.sleepScore} radius={arcRadius} />
        </div>

        {/* Stage pills fill remaining width */}
        <div className="flex-1 min-w-0">
          <SleepStagePills data={s} height={pillHeight} />
        </div>
      </div>

      {/* Row 2: Key stats row */}
      <div className={`flex justify-evenly shrink-0 py-1 border-y border-white/[0.04] ${compact ? 'gap-1' : 'gap-2'}`}>
        <SleepStat label="Total Sleep" value={formatDuration(s.totalSleep)} />
        <SleepStat label="In Bed" value={formatDuration(s.timeInBed)} />
        <SleepStat label="Efficiency" value={s.sleepEfficiency !== null ? `${efficiency}%` : '--'} color={effColor} />
        {wide && <SleepStat label="Asleep In" value={s.sleepLatency !== null ? `${Math.round(s.sleepLatency / 60)}m` : '--'} />}
      </div>

      {/* Row 3: Flexible detail area */}
      <div className="flex-1 min-h-0 flex flex-col justify-evenly gap-0.5">

        {/* Vitals: HR and RR range bars */}
        <div className="space-y-1">
          <VitalRange label="Heart Rate" min={s.hrMin} avg={s.hrAvg} max={s.hrMax} unit="bpm" color="#ef4444" />
          <VitalRange label="Respiratory" min={s.rrMin} avg={s.rrAvg} max={s.rrMax} unit="br/m" color="#38bdf8" />
        </div>

        {/* Sleep quality metrics - 2 col grid */}
        {medium && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <MetricRow label="Wakeup latency" value={s.wakeupLatency !== null ? Math.round(s.wakeupLatency / 60) : null} unit="m" />
            <MetricRow label="Woke up" value={s.wakeupCount} unit="x" />
            <MetricRow label="Awake time" value={s.wakeDuration !== null ? Math.round(s.wakeDuration / 60) : null} unit="m" color="#ef4444" />
            <MetricRow label="Out of bed" value={s.outOfBedCount} unit="x" />
            {s.remEpisodes !== null && <MetricRow label="REM cycles" value={s.remEpisodes} />}
          </div>
        )}

        {/* Breathing & snoring - only when tall */}
        {tall && (s.breathingDisturbances !== null || (s.snoringEpisodes !== null && s.snoringEpisodes > 0) || s.apneaIndex !== null) && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-0.5 border-t border-white/[0.04]">
            {s.breathingDisturbances !== null && <MetricRow label="Breathing dist." value={Math.round(s.breathingDisturbances)} />}
            {s.snoringEpisodes !== null && s.snoringEpisodes > 0 && <MetricRow label="Snoring" value={s.snoringEpisodes} unit=" episodes" />}
            {s.snoring !== null && s.snoring > 0 && <MetricRow label="Snore duration" value={Math.round(s.snoring / 60)} unit="m" />}
            {s.apneaIndex !== null && <MetricRow label="Apnea index" value={Math.round(s.apneaIndex * 10) / 10} />}
          </div>
        )}
      </div>

      {/* Date footer */}
      <div className="text-[8px] text-white/15 text-center shrink-0">{s.date}</div>
    </div>
  );
}

// Activity intensity bar
function IntensityBar({ soft, moderate, intense, compact }: { soft: number; moderate: number; intense: number; compact?: boolean }) {
  const total = soft + moderate + intense;
  if (total === 0) return null;

  const segments = [
    { label: 'Light', value: soft, color: '#94a3b8' },
    { label: 'Moderate', value: moderate, color: '#fb923c' },
    { label: 'Intense', value: intense, color: '#ef4444' },
  ];

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className={`${compact ? 'h-2' : 'h-2.5'} rounded-full overflow-hidden flex`}>
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

// Activity mode: dynamically fits all content
function ActivityView({ data, size }: { data: WithingsData; size: Size }) {
  const a = data.activity?.today;
  if (!a) return <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">No activity data</div>;

  const stepTarget = 10000;
  const stepPct = Math.min((a.steps / stepTarget) * 100, 100);
  const hasHRZones = a.hrZone0 > 0 || a.hrZone1 > 0 || a.hrZone2 > 0 || a.hrZone3 > 0;
  const hasIntensity = a.softMinutes > 0 || a.moderateMinutes > 0 || a.intenseMinutes > 0;

  const tall = size.h >= 350;
  const compact = size.h < 200;

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      {/* Steps header */}
      <div className="text-center shrink-0">
        <div className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold text-white/90`}>{a.steps.toLocaleString()}</div>
        <div className="text-[10px] text-white/30">steps</div>
      </div>

      {/* Progress bar */}
      <div className="shrink-0 space-y-1">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#22c55e] transition-all"
            style={{ width: `${stepPct}%` }}
          />
        </div>
        <div className="text-[9px] text-white/30 text-right">{stepPct.toFixed(0)}% of 10K goal</div>
      </div>

      {/* Flexible content */}
      <div className="flex-1 min-h-0 flex flex-col justify-evenly">
        {/* Core metrics */}
        <div className="space-y-0.5">
          <MetricRow label="Distance" value={a.distance > 0 ? Math.round(a.distance / 100) / 10 : null} unit=" km" />
          <MetricRow label="Active Calories" value={a.calories > 0 ? a.calories : null} unit=" kcal" color="#fb923c" />
          {!compact && <MetricRow label="Total Calories" value={a.totalCalories > 0 ? a.totalCalories : null} unit=" kcal" />}
          {a.elevation > 0 && <MetricRow label="Elevation" value={a.elevation} unit=" m" />}
        </div>

        {/* Activity intensity */}
        {hasIntensity && (
          <div>
            <IntensityBar soft={a.softMinutes} moderate={a.moderateMinutes} intense={a.intenseMinutes} compact={compact} />
            {!compact && (
              <div className="text-[10px] text-white/40 text-center mt-1">
                <span className="font-mono text-white/60">{a.activeMinutes}</span> active min
              </div>
            )}
          </div>
        )}

        {/* Heart rate */}
        {a.hrAvg !== null && !compact && (
          <div className="space-y-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-white/40">HR</span>
              <span className="text-[10px] font-mono text-white/60">
                {a.hrMin ?? '--'} / <span style={{ color: '#ef4444' }}>{a.hrAvg}</span> / {a.hrMax ?? '--'} bpm
              </span>
            </div>
          </div>
        )}

        {/* HR Zones - only when tall */}
        {hasHRZones && tall && (
          <div>
            <div className="text-[9px] text-white/20 uppercase tracking-wider mb-1">HR Zones</div>
            <HRZoneBars zones={[a.hrZone0, a.hrZone1, a.hrZone2, a.hrZone3]} />
          </div>
        )}
      </div>
    </div>
  );
}

export function HealthWidget({ config, style: _style }: Props) {
  const [containerRef, size] = useContainerSize();
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

  let content: React.ReactNode = null;

  if (loading) {
    content = (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-white/20" />
      </div>
    );
  } else if (connected === false) {
    content = <NotConnected />;
  } else if (error) {
    content = (
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
  } else if (data) {
    switch (config.displayMode) {
      case 'weight':
        content = <WeightView data={data} size={size} />;
        break;
      case 'sleep':
        content = <SleepView data={data} size={size} />;
        break;
      case 'activity':
        content = <ActivityView data={data} size={size} />;
        break;
      default:
        content = <SummaryView data={data} size={size} />;
    }
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden">
      {content}
    </div>
  );
}
