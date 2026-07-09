/**
 * Procedures runtime (SPEC §9): a state machine over data-defined
 * ProcedureDefinitions. Steps advance via AdvanceProcedureStep (done or
 * skipped-with-consequence), complications roll on the seeded 'complications'
 * stream with skip multipliers, completion applies data effects with '$site'
 * substitution. Sterile-field contamination is tracked and logged; its
 * clinical consequence is a medical-pass hook.
 */
import type { ProcedureRuntime, ProcedureRuntimeStep } from '../contracts/runtime';
import type { ProcedureDefinition, ProcedureStep } from '../contracts/content';
import { getProcedure } from '../data/procedures';
import type { EngineCtx } from './types';
import type { EffectsHandle } from './scenario/effects';

export interface ProceduresHandle {
  start(procedureId: string, site?: string): void;
  advance(stepId: string, skipped?: boolean): void;
  abort(): void;
  contaminate(what: string): void;
  getRuntime(): ProcedureRuntime | null;
}

export function createProcedures(ctx: EngineCtx, effects: EffectsHandle): ProceduresHandle {
  let runtime: ProcedureRuntime | null = null;
  let def: ProcedureDefinition | null = null;
  const skippedIds = new Set<string>();
  const rng = ctx.rng.complications;

  function toRuntimeStep(step: ProcedureStep, index: number): ProcedureRuntimeStep {
    return {
      id: step.id,
      prompt: step.prompt,
      detail: step.detail,
      interaction: step.interaction,
      overlay: step.overlay,
      status: index === 0 ? 'active' : 'pending',
      skippable: step.skippable,
    };
  }

  function start(procedureId: string, site?: string): void {
    if (runtime) return; // one procedure at a time
    const definition = getProcedure(procedureId);
    if (!definition) {
      ctx.emit({ type: 'PlayerAction', action: 'StartProcedure', detail: `unknown ${procedureId}` });
      return;
    }
    def = definition;
    skippedIds.clear();
    const chosenSite = site && definition.siteOptions.includes(site) ? site : definition.siteOptions[0];
    runtime = {
      procedureId: definition.id,
      name: definition.name,
      site: chosenSite,
      sterile: definition.sterile,
      contaminated: false,
      startedAt: ctx.now(),
      stepIndex: 0,
      steps: definition.steps.map(toRuntimeStep),
      definition,
    };
    ctx.emit({ type: 'ProcedureStarted', procedureId: definition.id, name: definition.name, site: chosenSite });
  }

  function rollComplications(step: ProcedureStep): void {
    if (!runtime) return;
    for (const comp of step.complications) {
      let prob = comp.baseProb;
      for (const mod of comp.probIfSkipped) {
        if (skippedIds.has(mod.stepId)) prob *= mod.mult;
      }
      // seeded stream: consumption order is deterministic per advance call
      if (!rng.chance(Math.min(prob, 1))) continue;
      ctx.emit({
        type: 'ProcedureComplication',
        procedureId: runtime.procedureId,
        complicationId: comp.id,
        label: comp.label,
      });
      for (const effect of comp.effects) effects.apply(effect, runtime.site);
    }
  }

  function advance(stepId: string, skipped = false): void {
    if (!runtime || !def) return;
    const idx = runtime.stepIndex;
    const runtimeStep = runtime.steps[idx];
    const stepDef = def.steps[idx];
    if (!runtimeStep || !stepDef || runtimeStep.id !== stepId) {
      ctx.emit({ type: 'PlayerAction', action: 'AdvanceProcedureStep', detail: `out of order: ${stepId}` });
      return;
    }
    const actuallySkipped = skipped && stepDef.skippable; // non-skippables must be done
    runtimeStep.status = actuallySkipped ? 'skipped' : 'done';
    if (actuallySkipped) skippedIds.add(stepId);
    ctx.emit({
      type: 'ProcedureStepCompleted',
      procedureId: runtime.procedureId,
      stepId,
      prompt: stepDef.prompt,
      skipped: actuallySkipped,
    });
    if (!actuallySkipped) {
      for (const effect of stepDef.effects) effects.apply(effect, runtime.site);
      rollComplications(stepDef);
    }

    runtime.stepIndex += 1;
    if (runtime.stepIndex < runtime.steps.length) {
      runtime.steps[runtime.stepIndex].status = 'active';
      return;
    }

    // final step done -> completion
    for (const effect of def.completionEffects) effects.apply(effect, runtime.site);
    ctx.emit({
      type: 'ProcedureCompleted',
      procedureId: runtime.procedureId,
      name: runtime.name,
      durationS: Math.round((ctx.now() - runtime.startedAt) * 10) / 10,
    });
    runtime = null;
    def = null;
  }

  function abort(): void {
    if (!runtime) return;
    ctx.emit({ type: 'ProcedureAborted', procedureId: runtime.procedureId });
    runtime = null;
    def = null;
  }

  function contaminate(what: string): void {
    if (!runtime || !def || !def.sterile || runtime.contaminated) return;
    // only matters once a sterile field exists (a gown/glove-ish step is done)
    const fieldUp = runtime.steps.some(
      (s) => s.status === 'done' && /gown|glove|drape|sterile/i.test(s.id),
    );
    if (!fieldUp) return;
    runtime.contaminated = true;
    // consequences are a medical-pass hook (SPEC §9.2) — event only for now
    ctx.emit({ type: 'SterileFieldContaminated', procedureId: runtime.procedureId, what });
  }

  return {
    start,
    advance,
    abort,
    contaminate,
    getRuntime: () => runtime,
  };
}
