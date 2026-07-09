import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine';
import { getScenario } from '../../src/data/scenarios';

describe('engine save/restore', () => {
  it('round-trips mid-scenario state', () => {
    const scenario = getScenario('crashing')!;
    const a = createEngine(scenario);
    a.stepSim(320);
    a.dispatch({
      type: 'PlaceOrder',
      draft: {
        kind: 'med',
        drugId: 'norepinephrine',
        mode: 'infusion',
        rate: 0.15,
        rateUnit: 'mcg/kg/min',
        route: 'iv_infusion',
        label: 'norepi 0.15',
      },
    });
    a.dispatch({ type: 'PlaceOrder', draft: { kind: 'lab', panelId: 'lactate', stat: true, label: 'Lactate STAT' } });
    a.stepSim(120);

    const save = JSON.parse(JSON.stringify(a.serialize())); // localStorage round-trip
    const b = createEngine(scenario, { restore: save });

    // identity of the moment
    expect(b.getSimTime()).toBeCloseTo(a.getSimTime(), 5);
    expect(b.getVitals()).toEqual(a.getVitals());
    expect(b.getLog().length).toBe(a.getLog().length);
    expect(b.getPatient().infusions).toEqual(a.getPatient().infusions);

    // live alarms re-adopt their identity on the next tick without
    // re-announcing (no fresh AlarmRaised events for restored alarms)
    const activeA = a.getActiveAlarms().map((x) => x.id).sort();
    const raisedBefore = b.getLog().filter((e) => e.type === 'AlarmRaised').length;
    b.stepSim(0.1);
    const activeB = b.getActiveAlarms().map((x) => x.id).sort();
    expect(activeB).toEqual(activeA);
    const raisedAfter = b.getLog().filter((e) => e.type === 'AlarmRaised').length;
    expect(raisedAfter).toBe(raisedBefore);
    a.stepSim(0.1); // keep the twins in step for the drift check below

    // both runs keep simulating plausibly (noise streams restart, so allow drift)
    a.stepSim(60);
    b.stepSim(60);
    expect(Math.abs(a.getVitals().map - b.getVitals().map)).toBeLessThan(6);
    expect(Math.abs(a.getVitals().spo2 - b.getVitals().spo2)).toBeLessThan(4);

    // the pending stat lactate still results after restore
    b.stepSim(300);
    const lab = b.getLog().find((e) => e.type === 'LabResulted' && e.panelId === 'lactate');
    expect(lab).toBeDefined();
  });

  it('restores scripted-event progress (no double firing)', () => {
    const scenario = getScenario('crashing')!;
    const a = createEngine(scenario);
    a.stepSim(400); // deterioration scripts fired

    const b = createEngine(scenario, { restore: JSON.parse(JSON.stringify(a.serialize())) });
    b.stepSim(120); // later at-time scripts MAY legitimately fire now...
    const ids = b
      .getLog()
      .filter((e) => e.type === 'ScenarioScriptedEvent')
      .map((e) => (e as { scriptId: string }).scriptId);
    // ...but every script id fires at most once across the whole restored run
    expect(new Set(ids).size).toBe(ids.length);
  });
});
