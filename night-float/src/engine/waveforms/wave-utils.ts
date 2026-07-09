/**
 * Shared math helpers for the waveform synths. Pure and deterministic —
 * every "random" wiggle flows through hash01 (never Math.random).
 */
import { hash01 } from '../rng';

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Un-normalized gaussian bump centered at `center` with sd `width`. */
export function gauss(x: number, center: number, width: number): number {
  const d = x - center;
  return Math.exp(-(d * d) / (2 * width * width));
}

/** 1D value noise in [0,1), C1-smooth, deterministic per (seed, x). */
export function valueNoise1d(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash01(seed, i), hash01(seed, i + 1), u);
}

/** Centered variant of valueNoise1d in [-1,1). */
export function valueNoiseC(seed: number, x: number): number {
  return valueNoise1d(seed, x) * 2 - 1;
}

export const TWO_PI = Math.PI * 2;
