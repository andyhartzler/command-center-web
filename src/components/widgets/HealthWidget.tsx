'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Heart, Scale, Moon, Footprints, Droplet, Percent,
  ExternalLink, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import type { HealthConfig, WidgetStyle } from '@/types/widget';
import { usePolledData } from '@/hooks/usePolledData';
import { WidgetShell, Freshness } from './WidgetShell';
import { ArcGauge } from './gauges/ArcGauge';
import { TickingNumber } from '@/components/motion/TickingNumber';

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

type Trend = 'up' | 'down' | 'flat' | null;

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

function formatTickDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Weight trend vs the previous measurement in the history series */
function weightTrend(history: { date: string; weight: number }[] | undefined): Trend {
  if (!history || history.length < 2) return null;
  const delta = history[history.length - 1].weight - history[history.length - 2].weight;
  if (Math.abs(delta) < 0.3) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

// SVG line chart for weight history; measures its own container so the
// viewBox matches real pixels (no fixed-width distortion).
function WeightChart({ history }: { history: { date: string; weight: number }[] }) {
  const [ref, size] = useContainerSize();

  const w = size.w;
  const h = size.h;
  const ready = history.length >= 2 && w > 40 && h > 36;

  let svg: React.ReactNode = null;
  if (ready) {
    const weights = history.map(e => e.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;

    const padL = 4;
    const padR = 4;
    const padT = 6;
    const padB = 18;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const points = history
      .map((entry, i) => {
        const x = padL + (i / (history.length - 1)) * plotW;
        const y = padT + (1 - (entry.weight - min) / range) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    svg = (
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block" aria-hidden>
        {/* min/max gridlines */}
        <line
          x1={padL} x2={w - padR} y1={padT} y2={padT}
          stroke="var(--color-text-3)" strokeWidth={1} strokeDasharray="3 4" opacity={0.35}
        />
        <line
          x1={padL} x2={w - padR} y1={padT + plotH} y2={padT + plotH}
          stroke="var(--color-text-3)" strokeWidth={1} strokeDasharray="3 4" opacity={0.35}
        />
        <text
          x={w - padR} y={padT + 13} textAnchor="end"
          fontSize={12} fill="var(--color-text-3)" fontFamily="var(--font-mono)"
        >
          {max.toFixed(1)}
        </text>
        <text
          x={w - padR} y={padT + plotH - 4} textAnchor="end"
          fontSize={12} fill="var(--color-text-3)" fontFamily="var(--font-mono)"
        >
          {min.toFixed(1)}
        </text>
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-accent-300)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* date ticks */}
        <text
          x={padL} y={h - 4} textAnchor="start"
          fontSize={12} fill="var(--color-text-3)" fontFamily="var(--font-mono)"
        >
          {formatTickDate(history[0].date)}
        </text>
        <text
          x={w - padR} y={h - 4} textAnchor="end"
          fontSize={12} fill="var(--color-text-3)" fontFamily="var(--font-mono)"
        >
          {formatTickDate(history[history.length - 1].date)}
        </text>
      </svg>
    );
  }

  return (
    <div ref={ref} className="w-full h-full min-h-[48px] overflow-hidden">
      {svg}
    </div>
  );
}

function CompositionBar({ label, value, max, color }: { label: string; value: number | null; max: number; color: string }) {
  const pct = value !== null ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] w-20 shrink-0" style={{ color: 'var(--color-text-3)' }}>{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-[12px] w-12 text-right" style={{ color: 'var(--color-text-2)' }}>
        {value !== null ? `${value}%` : '--'}
      </span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, dimmed, trend = null }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  color: string;
  dimmed?: boolean;
  trend?: Trend;
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : trend === 'flat' ? Minus : null;
  return (
    <div className={`rounded-[var(--radius-inner)] p-2 flex flex-col justify-center gap-1 min-w-0 ${dimmed ? 'bg-white/[0.02]' : 'bg-white/[0.04]'}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="shrink-0 flex items-center" style={{ color: dimmed ? 'var(--color-text-3)' : color }}>
          <Icon size={12} />
        </span>
        <span
          className="text-[12px] uppercase truncate leading-none"
          style={{ color: 'var(--color-text-3)', letterSpacing: 'var(--tracking-caps)' }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className="font-mono text-[15px] font-medium leading-none truncate"
          style={{ color: dimmed ? 'var(--color-text-3)' : 'var(--color-text-1)' }}
        >
          {value}
        </span>
        {TrendIcon && (
          <span className="shrink-0 self-center flex items-center" style={{ color: 'var(--color-text-3)' }} aria-hidden>
            <TrendIcon size={12} />
          </span>
        )}
      </div>
    </div>
  );
}

function MetricRow({ label, value, unit, color }: { label: string; value: number | null | undefined; unit?: string; color?: string }) {
  const display = value !== null && value !== undefined ? `${value}${unit || ''}` : '--';
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>{label}</span>
      <span className="font-mono text-[12px]" style={{ color: color || 'var(--color-text-2)' }}>{display}</span>
    </div>
  );
}

// Not connected state
function NotConnected() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
      <Heart size={28} style={{ color: 'var(--color-text-3)' }} />
      <span className="text-[13px]" style={{ color: 'var(--color-text-2)' }}>Withings is not connected</span>
      <button
        onClick={() => window.open('/api/withings/auth', '_blank')}
        className="glass-chip flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
        style={{ color: 'var(--color-accent-300)' }}
      >
        <ExternalLink size={12} />
        Authorize
      </button>
    </div>
  );
}

// Summary mode: 2x3 grid that fills the container
function SummaryView({ data }: { data: WithingsData }) {
  const m = data.measures?.latest;
  const s = data.sleep?.lastNight;
  const a = data.activity?.today;
  // Trend arrows are shown only where the payload carries a previous period;
  // today that is the weight history series.
  const wTrend = weightTrend(data.measures?.history);

  return (
    <div className="grid grid-cols-2 h-full content-stretch px-3 pb-2.5 pt-0.5 gap-1.5" style={{ gridTemplateRows: 'repeat(3, 1fr)' }}>
      <MetricCard icon={Scale} label="Weight" value={formatNumber(m?.weight ?? null, ' lbs')} color="var(--color-accent-300)" dimmed={!m?.weight} trend={wTrend} />
      <MetricCard icon={Percent} label="Body Fat" value={formatNumber(m?.fatRatio ?? null, '%')} color="var(--color-warn)" dimmed={!m?.fatRatio} />
      <MetricCard icon={Moon} label="Sleep" value={s?.sleepScore !== null && s?.sleepScore !== undefined ? `${s.sleepScore}` : '--'} color="var(--color-accent-500)" dimmed={!s?.sleepScore} />
      <MetricCard icon={Footprints} label="Steps" value={a?.steps ? a.steps.toLocaleString() : '--'} color="var(--color-ok)" dimmed={!a?.steps} />
      <MetricCard icon={Heart} label="Heart Rate" value={formatNumber(m?.heartRate ?? null, ' bpm')} color="var(--color-critical)" dimmed={!m?.heartRate} />
      <MetricCard icon={Droplet} label="SpO2" value={formatNumber(m?.spo2 ?? null, '%')} color="var(--color-info)" dimmed={!m?.spo2} />
    </div>
  );
}

// Weight mode: hero + measured chart + composition
function WeightView({ data }: { data: WithingsData }) {
  const m = data.measures;
  if (!m) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[12px]" style={{ color: 'var(--color-text-3)' }}>
        No measurement data
      </div>
    );
  }

  const l = m.latest;

  return (
    <div className="flex flex-col h-full px-3 pb-2.5 gap-2">
      <div className="text-center shrink-0">
        <div className="flex items-baseline justify-center gap-1.5">
          {l.weight !== null ? (
            <>
              <TickingNumber value={l.weight} format={v => v.toFixed(1)} className="type-value" />
              <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>lbs</span>
            </>
          ) : (
            <span className="type-value" style={{ color: 'var(--color-text-3)' }}>--</span>
          )}
        </div>
        {l.date && (
          <div className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>{timeAgo(l.date)}</div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <WeightChart history={m.history} />
      </div>

      <div className="space-y-1.5 shrink-0">
        <CompositionBar label="Body Fat" value={l.fatRatio} max={50} color="var(--color-warn)" />
        <CompositionBar label="Muscle" value={l.muscleMass !== null && l.weight && l.weight > 0 ? Math.round((l.muscleMass / l.weight) * 100) : null} max={100} color="var(--color-accent-400)" />
        <CompositionBar label="Bone" value={l.boneMass !== null && l.weight && l.weight > 0 ? Math.round((l.boneMass / l.weight) * 100) : null} max={20} color="var(--color-text-3)" />
        <CompositionBar label="Hydration" value={l.hydration} max={100} color="var(--color-info)" />
      </div>
    </div>
  );
}

const SLEEP_STAGES = [
  { key: 'deepSleep', label: 'Deep', color: 'var(--color-accent-500)' },
  { key: 'lightSleep', label: 'Light', color: 'var(--color-info)' },
  { key: 'remSleep', label: 'REM', color: 'var(--color-accent-300)' },
  { key: 'awake', label: 'Awake', color: 'var(--color-critical)' },
] as const;

// One vertical stage bar; grows from the baseline on mount with a stagger
function StageBar({ label, value, color, maxVal, barHeight, delay }: {
  label: string;
  value: number;
  color: string;
  maxVal: number;
  barHeight: number;
  delay: number;
}) {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = fillRef.current;
    if (!el || typeof el.animate !== 'function') return;
    const anim = el.animate(
      [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
      { duration: 450, delay, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
    );
    return () => anim.cancel();
  }, [delay]);

  const pct = (value / maxVal) * 100;

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div className="relative" style={{ height: barHeight, width: 20 }}>
        <div className="absolute inset-0 rounded-full bg-white/[0.04]" />
        <div
          ref={fillRef}
          className="absolute bottom-0 left-0 right-0 rounded-full"
          style={{
            height: `${Math.max(pct, 8)}%`,
            backgroundColor: color,
            opacity: value > 0 ? 1 : 0.2,
            transformOrigin: 'bottom',
          }}
        />
      </div>
      <span className="text-[12px] leading-none" style={{ color: 'var(--color-text-3)' }}>{label}</span>
      <span className="font-mono text-[12px] leading-none" style={{ color: 'var(--color-text-2)' }}>{formatDuration(value)}</span>
    </div>
  );
}

function SleepStageBars({ data, height }: { data: NonNullable<SleepData['lastNight']>; height: number }) {
  const values = SLEEP_STAGES.map(s => data[s.key] ?? 0);
  const maxVal = Math.max(...values, 1);
  const barHeight = Math.max(height - 34, 16);

  return (
    <div className="flex items-end justify-center gap-3">
      {SLEEP_STAGES.map((s, i) => (
        <StageBar
          key={s.label}
          label={s.label}
          value={data[s.key] ?? 0}
          color={s.color}
          maxVal={maxVal}
          barHeight={barHeight}
          delay={i * 60}
        />
      ))}
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
      <div className="flex justify-between items-center gap-2">
        <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>{label}</span>
        <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-3)' }}>
          {lo} / <span style={{ color }}>{mid}</span> / {hi} {unit}
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.04] rounded-full relative">
        <div className="absolute top-0 h-full rounded-full" style={{
          left: `${loP}%`,
          width: `${Math.max(hiP - loP, 2)}%`,
          backgroundColor: color,
          opacity: 0.25,
        }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-black/30" style={{
          left: `${midP}%`,
          marginLeft: -4,
          backgroundColor: color,
        }} />
      </div>
    </div>
  );
}

// Sleep metric mini stat
function SleepStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center min-w-0">
      <div className="font-mono text-[13px] font-medium" style={{ color: color || 'var(--color-text-1)' }}>
        {value}
      </div>
      <div className="text-[12px] leading-tight" style={{ color: 'var(--color-text-3)' }}>{label}</div>
    </div>
  );
}

// Sleep mode
function SleepView({ data, size }: { data: WithingsData; size: Size }) {
  const s = data.sleep?.lastNight;
  if (!s) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[12px]" style={{ color: 'var(--color-text-3)' }}>
        No sleep data
      </div>
    );
  }

  const compact = size.h < 220;
  const medium = size.h >= 280;
  const tall = size.h >= 380;
  const wide = size.w >= 280;

  const arcSize = compact ? Math.min(size.w * 0.36, 84) : Math.min(size.w * 0.42, 116);
  const score = s.sleepScore;
  const scoreColor = score === null
    ? 'var(--color-text-3)'
    : score >= 80
      ? 'var(--color-ok)'
      : score >= 60
        ? 'var(--color-warn)'
        : 'var(--color-critical)';

  // Withings may return efficiency as 0-1 decimal or 0-100 percentage
  const rawEff = s.sleepEfficiency ?? 0;
  const efficiency = rawEff > 0 && rawEff <= 1 ? Math.round(rawEff * 100) : Math.round(rawEff);
  const effColor = efficiency >= 85 ? 'var(--color-ok)' : efficiency >= 75 ? 'var(--color-warn)' : 'var(--color-critical)';

  return (
    <div className="flex flex-col h-full px-2.5 pb-2 gap-1.5 overflow-hidden">

      {/* Row 1: score gauge + stage bars */}
      <div className="flex items-end shrink-0" style={{ minHeight: compact ? 74 : 104 }}>
        <div className="shrink-0" style={{ width: arcSize, height: arcSize }}>
          {score !== null ? (
            <ArcGauge
              value={score}
              min={0}
              max={100}
              color={scoreColor}
              label="Score"
              format={v => Math.round(v).toString()}
              valueClassName="font-mono text-[22px] font-medium"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
              <span className="font-mono text-[22px]" style={{ color: 'var(--color-text-3)' }}>--</span>
              <span className="type-label">Score</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 pb-0.5">
          <SleepStageBars data={s} height={compact ? 64 : medium ? 92 : 76} />
        </div>
      </div>

      {/* Row 2: key stats */}
      <div className={`flex justify-evenly shrink-0 py-1 border-y border-white/[0.04] ${compact ? 'gap-1' : 'gap-2'}`}>
        <SleepStat label="Total sleep" value={formatDuration(s.totalSleep)} />
        <SleepStat label="In bed" value={formatDuration(s.timeInBed)} />
        <SleepStat label="Efficiency" value={s.sleepEfficiency !== null ? `${efficiency}%` : '--'} color={effColor} />
        {wide && <SleepStat label="Asleep in" value={s.sleepLatency !== null ? `${Math.round(s.sleepLatency / 60)}m` : '--'} />}
      </div>

      {/* Row 3: flexible detail area */}
      <div className="flex-1 min-h-0 flex flex-col justify-evenly gap-0.5">

        <div className="space-y-1">
          <VitalRange label="Heart rate" min={s.hrMin} avg={s.hrAvg} max={s.hrMax} unit="bpm" color="var(--color-critical)" />
          <VitalRange label="Respiratory" min={s.rrMin} avg={s.rrAvg} max={s.rrMax} unit="br/m" color="var(--color-info)" />
        </div>

        {medium && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <MetricRow label="Wakeup latency" value={s.wakeupLatency !== null ? Math.round(s.wakeupLatency / 60) : null} unit="m" />
            <MetricRow label="Woke up" value={s.wakeupCount} unit="x" />
            <MetricRow label="Awake time" value={s.wakeDuration !== null ? Math.round(s.wakeDuration / 60) : null} unit="m" color="var(--color-critical)" />
            <MetricRow label="Out of bed" value={s.outOfBedCount} unit="x" />
            {s.remEpisodes !== null && <MetricRow label="REM cycles" value={s.remEpisodes} />}
          </div>
        )}

        {tall && (s.breathingDisturbances !== null || (s.snoringEpisodes !== null && s.snoringEpisodes > 0) || s.apneaIndex !== null) && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-0.5 border-t border-white/[0.04]">
            {s.breathingDisturbances !== null && <MetricRow label="Breathing dist." value={Math.round(s.breathingDisturbances)} />}
            {s.snoringEpisodes !== null && s.snoringEpisodes > 0 && <MetricRow label="Snoring" value={s.snoringEpisodes} unit=" episodes" />}
            {s.snoring !== null && s.snoring > 0 && <MetricRow label="Snore duration" value={Math.round(s.snoring / 60)} unit="m" />}
            {s.apneaIndex !== null && <MetricRow label="Apnea index" value={Math.round(s.apneaIndex * 10) / 10} />}
          </div>
        )}
      </div>

    </div>
  );
}

// Activity intensity bar
function IntensityBar({ soft, moderate, intense }: { soft: number; moderate: number; intense: number }) {
  const total = soft + moderate + intense;
  if (total === 0) return null;

  const segments = [
    { label: 'Light', value: soft, color: 'var(--color-text-3)' },
    { label: 'Moderate', value: moderate, color: 'var(--color-warn)' },
    { label: 'Intense', value: intense, color: 'var(--color-critical)' },
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
            <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
              {s.label} <span className="font-mono">{s.value}m</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// HR zone bars
function HRZoneBars({ zones }: { zones: [number, number, number, number] }) {
  const max = Math.max(...zones, 1);
  const labels = ['Rest', 'Light', 'Moderate', 'Intense'];
  const colors = ['var(--color-text-3)', 'var(--color-ok)', 'var(--color-warn)', 'var(--color-critical)'];

  return (
    <div className="space-y-1">
      {zones.map((val, i) => (
        <div key={labels[i]} className="flex items-center gap-2">
          <span className="text-[12px] w-16 shrink-0" style={{ color: 'var(--color-text-3)' }}>{labels[i]}</span>
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(val / max) * 100}%`, backgroundColor: colors[i] }} />
          </div>
          <span className="font-mono text-[12px] w-10 text-right" style={{ color: 'var(--color-text-3)' }}>{val}s</span>
        </div>
      ))}
    </div>
  );
}

// Activity mode
function ActivityView({ data, size }: { data: WithingsData; size: Size }) {
  const a = data.activity?.today;
  if (!a) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[12px]" style={{ color: 'var(--color-text-3)' }}>
        No activity data
      </div>
    );
  }

  const stepTarget = 10000;
  const stepPct = Math.min((a.steps / stepTarget) * 100, 100);
  const hasHRZones = a.hrZone0 > 0 || a.hrZone1 > 0 || a.hrZone2 > 0 || a.hrZone3 > 0;
  const hasIntensity = a.softMinutes > 0 || a.moderateMinutes > 0 || a.intenseMinutes > 0;

  const tall = size.h >= 350;
  const compact = size.h < 200;

  return (
    <div className="flex flex-col h-full px-3 pb-2.5 gap-2">
      {/* Steps hero */}
      <div className="text-center shrink-0">
        <TickingNumber value={a.steps} className="type-value" />
        <div className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>steps</div>
      </div>

      {/* Progress bar */}
      <div className="shrink-0 space-y-1">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${stepPct}%`, backgroundColor: 'var(--color-ok)', transition: 'width var(--motion-data) var(--ease-out)' }}
          />
        </div>
        <div className="text-[12px] text-right" style={{ color: 'var(--color-text-3)' }}>
          <span className="font-mono">{stepPct.toFixed(0)}%</span> of 10,000 goal
        </div>
      </div>

      {/* Flexible content */}
      <div className="flex-1 min-h-0 flex flex-col justify-evenly">
        <div className="space-y-0.5">
          <MetricRow label="Distance" value={a.distance > 0 ? Math.round(a.distance / 100) / 10 : null} unit=" km" />
          <MetricRow label="Active calories" value={a.calories > 0 ? a.calories : null} unit=" kcal" color="var(--color-warn)" />
          {!compact && <MetricRow label="Total calories" value={a.totalCalories > 0 ? a.totalCalories : null} unit=" kcal" />}
          {a.elevation > 0 && <MetricRow label="Elevation" value={a.elevation} unit=" m" />}
        </div>

        {hasIntensity && (
          <div>
            <IntensityBar soft={a.softMinutes} moderate={a.moderateMinutes} intense={a.intenseMinutes} />
            {!compact && (
              <div className="text-[12px] text-center mt-1" style={{ color: 'var(--color-text-3)' }}>
                <span className="font-mono" style={{ color: 'var(--color-text-2)' }}>{a.activeMinutes}</span> active min
              </div>
            )}
          </div>
        )}

        {a.hrAvg !== null && !compact && (
          <div className="flex justify-between items-center gap-2">
            <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>Heart rate</span>
            <span className="font-mono text-[12px]" style={{ color: 'var(--color-text-2)' }}>
              {a.hrMin ?? '--'} / <span style={{ color: 'var(--color-critical)' }}>{a.hrAvg}</span> / {a.hrMax ?? '--'} bpm
            </span>
          </div>
        )}

        {hasHRZones && tall && (
          <div>
            <div
              className="text-[12px] uppercase mb-1"
              style={{ color: 'var(--color-text-3)', letterSpacing: 'var(--tracking-caps)' }}
            >
              HR zones
            </div>
            <HRZoneBars zones={[a.hrZone0, a.hrZone1, a.hrZone2, a.hrZone3]} />
          </div>
        )}
      </div>
    </div>
  );
}

const MODE_META: Record<HealthConfig['displayMode'], { icon: React.ComponentType<{ size?: number }>; title: string }> = {
  summary: { icon: Heart, title: 'Health' },
  weight: { icon: Scale, title: 'Weight' },
  sleep: { icon: Moon, title: 'Sleep' },
  activity: { icon: Footprints, title: 'Activity' },
};

export function HealthWidget({ config, style }: Props) {
  const [containerRef, size] = useContainerSize();
  const interval = Math.max(config.refreshInterval || 300, 60) * 1000;

  const { data, phase, isStale, lastUpdated } = usePolledData<WithingsData>(
    '/api/withings?action=all',
    { interval },
  );

  const meta = MODE_META[config.displayMode] ?? MODE_META.summary;
  const Icon = meta.icon;

  let body: React.ReactNode;

  if (!data) {
    body = (
      <div className="w-full h-full flex items-center justify-center">
        {phase === 'loading' ? (
          <span className="live-dot" aria-label="Loading health data" />
        ) : (
          <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
            Health data unavailable, retrying
          </span>
        )}
      </div>
    );
  } else if (data.connected === false) {
    body = <NotConnected />;
  } else {
    switch (config.displayMode) {
      case 'weight':
        body = <WeightView data={data} />;
        break;
      case 'sleep':
        body = <SleepView data={data} size={size} />;
        break;
      case 'activity':
        body = <ActivityView data={data} size={size} />;
        break;
      default:
        body = <SummaryView data={data} />;
    }
  }

  return (
    <WidgetShell
      icon={<Icon size={18} />}
      title={meta.title}
      style={style}
      status={<Freshness lastUpdated={lastUpdated} interval={interval} isStale={isStale} />}
    >
      <div ref={containerRef} className="w-full h-full overflow-hidden">
        {body}
      </div>
    </WidgetShell>
  );
}
