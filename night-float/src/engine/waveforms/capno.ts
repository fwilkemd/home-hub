/**
 * Capnogram — rounded square wave: expiratory sigmoid upstroke, alveolar
 * plateau with a plateauSlope tilt ending at etco2, sharp inspiratory
 * downstroke to 0 (SPEC §7.1). Output in mmHg. Phase convention shared with
 * resp.ts: 0 = inspiration onset, expiration occupies the last ~60%.
 *
 * TODO(MEDICAL): upstroke width vs. obstruction and phase III slope scaling.
 */
import type { CapnoParams } from '../../contracts/waveforms';
import { breathPhase, INSP_FRACTION } from './resp';
import { clamp, lerp, smoothstep, valueNoiseC } from './wave-utils';

export function capnoSample(params: CapnoParams, tSec: number): number {
  if (!params.present) return 0;
  const p = breathPhase(params.rate, tSec);
  const slope = clamp(params.plateauSlope, 0, 1);
  const up0 = INSP_FRACTION + 0.02;
  const upW = 0.09 * (1 + 0.8 * slope); // obstruction sloppies the upstroke

  let shape = 0;
  if (p < 0.06) {
    // sharp inspiratory downstroke from end-tidal to baseline
    shape = 1 - smoothstep(0, 0.06, p);
  } else if (p >= up0) {
    const rise = smoothstep(up0, up0 + upW, p);
    const plateauT = clamp((p - (up0 + upW)) / Math.max(0.05, 1 - (up0 + upW)), 0, 1);
    const level = lerp(1 - 0.05 - 0.3 * slope, 1, plateauT); // tilted plateau -> etco2
    shape = rise * level;
  }
  const v = shape * params.etco2;
  return Math.max(0, v + shape * 0.4 * valueNoiseC(0x2ca9, tSec * 4));
}
