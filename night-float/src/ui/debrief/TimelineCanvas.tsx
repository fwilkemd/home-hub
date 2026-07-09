/**
 * Debrief timeline: one canvas — vitals strip on top, event lanes below with
 * markers, key-event labels, and a mousemove hit-test tooltip.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as RMouseEvent } from 'react';
import type { SimEvent } from '../../contracts/events';
import type { DebriefData } from '../../contracts/runtime';
import { chooseTickStep, drawVitalSeries, setupCanvas, VITAL_SERIES } from '../canvas';
import { describeEvent, wallClock } from '../format';

interface Marker {
  x: number;
  y: number;
  t: number;
  label: string;
}

interface Lane {
  label: string;
  color: string;
  match: (e: SimEvent) => boolean;
}

const LANES: Lane[] = [
  {
    label: 'Orders/Meds',
    color: '#35d5e8',
    match: (e) =>
      e.type === 'OrderPlaced' ||
      e.type === 'MedAdministered' ||
      e.type === 'InfusionStarted' ||
      e.type === 'InfusionRateChanged' ||
      e.type === 'InfusionStopped',
  },
  {
    label: 'Labs',
    color: '#a78bfa',
    match: (e) => e.type === 'LabOrdered' || e.type === 'LabResulted' || e.type === 'ImagingResulted',
  },
  { label: 'Alarms', color: '#ffb03a', match: (e) => e.type === 'AlarmRaised' },
  {
    label: 'Procedures',
    color: '#2ee66b',
    match: (e) => e.type.startsWith('Procedure') || e.type === 'LinePlaced' || e.type === 'SterileFieldContaminated',
  },
  {
    label: 'Events',
    color: '#8b96ad',
    match: (e) =>
      e.type === 'ScenarioScriptedEvent' || e.type === 'RhythmChanged' || e.type === 'ScenarioEnded',
  },
];

function isCritMarker(e: SimEvent): boolean {
  return (
    (e.type === 'AlarmRaised' && e.priority === 'crisis') ||
    e.type === 'ProcedureComplication' ||
    e.type === 'SterileFieldContaminated' ||
    (e.type === 'ScenarioEnded' && e.outcome === 'death')
  );
}

/** Short text for the few key events labeled directly on the canvas. */
function keyLabel(e: SimEvent): string | null {
  switch (e.type) {
    case 'InfusionStarted':
      return e.label.split(' ')[0] ?? null;
    case 'ProcedureCompleted':
      return e.name;
    case 'RhythmChanged':
      return e.to;
    case 'ScenarioEnded':
      return e.outcome.toUpperCase();
    default:
      return null;
  }
}

const STRIP_H = 108;
const LANE_H = 26;
const AXIS_H = 24;
const LABEL_W = 96;
const PAD = 6;

function drawTimeline(
  canvas: HTMLCanvasElement,
  cssW: number,
  debrief: DebriefData,
  clockStart: string,
): Marker[] {
  const cssH = PAD + STRIP_H + LANES.length * LANE_H + AXIS_H + PAD;
  const ctx = setupCanvas(canvas, cssW, cssH);
  if (!ctx) return [];
  ctx.clearRect(0, 0, cssW, cssH);

  const duration = Math.max(1, debrief.endedAtSim);
  const x0 = LABEL_W;
  const x1 = cssW - 10;
  const xFor = (t: number) => x0 + (Math.max(0, Math.min(duration, t)) / duration) * (x1 - x0);

  // ---- time grid + axis
  const step = chooseTickStep(duration);
  ctx.font = '10px ui-monospace, monospace';
  for (let t = 0; t <= duration; t += step) {
    const x = xFor(t);
    ctx.strokeStyle = 'rgba(38,48,73,0.45)';
    ctx.beginPath();
    ctx.moveTo(x, PAD);
    ctx.lineTo(x, cssH - AXIS_H);
    ctx.stroke();
    ctx.fillStyle = '#5a657f';
    ctx.textAlign = 'center';
    ctx.fillText(wallClock(clockStart, t, false), x, cssH - AXIS_H + 14);
  }

  // ---- vitals strip
  const sy0 = PAD;
  const sy1 = PAD + STRIP_H;
  ctx.strokeStyle = 'rgba(38,48,73,0.9)';
  ctx.strokeRect(x0, sy0, x1 - x0, STRIP_H);
  ctx.fillStyle = '#5a657f';
  ctx.textAlign = 'left';
  ctx.fillText('HR · MAP · SpO2', 8, sy0 + 12);
  const series = debrief.vitalsSeries;
  if (series.length > 1) {
    drawVitalSeries(ctx, series, VITAL_SERIES.hr, x0, x1, sy0 + 4, sy1 - 4, 0, duration);
    drawVitalSeries(ctx, series, VITAL_SERIES.map, x0, x1, sy0 + 4, sy1 - 4, 0, duration);
    drawVitalSeries(ctx, series, VITAL_SERIES.spo2, x0, x1, sy0 + 4, sy1 - 4, 0, duration);
  } else {
    ctx.fillText('no vitals recorded', x0 + 10, (sy0 + sy1) / 2);
  }

  // ---- lanes with markers
  const markers: Marker[] = [];
  let labelFlip = false;
  LANES.forEach((lane, li) => {
    const yTop = sy1 + li * LANE_H;
    const yMid = yTop + LANE_H / 2;
    ctx.strokeStyle = 'rgba(38,48,73,0.4)';
    ctx.beginPath();
    ctx.moveTo(x0, yTop + LANE_H);
    ctx.lineTo(x1, yTop + LANE_H);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(139,150,173,0.18)';
    ctx.beginPath();
    ctx.moveTo(x0, yMid);
    ctx.lineTo(x1, yMid);
    ctx.stroke();
    ctx.fillStyle = '#8b96ad';
    ctx.textAlign = 'left';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(lane.label, 8, yMid + 3);

    for (const e of debrief.events) {
      if (!lane.match(e)) continue;
      const x = xFor(e.t);
      const crit = isCritMarker(e);
      ctx.fillStyle = crit ? '#ff4d5e' : lane.color;
      ctx.beginPath();
      ctx.arc(x, yMid, crit ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
      const label = describeEvent(e) ?? e.type;
      markers.push({ x, y: yMid, t: e.t, label });

      const key = keyLabel(e);
      if (key) {
        labelFlip = !labelFlip;
        ctx.fillStyle = '#d7deeb';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(key, x, yMid + (labelFlip ? -7 : 13));
      }
    }
  });

  return markers;
}

export function TimelineCanvas({
  debrief,
  clockStart,
}: {
  debrief: DebriefData;
  clockStart: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const redraw = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    markersRef.current = drawTimeline(canvas, Math.max(320, wrap.clientWidth - 16), debrief, clockStart);
  }, [debrief, clockStart]);

  useEffect(() => {
    redraw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(redraw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  const onMove = (e: RMouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: Marker | null = null;
    let bestD = 11;
    for (const m of markersRef.current) {
      const d = Math.hypot(m.x - mx, m.y - my);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    const next = best
      ? { x: best.x + 8, y: best.y + 8, text: `${wallClock(clockStart, best.t, false)} — ${best.label}` }
      : null;
    setTip((prev) =>
      prev?.text === next?.text && prev?.x === next?.x && prev?.y === next?.y ? prev : next,
    );
  };

  return (
    <div ref={wrapRef} className="timelinewrap" onMouseMove={onMove} onMouseLeave={() => setTip(null)}>
      <canvas ref={canvasRef} />
      {tip && (
        <div className="timeline-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
