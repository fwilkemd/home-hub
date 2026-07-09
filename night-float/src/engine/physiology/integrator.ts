/**
 * Physiology integrator (SPEC §5.2): composes the organ-system modules, each
 * a pure (PhysioCtx, dt) => void that nudges vitals toward targets derived
 * from EFFECTIVE params (base + drug modifiers). Also owns the deterministic
 * "physiologic noise" streams and the continuous breath-phase tracker.
 */
import type { EngineCtx } from '../types';
import { clamp01 } from '../types';
import type { VentHandle } from '../vent';
import type { Rng } from '../rng';
import { sedationModule } from './sedation';
import { hemodynamics } from './hemodynamics';
import { respiratory } from './respiratory';
import { temperature } from './temperature';

export interface PhysioDerived {
  /** spontaneous respiratory rate the patient is generating (breaths/min) */
  spontRr: number;
}

export interface PhysioCtx extends EngineCtx {
  vent: VentHandle;
  derived: PhysioDerived;
  /**
   * Deterministic slow-wander noise (Ornstein-Uhlenbeck-ish): call with a
   * stable key each tick; sigma is the stationary spread, tauS the wander
   * time constant. Makes tracings breathe without ever using Math.random.
   */
  noise(key: string, sigma: number, tauS: number): number;
}

export type PhysioModule = (p: PhysioCtx, dt: number) => void;

/** Order matters: sedation integrates first (respiratory reads it), then
 * hemodynamics (respiratory reads perfusion), then respiratory, then temp. */
const MODULES: PhysioModule[] = [sedationModule, hemodynamics, respiratory, temperature];

export interface PhysiologyHandle {
  tick(t: number, dt: number): void;
  getBreathPhase(): number;
  derived: PhysioDerived;
}

export function createPhysiology(ctx: EngineCtx, vent: VentHandle): PhysiologyHandle {
  const noiseStates = new Map<string, number>();
  const rng: Rng = ctx.rng.physio;
  const derived: PhysioDerived = { spontRr: ctx.patient.vitals.rr };
  let breathPhase = 0;
  let dtNow = 0.1;

  const pctx: PhysioCtx = Object.create(ctx) as PhysioCtx;
  pctx.vent = vent;
  pctx.derived = derived;
  pctx.noise = (key, sigma, tauS) => {
    const prev = noiseStates.get(key) ?? 0;
    // OU step: decay toward 0 + seeded gaussian kick, stationary sd ~= sigma
    const k = Math.min(dtNow / Math.max(tauS, 0.5), 1);
    const next = prev * (1 - k) + rng.gauss() * sigma * Math.sqrt(2 * k);
    noiseStates.set(key, next);
    return next;
  };

  function tick(_t: number, dt: number): void {
    dtNow = dt;
    for (const mod of MODULES) mod(pctx, dt);

    // breath phase: vent-driven when ventilating, else spontaneous (SPEC §5.2)
    const rate = vent.isVentilating() ? vent.deliveredRate() : derived.spontRr;
    if (rate > 0.5) {
      breathPhase = (breathPhase + (dt * rate) / 60) % 1;
    }
    // rate 0 -> phase freezes (chest still)

    // pleth/pulse-pressure-variation hook: perfusion coupling done in
    // hemodynamics; keep effective perfusion clamped for downstream readers
    ctx.effective['perfusionEff'] = clamp01(ctx.effective['perfusionEff'] ?? 0.8);
  }

  return { tick, getBreathPhase: () => breathPhase, derived };
}
