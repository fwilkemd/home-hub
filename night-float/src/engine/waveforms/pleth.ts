/**
 * SpO2 plethysmogram — per beat: fast systolic rise, rounded peak, and a
 * dicrotic-ish shoulder on the downslope; amplitude scaled by perfusion and
 * slowly modulated by respiration (SPEC §7.1). Output 0..~1.
 *
 * TODO(MEDICAL): shoulder position/size vs. arterial compliance is cosmetic.
 */
import type { PlethParams } from '../../contracts/waveforms';
import type { BeatClock } from './beat-clock';
import { clamp, gauss, TWO_PI, valueNoiseC } from './wave-utils';

/** Peak of the raw two-gaussian pulse shape (for normalization). */
const SHAPE_NORM = (() => {
  let m = 0;
  for (let p = 0; p <= 1; p += 0.002) m = Math.max(m, rawPulse(p));
  return m;
})();

function rawPulse(phase: number): number {
  return 1.0 * gauss(phase, 0.18, 0.085) + 0.42 * gauss(phase, 0.44, 0.14) + 0.05;
}

export function plethSample(
  params: PlethParams,
  clock: BeatClock,
  tSec: number,
  respRateBpm = 14,
): number {
  const seed = clock.seed;
  if (!params.present) {
    // flatline near 0 with a whisper of noise (probe off / pulseless)
    return 0.008 + 0.006 * valueNoiseC(seed ^ 0x9b1e, tSec * 1.6);
  }
  const info = clock.phaseAt(tSec);
  if (!info.inBeat) {
    return 0.012 + 0.01 * valueNoiseC(seed ^ 0x9b1e, tSec * 2.2);
  }
  const pulse = rawPulse(info.phase) / SHAPE_NORM;
  // Slow respiratory amplitude modulation (respSwing 0..1).
  const respMod =
    1 - clamp(params.respSwing, 0, 1) * 0.5 * (1 + Math.sin(TWO_PI * (respRateBpm / 60) * tSec));
  const v = pulse * clamp(params.perfusion, 0, 1) * respMod;
  return clamp(v + 0.006 * valueNoiseC(seed ^ 0x77c2, tSec * 5), 0, 1.2);
}
