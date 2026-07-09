/**
 * Respiration (impedance) trace — asymmetric breath: inspiration faster
 * than expiration. Output 0..amplitude. Breath phase 0 = inspiration onset;
 * capno.ts uses the same phase convention so the two channels stay aligned.
 *
 * TODO(MEDICAL): I:E asymmetry is fixed at ~0.4/0.6 for looks.
 */
import type { RespParams } from '../../contracts/waveforms';
import { clamp, valueNoiseC } from './wave-utils';

/** Fraction of the cycle spent in inspiration. */
export const INSP_FRACTION = 0.4;

/** 0..1 breath phase at tSec for a given rate (shared with capno). */
export function breathPhase(rateBpm: number, tSec: number): number {
  const rate = clamp(rateBpm, 2, 60);
  const period = 60 / rate;
  return (tSec % period) / period;
}

export function respSample(params: RespParams, tSec: number): number {
  if (params.rate < 2 || params.amplitude <= 0) {
    return 0.02 + 0.008 * valueNoiseC(0x4e5b, tSec);
  }
  const p = breathPhase(params.rate, tSec);
  let v: number;
  if (p < INSP_FRACTION) {
    v = 0.5 - 0.5 * Math.cos((Math.PI * p) / INSP_FRACTION); // fast rise
  } else {
    v = 0.5 + 0.5 * Math.cos((Math.PI * (p - INSP_FRACTION)) / (1 - INSP_FRACTION)); // slow fall
  }
  return clamp(v * params.amplitude + 0.012 * valueNoiseC(0x4e5b, tSec * 3), 0, 1.1);
}
