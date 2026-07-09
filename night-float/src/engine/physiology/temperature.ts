/**
 * Temperature module: core temp drifts slowly toward the scenario-set
 * tempSetC. TODO(MEDICAL): fever curves, antipyretics, active warming/cooling.
 */
import type { PhysioCtx } from './integrator';
import { approach, clamp } from '../types';

const TAU_TEMP_S = 420; // slow drift TODO(MEDICAL)

export function temperature(p: PhysioCtx, dt: number): void {
  const v = p.patient.vitals;
  const target = (p.effective['tempSetC'] ?? 37.0) + p.noise('temp', 0.04, 90);
  v.tempC = clamp(approach(v.tempC, target, dt, TAU_TEMP_S), 30, 43);
}
