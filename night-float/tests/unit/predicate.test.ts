import { describe, expect, it } from 'vitest';
import {
  createPredicateState,
  evalPredicate,
  type PredicateCtx,
} from '../../src/engine/scenario/predicate';
import type { Predicate } from '../../src/contracts/content';
import type { SimEvent } from '../../src/contracts/events';
import type { VitalSigns } from '../../src/contracts/patient';

function vitals(map: number): VitalSigns {
  return { hr: 80, rhythm: 'sinus', spo2: 96, rr: 16, map, sbp: 110, dbp: 60, tempC: 37 };
}

function ctx(map: number, elapsed = 0, events: SimEvent[] = []): PredicateCtx {
  return { vitals: vitals(map), physiology: { svr: 0.5 }, elapsed, events };
}

describe('predicate evaluator', () => {
  it('sustained becomes true only after N continuous seconds', () => {
    const state = createPredicateState();
    const p: Predicate = { type: 'sustained', path: 'map', op: 'lt', value: 40, seconds: 5 };
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) results.push(evalPredicate(p, ctx(35, i), state, 1));
    // true only once 5 continuous seconds have accumulated
    expect(results).toEqual([false, false, false, false, true, true]);
  });

  it('sustained resets when the condition breaks', () => {
    const state = createPredicateState();
    const p: Predicate = { type: 'sustained', path: 'map', op: 'lt', value: 40, seconds: 3 };
    expect(evalPredicate(p, ctx(35), state, 1)).toBe(false); // 1s
    expect(evalPredicate(p, ctx(35), state, 1)).toBe(false); // 2s
    expect(evalPredicate(p, ctx(80), state, 1)).toBe(false); // break -> reset
    expect(evalPredicate(p, ctx(35), state, 1)).toBe(false); // 1s again
    expect(evalPredicate(p, ctx(35), state, 1)).toBe(false); // 2s
    expect(evalPredicate(p, ctx(35), state, 1)).toBe(true); // 3s
  });

  it('sustained inside and[] keeps accumulating while siblings are false', () => {
    const state = createPredicateState();
    const p: Predicate = {
      type: 'and',
      conditions: [
        { type: 'elapsed', op: 'gt', seconds: 100 },
        { type: 'sustained', path: 'map', op: 'lt', value: 40, seconds: 3 },
      ],
    };
    // elapsed still short — and is false, but the sustained arm accumulates
    expect(evalPredicate(p, ctx(35, 50), state, 1)).toBe(false);
    expect(evalPredicate(p, ctx(35, 51), state, 1)).toBe(false);
    expect(evalPredicate(p, ctx(35, 52), state, 1)).toBe(false); // 3s banked
    // the moment elapsed clears, the whole predicate is true (no restart)
    expect(evalPredicate(p, ctx(35, 101), state, 1)).toBe(true);
  });

  it('vital, physiology, elapsed, or, not', () => {
    const state = createPredicateState();
    expect(evalPredicate({ type: 'vital', path: 'map', op: 'lt', value: 65 }, ctx(60), state, 1)).toBe(true);
    expect(evalPredicate({ type: 'physiology', param: 'svr', op: 'gte', value: 0.5 }, ctx(80), state, 1)).toBe(true);
    expect(evalPredicate({ type: 'elapsed', op: 'lt', seconds: 10 }, ctx(80, 5), state, 1)).toBe(true);
    expect(
      evalPredicate(
        {
          type: 'or',
          conditions: [
            { type: 'vital', path: 'map', op: 'lt', value: 10 },
            { type: 'vital', path: 'hr', op: 'gt', value: 70 },
          ],
        },
        ctx(80),
        state,
        1,
      ),
    ).toBe(true);
    expect(
      evalPredicate(
        { type: 'not', condition: { type: 'vital', path: 'map', op: 'lt', value: 10 } },
        ctx(80),
        state,
        1,
      ),
    ).toBe(true);
  });

  it('eventOccurred with where and withinLastS', () => {
    const state = createPredicateState();
    const events: SimEvent[] = [
      {
        t: 10,
        seq: 0,
        type: 'MedAdministered',
        drugId: 'norepinephrine',
        drugName: 'norepinephrine',
        dose: 8,
        unit: 'mcg',
        route: 'iv_push',
        by: 'nurse',
      },
    ];
    const base: Predicate = { type: 'eventOccurred', eventType: 'MedAdministered' };
    expect(evalPredicate(base, ctx(80, 100, events), state, 1)).toBe(true);
    expect(
      evalPredicate(
        { ...base, where: { drugId: 'norepinephrine' } },
        ctx(80, 100, events),
        state,
        1,
      ),
    ).toBe(true);
    expect(
      evalPredicate({ ...base, where: { drugId: 'propofol' } }, ctx(80, 100, events), state, 1),
    ).toBe(false);
    expect(evalPredicate({ ...base, withinLastS: 50 }, ctx(80, 100, events), state, 1)).toBe(false);
    expect(evalPredicate({ ...base, withinLastS: 95 }, ctx(80, 100, events), state, 1)).toBe(true);
  });
});
