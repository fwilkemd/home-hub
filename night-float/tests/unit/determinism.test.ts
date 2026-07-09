import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine';
import { getScenario } from '../../src/data/scenarios';
import type { SimCommand } from '../../src/contracts/commands';
import type { SimEvent } from '../../src/contracts/events';

/**
 * SPEC §4: given a seed, a scenario run with identical commands at identical
 * sim times must produce an identical event log.
 */

const SCRIPT: Array<[number, SimCommand]> = [
  [5, { type: 'PlaceOrder', draft: { kind: 'lab', panelId: 'lactate', stat: true, label: 'Lactate — STAT' } }],
  [10, { type: 'VerbalOrder', verbal: { kind: 'bolus_fluids', volumeMl: 1000 } }],
  [
    20,
    {
      type: 'PlaceOrder',
      draft: {
        kind: 'med',
        drugId: 'norepinephrine',
        mode: 'infusion',
        rate: 0.1,
        rateUnit: 'mcg/kg/min',
        route: 'iv_infusion',
        label: 'norepinephrine gtt 0.1 mcg/kg/min',
      },
    },
  ],
  [40, { type: 'PerformExam', zone: 'chest_left', mode: 'auscultate' }],
  [60, { type: 'SetVent', settings: { fio2: 0.8 } }],
  [80, { type: 'StartProcedure', procedureId: 'aline' }],
  [82, { type: 'AdvanceProcedureStep', stepId: 'position' }],
  [85, { type: 'AdvanceProcedureStep', stepId: 'prep' }],
  [88, { type: 'AdvanceProcedureStep', stepId: 'palpate', skipped: true }],
  [92, { type: 'AdvanceProcedureStep', stepId: 'puncture' }],
  [95, { type: 'AdvanceProcedureStep', stepId: 'advance' }],
  [98, { type: 'AdvanceProcedureStep', stepId: 'secure' }],
  [120, { type: 'SetTimeScale', scale: 8 }],
];

function run(seed?: number, untilS = 200): readonly SimEvent[] {
  const scenario = getScenario('crashing');
  if (!scenario) throw new Error('crashing scenario missing');
  const engine = createEngine(scenario, seed === undefined ? {} : { seed });
  let t = 0;
  for (const [at, cmd] of SCRIPT) {
    engine.stepSim(at - t);
    t = at;
    engine.dispatch(cmd);
  }
  engine.stepSim(untilS - t);
  return engine.getLog();
}

describe('engine determinism', () => {
  it('same seed + same command script => identical event log', () => {
    const a = run();
    const b = run();
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(a.length).toBeGreaterThan(30);
  });

  it('the run actually exercises the systems', () => {
    const log = run();
    const types = new Set(log.map((e) => e.type));
    expect(types.has('MedAdministered')).toBe(true); // fluids given
    expect(types.has('InfusionStarted')).toBe(true); // pressor hung
    expect(types.has('LabResulted')).toBe(true); // stat lactate back
    expect(types.has('LinePlaced')).toBe(true); // a-line completed
    expect(types.has('ProcedureCompleted')).toBe(true);
    expect(types.has('VentSettingsChanged')).toBe(true);
    expect(types.has('VitalsSnapshot')).toBe(true);
    expect(types.has('NurseAction')).toBe(true);
  });

  it('a different seed diverges somewhere', () => {
    const a = run();
    const b = run(987654321);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});
