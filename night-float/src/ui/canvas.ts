/**
 * Shared canvas plumbing for the flowsheet strip chart and the debrief
 * timeline: DPR setup, vitals polylines, time-axis tick choice.
 */
import type { FlowsheetPoint } from '../contracts/runtime';

/** Size a canvas for CSS pixels at device resolution; returns a scaled ctx. */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): CanvasRenderingContext2D | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export interface VitalSeriesSpec {
  color: string;
  lo: number;
  hi: number;
  get: (p: FlowsheetPoint) => number | undefined;
}

export const VITAL_SERIES: Record<'hr' | 'map' | 'spo2' | 'rr', VitalSeriesSpec> = {
  hr: { color: '#2ee66b', lo: 0, hi: 180, get: (p) => p.hr },
  map: { color: '#ff4d5e', lo: 0, hi: 140, get: (p) => p.map },
  spo2: { color: '#35d5e8', lo: 50, hi: 100, get: (p) => p.spo2 },
  rr: { color: '#ffd23a', lo: 0, hi: 50, get: (p) => p.rr },
};

export function yFor(v: number, spec: VitalSeriesSpec, y0: number, y1: number): number {
  const f = (v - spec.lo) / (spec.hi - spec.lo);
  return y1 - Math.max(0, Math.min(1, f)) * (y1 - y0);
}

/** Draw one vital series as a polyline across [t0,t1] mapped to [x0,x1]. */
export function drawVitalSeries(
  ctx: CanvasRenderingContext2D,
  pts: readonly FlowsheetPoint[],
  spec: VitalSeriesSpec,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  t0: number,
  t1: number,
): void {
  const span = Math.max(1, t1 - t0);
  ctx.strokeStyle = spec.color;
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  for (const p of pts) {
    const v = spec.get(p);
    if (v === undefined || !Number.isFinite(v)) continue;
    const x = x0 + ((p.t - t0) / span) * (x1 - x0);
    const y = yFor(v, spec, y0, y1);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

/** Pick a tick step (sim seconds) so a span gets ~5-9 time labels. */
export function chooseTickStep(spanS: number): number {
  const steps = [60, 120, 300, 600, 900, 1800, 3600, 7200, 14400];
  for (const s of steps) if (spanS / s <= 8) return s;
  return 28800;
}
