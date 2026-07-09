/**
 * Hemodynamics module: MAP/pulse pressure from volumeStatus + SVR +
 * contractility, HR from a baroreflex around mapSetpoint, CVP when a central
 * line exists, and peripheral perfusion coupling. All curves are placeholder
 * blends — structurally real, numerically fake.
 */
import type { PhysioCtx } from './integrator';
import { approach, clamp, clamp01 } from '../types';

/** Rhythm-driven rate overrides. TODO(MEDICAL): real rate ranges per rhythm. */
function rhythmRate(rhythm: string, hrTarget: number): number {
  switch (rhythm) {
    case 'sinus_tach':
      return Math.max(hrTarget, 112);
    case 'sinus_brady':
      return Math.min(hrTarget, 52);
    case 'afib':
      return clamp(hrTarget * 1.3, 70, 165); // RVR-flavored TODO(MEDICAL)
    case 'vt':
      return 158; // TODO(MEDICAL): 150-170 monomorphic VT
    case 'vf':
    case 'asystole':
      // vf has no organized ventricular rate — the monitor numeric reads 0
      // (waveform layer renders fibrillation independently of rate).
      return 0;
    default:
      return hrTarget;
  }
}

export function hemodynamics(p: PhysioCtx, dt: number): void {
  const e = p.effective;
  const v = p.patient.vitals;
  const rhythm = v.rhythm;
  const pulseless = rhythm === 'vf' || rhythm === 'asystole';

  const volume = clamp01(e['volumeStatus'] ?? 0.5);
  const svr = clamp01(e['svr'] ?? 0.5);
  const contractility = clamp01(e['contractility'] ?? 0.6);

  // MAP: weighted blend of the three stubs mapped onto ~40..110 for typical
  // param ranges (floor 9 so a fully collapsed blend reads "arrested").
  // TODO(MEDICAL): replace with CO*SVR-based model (preload/afterload curves).
  let mapTarget = 9 + 134 * (0.3 * volume + 0.45 * svr + 0.25 * contractility);

  // Pulse pressure widens with contractility, narrows with vasoconstriction.
  // TODO(MEDICAL): stroke volume / arterial compliance model.
  let ppTarget = 15 + 55 * contractility - 25 * (svr - 0.5);

  // Baroreflex: HR rises as MAP falls below the setpoint (and vice versa).
  // TODO(MEDICAL): real baroreflex gain, blunting with sedation/beta-blockade.
  const baroGain = 0.9;
  let hrTarget =
    (e['hrBaseline'] ?? 78) +
    clamp(baroGain * ((e['mapSetpoint'] ?? 78) - v.map), -25, 40) +
    (e['chronotropy'] ?? 0); // drug chronotropy hook (additive bpm)
  hrTarget = rhythmRate(rhythm, hrTarget);

  if (pulseless) {
    // no forward flow: pressures collapse over seconds TODO(MEDICAL)
    mapTarget = 18;
    ppTarget = 6;
  }

  const tau = pulseless ? 3 : 9;
  v.map = clamp(approach(v.map, mapTarget + p.noise('map', 1.1, 25), dt, tau), 5, 200);
  const pp = clamp(approach(v.sbp - v.dbp, Math.max(ppTarget, 5), dt, tau), 4, 110);
  v.sbp = clamp(v.map + pp * (2 / 3), 8, 260);
  v.dbp = clamp(v.map - pp / 3, 3, 200);

  const hrNoise = hrTarget > 0 ? p.noise('hr', 1.8, 18) : 0;
  v.hr = clamp(approach(v.hr, hrTarget + hrNoise, dt, hrTarget <= 0 ? 2.5 : 6), 0, 220);
  if (hrTarget <= 0 && v.hr < 6) v.hr = 0;

  // CVP appears only once a central line exists (SPEC §9.3 payoff).
  // TODO(MEDICAL): CVP from RV function + volume, respiratory variation.
  if (p.patient.lines.some((l) => l.type === 'cvc')) {
    const cvpTarget = 3 + 10 * volume + p.noise('cvp', 0.4, 30);
    v.cvp = clamp(approach(v.cvp ?? cvpTarget, cvpTarget, dt, 12), 0, 30);
  } else {
    v.cvp = undefined;
  }

  // Peripheral perfusion couples to MAP (shock spiral + pressor recovery).
  // TODO(MEDICAL): capillary refill / lactate clearance linkage.
  const perfBase = clamp01(e['perfusion'] ?? 0.8);
  const mapFactor = 0.35 + 0.65 * clamp01((v.map - 40) / 35);
  e['perfusionEff'] = pulseless ? 0 : clamp01(perfBase * mapFactor);
}
