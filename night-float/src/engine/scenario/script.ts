/**
 * Scenario runtime (SPEC §5.5): scripted events (at-time / when-predicate,
 * fire once), end conditions, duration limit, and the tutorial step tracker.
 */
import type { TutorialView } from '../../contracts/runtime';
import type { EngineCtx } from '../types';
import type { EffectsHandle } from './effects';
import { createPredicateState, evalPredicate, type PredicateCtx } from './predicate';

export interface ScenarioRuntimeHandle {
  /** fire due scripted events — call early in the tick (before physiology) */
  tickScripts(t: number, dt: number): void;
  /** end conditions + duration limit + tutorial — call late in the tick */
  tickEnd(t: number, dt: number): void;
  getTutorialView(): TutorialView | null;
  serialize(): { fired: string[]; tutorialIndex: number };
  restore(state: { fired: string[]; tutorialIndex: number }): void;
}

export function createScenarioRuntime(
  ctx: EngineCtx,
  effects: EffectsHandle,
): ScenarioRuntimeHandle {
  const fired = new Set<string>();
  const predState = createPredicateState();
  let tutorialIndex = 0;

  function pctx(t: number): PredicateCtx {
    return {
      vitals: ctx.patient.vitals,
      physiology: ctx.patient.physiology,
      elapsed: t,
      events: ctx.log.all(),
    };
  }

  function tickScripts(t: number, dt: number): void {
    const pc = pctx(t);
    for (const ev of ctx.scenario.scriptedEvents) {
      if (fired.has(ev.id)) continue;
      const timeDue = ev.at !== undefined && t >= ev.at;
      // `when` predicates are evaluated every tick (sustained accumulators
      // must advance) even if the time trigger also exists.
      const predDue = ev.when !== undefined && evalPredicate(ev.when, pc, predState, dt);
      if (!timeDue && !predDue) continue;
      fired.add(ev.id);
      if (ev.dropToRealtime) ctx.dropToRealtime('scenario event');
      ctx.emit({ type: 'ScenarioScriptedEvent', scriptId: ev.id, label: ev.label });
      for (const action of ev.actions) effects.applyScriptAction(action, ev.id);
    }
  }

  function tickEnd(t: number, dt: number): void {
    const pc = pctx(t);

    // tutorial first: its markers can satisfy end conditions the same tick
    const tutorial = ctx.scenario.tutorial;
    if (tutorialIndex < tutorial.length) {
      const step = tutorial[tutorialIndex];
      if (evalPredicate(step.doneWhen, pc, predState, dt)) {
        tutorialIndex++;
        ctx.emit({ type: 'ScenarioScriptedEvent', scriptId: `tutorial-${step.id}` });
      }
    }

    // evaluate EVERY end condition every tick (sustained accumulators), then
    // honor the first true one in authoring order.
    let winner: (typeof ctx.scenario.endConditions)[number] | null = null;
    for (const cond of ctx.scenario.endConditions) {
      const hit = evalPredicate(cond.when, pctx(t), predState, dt);
      if (hit && !winner) winner = cond;
    }
    if (winner) {
      ctx.endScenario(winner.outcome, winner.summary);
      return;
    }

    const limit = ctx.scenario.durationLimitS;
    if (limit !== undefined && t >= limit) {
      ctx.endScenario('timeout', 'Time limit reached — the day team takes over.');
    }
  }

  function getTutorialView(): TutorialView | null {
    const tutorial = ctx.scenario.tutorial;
    if (tutorial.length === 0) return null;
    return {
      stepIndex: tutorialIndex,
      total: tutorial.length,
      text: tutorialIndex < tutorial.length ? tutorial[tutorialIndex].text : null,
    };
  }

  return {
    tickScripts,
    tickEnd,
    getTutorialView,
    serialize: () => ({ fired: [...fired], tutorialIndex }),
    restore: (state) => {
      fired.clear();
      for (const id of state.fired) fired.add(id);
      tutorialIndex = state.tutorialIndex;
      // NOTE: `sustained` accumulators restart at 0 after a load — stability
      // clocks re-arm rather than resuming mid-count (slice-level save).
    },
  };
}
