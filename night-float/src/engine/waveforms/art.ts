/**
 * Arterial line waveform — sharp systolic upstroke, brief peak, downslope
 * with a distinct dicrotic notch (dip + secondary bump), diastolic runoff.
 * Output in mmHg, scaled dbp..sbp. respSwing shifts the baseline with
 * respiration (the PPV hook, SPEC §7.1); `damped` lerps toward an
 * overdamped, low-amplitude version; pulsatile=false is a flat line ~18.
 *
 * TODO(MEDICAL): shape constants and the damping/PPV mappings are cosmetic.
 */
import type { ArtParams } from '../../contracts/waveforms';
import type { BeatClock } from './beat-clock';
import { clamp, gauss, smoothstep, TWO_PI, valueNoiseC } from './wave-utils';

/** Raw 0..~1 pulse shape. `u` seconds since beat onset. */
function rawShape(u: number, interval: number, damped: number): number {
  const notch = 1 - clamp(damped, 0, 1);
  const wMain = 0.045 * (1 + 0.9 * damped);
  let v = gauss(u, 0.11, wMain) + 0.4 * gauss(u, 0.22, 0.085);
  v -= 0.13 * notch * gauss(u, 0.315, 0.016); // dicrotic notch dip
  v += 0.17 * notch * gauss(u, 0.375, 0.042); // secondary (dicrotic) bump
  // Diastolic runoff toward DBP, pinned to 0 just before the next upstroke.
  const runoff = 0.14 * Math.exp(-Math.max(0, u - 0.4) / 0.32) * smoothstep(0.34, 0.5, u);
  v += runoff * (1 - smoothstep(interval - 0.14, interval - 0.02, u));
  return v;
}

/** Peak of the undamped shape at a nominal interval (for normalization). */
const SHAPE_NORM = (() => {
  let m = 0;
  for (let u = 0; u <= 0.8; u += 0.002) m = Math.max(m, rawShape(u, 0.8, 0));
  return m;
})();

export function artSample(
  params: ArtParams,
  clock: BeatClock,
  tSec: number,
  respRateBpm = 14,
): number {
  const seed = clock.seed;
  if (!params.present) return 0;
  if (!params.pulsatile) {
    // Pulseless with a line in: flat-ish trace near CVP-level pressures.
    return 18 + 1.1 * Math.sin(TWO_PI * 0.28 * tSec) + 0.7 * valueNoiseC(seed ^ 0x41a7, tSec * 3);
  }
  const info = clock.phaseAt(tSec);
  if (!info.inBeat) {
    // Organized-rhythm params but the clock says no beats (vf/asystole).
    return 16 + 1.5 * valueNoiseC(seed ^ 0x41a7, tSec * 4);
  }

  const damped = clamp(params.damped, 0, 1);
  const swing = clamp(params.respSwing, 0, 1) * Math.sin(TWO_PI * (respRateBpm / 60) * tSec);
  const off = 4 * swing; // baseline respiratory shift, mmHg
  const pp = Math.max(6, params.sbp - params.dbp);
  // Overdamping narrows pulse pressure around the mean.
  const dbpEff = params.dbp + 0.175 * damped * pp;
  const ppEff = Math.max(4, pp * (1 - 0.35 * damped) - Math.abs(off));
  const s = rawShape(info.tInBeat, info.interval, damped) / SHAPE_NORM;
  const v = dbpEff + off + s * ppEff;
  return v + 0.35 * valueNoiseC(seed ^ 0x18d3, tSec * 6);
}
