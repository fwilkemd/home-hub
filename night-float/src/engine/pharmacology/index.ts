/**
 * Pharmacology subsystem (SPEC §5.3): generic PK/PD frame.
 * - Boluses bump a per-drug effect-site level ce by dose/refDose, which then
 *   decays with offsetS.
 * - Infusions pull ce toward rate/refDose with onsetS up / offsetS down.
 * - Effects become MODIFIERS on effective physiology params ('add' adds the
 *   magnitude, 'mult' multiplies by 1+magnitude). Base params are never
 *   mutated by drugs; the behavioral INTEGRATED_PARAMS get their drug-driven
 *   targets published on ctx.drugTargets (physiology/sedation.ts integrates).
 * - rhythmEffects roll probabilistic conversions per tick while ce >= minCe.
 */
import type { DrugDefinition } from '../../contracts/content';
import { getDrug } from '../../data/drugs';
import type { EngineCtx } from '../types';
import { INTEGRATED_PARAMS } from '../types';
import { advanceCe, effectMagnitude } from './kinetics';
import type { RhythmMachine } from '../rhythms';

interface DrugRuntime {
  drug: DrugDefinition;
  ce: number;
}

export interface PharmacologyHandle {
  tick(t: number, dt: number): void;
  /** apply an administered bolus at the current sim time */
  applyBolus(drugId: string, dose: number): void;
  getCe(drugId: string): number;
  serialize(): Record<string, number>;
}

export function createPharmacology(ctx: EngineCtx, rhythms: RhythmMachine): PharmacologyHandle {
  const active = new Map<string, DrugRuntime>();
  const rng = ctx.rng.rhythm;

  function runtimeFor(drugId: string): DrugRuntime | null {
    let rt = active.get(drugId) ?? null;
    if (!rt) {
      const drug = getDrug(drugId);
      if (!drug) return null;
      rt = { drug, ce: 0 };
      active.set(drugId, rt);
    }
    return rt;
  }

  function applyBolus(drugId: string, dose: number): void {
    const rt = runtimeFor(drugId);
    if (!rt) return;
    const ref = Math.max(rt.drug.pk.refDose, 1e-6);
    rt.ce += dose / ref; // instant effect-site bump; decays via offsetS
  }

  /** Sum of infusion steady-state targets, normalized by refDose. */
  function infusionTarget(drug: DrugDefinition): number {
    let target = 0;
    for (const inf of ctx.patient.infusions) {
      if (inf.drugId !== drug.id) continue;
      const ch = ctx.patient.devices.pumps.find((p) => p.id === inf.channelId);
      if (ch && !ch.running) continue; // paused pump delivers nothing
      target += inf.doseRate / Math.max(drug.pk.refDose, 1e-6);
    }
    return target;
  }

  function tick(_t: number, dt: number): void {
    // make sure every running infusion has a runtime even without a bolus
    for (const inf of ctx.patient.infusions) runtimeFor(inf.drugId);

    // 1) advance effect-site levels
    for (const rt of active.values()) {
      const target = infusionTarget(rt.drug);
      rt.ce = advanceCe(rt.ce, target, dt, rt.drug.pk.onsetS, rt.drug.pk.offsetS);
      if (rt.ce < 1e-4 && target === 0) rt.ce = 0;
    }

    // 2) rebuild effective params: base copy + modifiers
    const base = ctx.patient.physiology;
    const eff = ctx.effective;
    for (const key of Object.keys(eff)) delete eff[key];
    for (const [k, v] of Object.entries(base)) eff[k] = v;

    const targets = ctx.drugTargets;
    for (const key of Object.keys(targets)) delete targets[key];

    for (const rt of active.values()) {
      if (rt.ce <= 0) continue;
      for (const effect of rt.drug.effects) {
        const mag = effectMagnitude(effect, rt.ce);
        if (INTEGRATED_PARAMS.includes(effect.param)) {
          targets[effect.param] = (targets[effect.param] ?? 0) + mag;
          continue;
        }
        if (effect.mode === 'add') eff[effect.param] = (eff[effect.param] ?? 0) + mag;
        else eff[effect.param] = (eff[effect.param] ?? 0) * (1 + mag);
      }
    }

    // 3) probabilistic rhythm conversions while ce >= minCe (seeded stream)
    for (const rt of active.values()) {
      for (const conv of rt.drug.rhythmEffects) {
        if (rt.ce < conv.minCe) continue;
        const current = ctx.patient.vitals.rhythm;
        if (!conv.from.includes(current)) continue;
        const p = (conv.probPerMin * dt) / 60;
        if (rng.chance(p)) rhythms.set(conv.to);
      }
    }
  }

  return {
    tick,
    applyBolus,
    getCe: (drugId) => active.get(drugId)?.ce ?? 0,
    serialize: () => {
      const out: Record<string, number> = {};
      for (const [id, rt] of active) out[id] = rt.ce;
      return out;
    },
  };
}
