'use client';
import { useState, useEffect, useRef } from 'react';
import { type MoonPhaseConfig, type WidgetStyle } from '@/types/widget';

interface Props {
  config: MoonPhaseConfig;
  style: WidgetStyle;
}

/** Compute moon phase value 0-1 (0=new, 0.5=full, 1=new) */
function getMoonPhase(): { phase: number; name: string; illumination: number; age: number } {
  const now = new Date();
  const jd = Math.floor(now.getTime() / 86400000) + 2440587.5;
  let moonAge = (jd - 2451550.1) % 29.530588853;
  if (moonAge < 0) moonAge += 29.530588853;
  const phase = moonAge / 29.530588853;
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;

  let name: string;
  if (phase < 0.0625) name = 'New Moon';
  else if (phase < 0.1875) name = 'Waxing Crescent';
  else if (phase < 0.3125) name = 'First Quarter';
  else if (phase < 0.4375) name = 'Waxing Gibbous';
  else if (phase < 0.5625) name = 'Full Moon';
  else if (phase < 0.6875) name = 'Waning Gibbous';
  else if (phase < 0.8125) name = 'Last Quarter';
  else if (phase < 0.9375) name = 'Waning Crescent';
  else name = 'New Moon';

  return { phase, name, illumination, age: moonAge };
}

/**
 * Draw a realistic moon on a canvas using procedural craters and phase shadow.
 * Creates a moonlike texture with maria (dark areas) and highlands,
 * then overlays the phase terminator.
 */
function drawMoon(canvas: HTMLCanvasElement, phase: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  ctx.clearRect(0, 0, size, size);

  // Draw base moon disc with gradient
  const baseGrad = ctx.createRadialGradient(cx * 0.85, cy * 0.8, r * 0.1, cx, cy, r);
  baseGrad.addColorStop(0, '#e8e0d0');
  baseGrad.addColorStop(0.3, '#d4cbb8');
  baseGrad.addColorStop(0.7, '#bfb6a3');
  baseGrad.addColorStop(1, '#a09888');

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Draw maria (dark lunar seas) - positioned to roughly match real moon
  const maria = [
    { x: 0.35, y: 0.3, rx: 0.18, ry: 0.12, a: -0.2, o: 0.25 },  // Mare Imbrium
    { x: 0.5, y: 0.45, rx: 0.12, ry: 0.15, a: 0.1, o: 0.2 },    // Mare Serenitatis
    { x: 0.55, y: 0.55, rx: 0.15, ry: 0.12, a: -0.15, o: 0.22 }, // Mare Tranquillitatis
    { x: 0.4, y: 0.55, rx: 0.08, ry: 0.1, a: 0, o: 0.18 },      // Mare Nubium
    { x: 0.6, y: 0.35, rx: 0.07, ry: 0.08, a: 0.3, o: 0.15 },   // Mare Crisium
    { x: 0.3, y: 0.5, rx: 0.1, ry: 0.08, a: -0.1, o: 0.2 },     // Oceanus Procellarum
    { x: 0.45, y: 0.65, rx: 0.08, ry: 0.06, a: 0.2, o: 0.15 },   // Mare Fecunditatis
    { x: 0.38, y: 0.42, rx: 0.06, ry: 0.05, a: 0, o: 0.12 },     // Mare Vaporum
  ];

  for (const m of maria) {
    ctx.save();
    ctx.translate(m.x * size, m.y * size);
    ctx.rotate(m.a);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, m.rx * size);
    grad.addColorStop(0, `rgba(80, 75, 65, ${m.o})`);
    grad.addColorStop(0.7, `rgba(90, 85, 75, ${m.o * 0.5})`);
    grad.addColorStop(1, 'rgba(90, 85, 75, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.rx * size, m.ry * size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw craters with rims
  const craters = [
    { x: 0.62, y: 0.75, r: 0.04 },  // Tycho
    { x: 0.3, y: 0.25, r: 0.035 },   // Copernicus
    { x: 0.45, y: 0.2, r: 0.025 },
    { x: 0.7, y: 0.4, r: 0.02 },
    { x: 0.25, y: 0.6, r: 0.03 },
    { x: 0.55, y: 0.8, r: 0.02 },
    { x: 0.35, y: 0.75, r: 0.025 },
    { x: 0.65, y: 0.25, r: 0.015 },
    { x: 0.2, y: 0.4, r: 0.02 },
    { x: 0.75, y: 0.55, r: 0.018 },
    { x: 0.5, y: 0.3, r: 0.015 },
    { x: 0.4, y: 0.85, r: 0.02 },
    { x: 0.55, y: 0.15, r: 0.012 },
    { x: 0.28, y: 0.35, r: 0.012 },
    { x: 0.68, y: 0.62, r: 0.015 },
  ];

  for (const c of craters) {
    const cr = c.r * size;
    const ccx = c.x * size;
    const ccy = c.y * size;

    // Crater shadow (darker inside)
    const craterGrad = ctx.createRadialGradient(ccx - cr * 0.2, ccy - cr * 0.2, 0, ccx, ccy, cr);
    craterGrad.addColorStop(0, 'rgba(60, 55, 48, 0.3)');
    craterGrad.addColorStop(0.6, 'rgba(80, 75, 65, 0.15)');
    craterGrad.addColorStop(1, 'rgba(100, 95, 85, 0)');
    ctx.fillStyle = craterGrad;
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
    ctx.fill();

    // Rim highlight (top-left lit)
    ctx.strokeStyle = 'rgba(220, 215, 200, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr * 0.9, -Math.PI * 0.8, Math.PI * 0.2);
    ctx.stroke();
  }

  // Add subtle noise texture
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % size;
    const py = Math.floor(i / 4 / size);
    const dx = px - cx;
    const dy = py - cy;
    if (dx * dx + dy * dy <= r * r) {
      const noise = (Math.random() - 0.5) * 12;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Draw phase shadow
  if (phase < 0.001 || phase > 0.999) {
    // New moon - full shadow
    ctx.fillStyle = 'rgba(5, 8, 15, 0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (phase < 0.499 || phase > 0.501) {
    // Compute terminator
    const sweep = Math.cos(phase * 2 * Math.PI);
    const terminatorRx = Math.abs(sweep) * r;

    ctx.fillStyle = 'rgba(5, 8, 15, 0.93)';
    ctx.beginPath();

    if (phase < 0.5) {
      // Waxing: shadow on left side
      // Arc from top to bottom along the LEFT side of the circle
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, true);
      // Terminator ellipse from bottom to top
      if (sweep > 0) {
        ctx.ellipse(cx, cy, terminatorRx, r, 0, Math.PI / 2, -Math.PI / 2, true);
      } else {
        ctx.ellipse(cx, cy, terminatorRx, r, 0, Math.PI / 2, -Math.PI / 2, false);
      }
    } else {
      // Waning: shadow on right side
      // Arc from top to bottom along the RIGHT side
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
      // Terminator ellipse from bottom to top
      if (sweep > 0) {
        ctx.ellipse(cx, cy, terminatorRx, r, 0, Math.PI / 2, -Math.PI / 2, false);
      } else {
        ctx.ellipse(cx, cy, terminatorRx, r, 0, Math.PI / 2, -Math.PI / 2, true);
      }
    }

    ctx.closePath();
    ctx.fill();
  }

  // Subtle glow on the lit edge
  const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.08);
  glowGrad.addColorStop(0, 'rgba(200, 210, 230, 0)');
  glowGrad.addColorStop(0.5, 'rgba(200, 210, 230, 0.05)');
  glowGrad.addColorStop(1, 'rgba(200, 210, 230, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function MoonPhaseWidget({ config }: Props) {
  const [moonData, setMoonData] = useState(() => getMoonPhase());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(200);

  useEffect(() => {
    const interval = setInterval(() => {
      setMoonData(getMoonPhase());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Resize canvas to fill container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const rect = container.getBoundingClientRect();
      // Use the smaller dimension, leave room for text
      const maxSize = Math.min(rect.width - 16, rect.height - 50);
      setCanvasSize(Math.max(80, Math.floor(maxSize)));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Draw moon when phase or size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      drawMoon(canvas, moonData.phase);
    }
  }, [moonData.phase, canvasSize]);

  const { name, illumination } = moonData;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center p-2 gap-1 bg-gradient-to-b from-[#0a0e1a] to-[#0d1220]">
      {/* Moon canvas */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        <canvas
          ref={canvasRef}
          className="rounded-full"
          style={{ filter: 'drop-shadow(0 0 12px rgba(200, 210, 230, 0.08))' }}
        />
      </div>

      {/* Phase name */}
      <div className="text-center shrink-0 pb-1">
        <div className="text-[11px] font-semibold text-white/80 leading-tight">{name}</div>
        <div className="text-[9px] text-white/35">{Math.round(illumination * 100)}% lit</div>
      </div>
    </div>
  );
}
