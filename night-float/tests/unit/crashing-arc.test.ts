import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine';
import { getScenario } from '../../src/data/scenarios';
import { getProcedure } from '../../src/data/procedures';

/**
 * The vertical-slice guarantee (SPEC §16 Phase 2): the crashing scenario's
 * success ending is reachable through the same commands the UI issues —
 * fluids + pressor + intubation + vent titration.
 */
describe('crashing scenario treatment arc', () => {
  it('reaches the success ending with standard treatment', () => {
    const scenario = getScenario('crashing')!;
    const engine = createEngine(scenario);

    engine.stepSim(320); // deterioration + MAP alarm
    engine.dispatch({
      type: 'PlaceOrder',
      draft: {
        kind: 'med',
        drugId: 'lactated-ringers',
        mode: 'bolus',
        dose: 1000,
        doseUnit: 'mL',
        route: 'iv_push',
        label: 'LR 1L',
      },
    });
    engine.dispatch({
      type: 'PlaceOrder',
      draft: {
        kind: 'med',
        drugId: 'norepinephrine',
        mode: 'infusion',
        rate: 0.25,
        rateUnit: 'mcg/kg/min',
        route: 'iv_infusion',
        label: 'norepi 0.25',
      },
    });
    engine.stepSim(180);
    engine.dispatch({ type: 'VerbalOrder', verbal: { kind: 'bolus_fluids', volumeMl: 1000 } });
    engine.stepSim(120);
    engine.dispatch({ type: 'StartProcedure', procedureId: 'ett', site: 'oral' });
    for (const s of getProcedure('ett')!.steps) {
      engine.dispatch({ type: 'AdvanceProcedureStep', stepId: s.id });
    }
    engine.dispatch({ type: 'SetVent', settings: { fio2: 1.0, peep: 10 } });
    engine.stepSim(600);

    expect(engine.isEnded()).toBe(true);
    const end = engine.getLog().find((e) => e.type === 'ScenarioEnded');
    expect(end && end.type === 'ScenarioEnded' && end.outcome).toBe('success');
    // capno lit up after intubation
    expect(engine.getVitals().etco2).toBeGreaterThan(20);
  });

  it('dies without treatment', () => {
    const scenario = getScenario('crashing')!;
    const engine = createEngine(scenario);
    engine.stepSim(1500);
    const end = engine.getLog().find((e) => e.type === 'ScenarioEnded');
    expect(end && end.type === 'ScenarioEnded' && end.outcome).toBe('death');
  });
});
