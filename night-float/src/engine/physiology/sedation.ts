/**
 * Sedation / paralysis module: the behavioral INTEGRATED_PARAMS live in BASE
 * physiology (so the world can read eyes/movement off PatientState) and move
 * toward the drug-driven targets published by pharmacology each tick.
 */
import type { PhysioCtx } from './integrator';
import { INTEGRATED_PARAMS, approach, clamp01 } from '../types';

// TODO(MEDICAL): onset of behavioral state change / emergence tails per agent.
const TAU_UP_S = 15;
const TAU_DOWN_S = 90;

export function sedationModule(p: PhysioCtx, dt: number): void {
  const base = p.patient.physiology;
  for (const param of INTEGRATED_PARAMS) {
    const target = clamp01(p.drugTargets[param] ?? 0);
    const cur = clamp01(base[param] ?? 0);
    const next = approach(cur, target, dt, target > cur ? TAU_UP_S : TAU_DOWN_S);
    base[param] = Math.abs(next) < 1e-4 ? 0 : next;
    p.effective[param] = base[param];
  }

  // Agitation eases as sedation deepens. TODO(MEDICAL): agitation dynamics
  // (pain, delirium) — placeholder coupling only.
  const agitation = clamp01(p.effective['agitation'] ?? 0.1);
  p.effective['agitation'] = clamp01(agitation * (1 - clamp01(p.effective['sedation'] ?? 0)));
}
