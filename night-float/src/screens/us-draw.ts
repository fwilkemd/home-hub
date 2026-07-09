/**
 * Shared ultrasound draw context + tiny grayscale helpers used by every view
 * painter. Structures are drawn in cm from the fan apex so the depth knob
 * rescales anatomy for free (SPEC §8.2).
 */
import { clamp } from '../engine/waveforms';

export const TWO_PI = Math.PI * 2;

export interface UsDraw {
  ctx: CanvasRenderingContext2D;
  apexX: number;
  apexY: number;
  pxPerCm: number;
  fanR: number;
  halfAngle: number;
  t: number;
  seed: number;
  /** 0..1 systolic contraction envelope, beat-synced with the monitor. */
  pulse: number;
  /** 0..1 breath phase (0 = inspiration onset). */
  respPhase: number;
}

export const gray = (v: number, a = 1): string => {
  const b = Math.round(255 * clamp(v, 0, 1));
  return `rgba(${b},${b},${b},${a})`;
};

export function ell(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot = 0,
): void {
  c.beginPath();
  c.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), rot, 0, TWO_PI);
}
