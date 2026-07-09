import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine';
import { defineScenario } from '../../src/contracts/content';
import { PHYSIOLOGY_DEFAULTS } from '../../src/contracts/patient';
import { isEvent } from '../../src/contracts/events';

function rhythmScenario() {
  return defineScenario({
    id: 'rhythm-test',
    title: 'Rhythm test',
    seed: 77,
    briefing: { oneLiner: 'x', hpi: 'y', background: 'z' },
    initialPatient: {
      id: 'pt-r',
      demographics: { name: 'R', age: 60, sex: 'M', weightKg: 80 },
      vitals: { hr: 80, rhythm: 'sinus', spo2: 97, rr: 16, map: 82, sbp: 118, dbp: 64, tempC: 37 },
      physiology: { ...PHYSIOLOGY_DEFAULTS },
      devices: { monitor: {}, vent: {}, pumps: [{ id: 'ch-1' }] },
    },
    scriptedEvents: [
      { id: 'go-afib', at: 5, actions: [{ type: 'setRhythm', rhythm: 'afib' }] },
    ],
  });
}

describe('rhythm machine', () => {
  it('scenario setRhythm transitions and emits RhythmChanged', () => {
    const engine = createEngine(rhythmScenario());
    engine.stepSim(10);
    const change = engine.getLog().find((e) => isEvent(e, 'RhythmChanged'));
    expect(change && isEvent(change, 'RhythmChanged') && change.from).toBe('sinus');
    expect(change && isEvent(change, 'RhythmChanged') && change.to).toBe('afib');
    expect(engine.getVitals().rhythm).toBe('afib');
    // afib rate override kicks the HR up over baseline
    expect(engine.getVitals().hr).toBeGreaterThan(85);
  });

  it('amiodarone converts afib back to sinus (seeded, deterministic)', () => {
    function conversionTime(): number | null {
      const engine = createEngine(rhythmScenario());
      engine.stepSim(10);
      engine.dispatch({
        type: 'PlaceOrder',
        draft: {
          kind: 'med',
          drugId: 'amiodarone',
          mode: 'bolus',
          dose: 300,
          doseUnit: 'mg',
          route: 'iv_push',
          label: 'amiodarone 300 mg IV',
        },
      });
      for (let i = 0; i < 180 && !engine.isEnded(); i++) {
        engine.stepSim(10);
        const conv = engine
          .getLog()
          .find((e) => isEvent(e, 'RhythmChanged') && e.to === 'sinus');
        if (conv) return conv.t;
      }
      return null;
    }
    const t1 = conversionTime();
    expect(t1).not.toBeNull();
    expect(t1!).toBeGreaterThan(10); // only after the bolus lands
    expect(conversionTime()).toBe(t1); // deterministic replay
  });
});
