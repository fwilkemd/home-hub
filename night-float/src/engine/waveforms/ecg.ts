/**
 * ECG synthesis — per-beat PQRST as a sum of Gaussians positioned in seconds
 * since beat onset, with rhythm-specific morphology (SPEC §7.1).
 * Output in millivolt-ish units, roughly -0.5..1.5 at amplitude 1.
 *
 * TODO(MEDICAL): all template positions/widths/amplitudes, the QT-rate
 * scaling and the VT/VF recipes are eyeballed for looks, not fidelity.
 */
import type { EcgParams } from '../../contracts/waveforms';
import { hash01 } from '../rng';
import type { BeatClock } from './beat-clock';
import { clamp, gauss, TWO_PI, valueNoiseC } from './wave-utils';

/** Normal PQRST template. `u` = seconds since beat onset, qt scales the T. */
function pqrst(u: number, qt: number, withP: boolean): number {
  let v = 0;
  if (withP) v += 0.13 * gauss(u, 0.09, 0.024); // P
  v -= 0.09 * gauss(u, 0.196, 0.009); // Q
  v += 1.05 * gauss(u, 0.215, 0.011); // R
  v -= 0.24 * gauss(u, 0.238, 0.01); // S
  v += 0.27 * gauss(u, 0.2 + 0.21 * qt, 0.05 * qt); // T
  return v;
}

/** Monomorphic wide complex (VT / PVC-ish): skewed wide gaussian pair. */
function wideComplex(u: number, interval: number): number {
  const w = Math.min(interval * 0.42, 0.16);
  return 1.0 * gauss(u, interval * 0.28, w * 0.55) - 0.72 * gauss(u, interval * 0.62, w * 0.8);
}

/** Premature-looking ventricular morphology for the ectopy hook. */
function pvcComplex(u: number): number {
  return 0.95 * gauss(u, 0.15, 0.045) - 0.6 * gauss(u, 0.27, 0.055);
}

/** VF: band-filtered-noise look — sines 3..8 Hz with hashed phases + wobble. */
function vfSample(seed: number, t: number): number {
  let v = 0;
  for (let i = 0; i < 6; i++) {
    const f = 3 + 5 * hash01(seed, 900 + i);
    const ph = hash01(seed, 950 + i) * TWO_PI;
    v += Math.sin(TWO_PI * f * t + ph);
  }
  const wobble = 0.55 + 0.45 * Math.sin(TWO_PI * 0.23 * t + hash01(seed, 991) * TWO_PI);
  return v * 0.11 * wobble;
}

/** Asystole: near-flat with tiny slow wander. */
function asystoleSample(seed: number, t: number): number {
  return (
    0.018 * Math.sin(TWO_PI * 0.16 * t + hash01(seed, 971) * TWO_PI) +
    0.012 * valueNoiseC(seed ^ 0x5170, t * 0.7)
  );
}

/** AF fibrillatory baseline: 3 small sines with hash-random phases. */
function fibBaseline(seed: number, t: number): number {
  let v = 0;
  for (let i = 0; i < 3; i++) {
    const f = 4.5 + 3 * hash01(seed, 870 + i);
    v += Math.sin(TWO_PI * f * t + hash01(seed, 880 + i) * TWO_PI);
  }
  return v * 0.028;
}

export function ecgSample(params: EcgParams, clock: BeatClock, tSec: number): number {
  const seed = clock.seed;
  const amp = params.amplitude;
  if (params.rhythm === 'vf') return vfSample(seed, tSec) * amp;
  if (params.rhythm === 'asystole') return asystoleSample(seed, tSec) * amp;

  const info = clock.phaseAt(tSec);
  if (!info.inBeat) return asystoleSample(seed, tSec) * amp;

  let v: number;
  if (params.rhythm === 'vt') {
    v = wideComplex(info.tInBeat, info.interval);
  } else {
    // Sinus / sinus_tach / sinus_brady get the full PQRST (short-vs-long TP
    // segment falls out of the rate); afib loses the P over fib waves.
    const qt = clamp(Math.sqrt(info.interval / 0.8), 0.72, 1.15);
    const pvcChance = clamp((params.ectopyPerMin * info.interval) / 60, 0, 0.5);
    const isPvc = pvcChance > 0 && hash01(seed ^ 0x7e55, info.beatIndex) < pvcChance;
    v = isPvc ? pvcComplex(info.tInBeat) : pqrst(info.tInBeat, qt, params.rhythm !== 'afib');
    if (params.rhythm === 'afib') v += fibBaseline(seed, tSec);
  }
  // Faint baseline micro-noise so the trace never looks synthetic-flat.
  v += 0.006 * valueNoiseC(seed ^ 0x33aa, tSec * 7);
  return v * amp;
}
