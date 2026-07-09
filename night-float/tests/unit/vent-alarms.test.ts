import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine';
import { getScenario } from '../../src/data/scenarios';
import { getProcedure } from '../../src/data/procedures';
import type { EngineHandle } from '../../src/contracts/runtime';

function intubated(): EngineHandle {
  const engine = createEngine(getScenario('crashing')!);
  engine.stepSim(10);
  engine.dispatch({ type: 'StartProcedure', procedureId: 'ett', site: 'oral' });
  for (const s of getProcedure('ett')!.steps) {
    engine.dispatch({ type: 'AdvanceProcedureStep', stepId: s.id });
  }
  engine.stepSim(5);
  return engine;
}

describe('vent behaviors (SPEC acceptance: settings change curves + alarms fire)', () => {
  it('intubation connects the vent and lights up capno', () => {
    const engine = intubated();
    const wave = engine.getVentWave();
    expect(wave.connected).toBe(true);
    expect(wave.standby).toBe(false);
    expect(engine.getWaveformParams().capno.present).toBe(true);
  });

  it('vent settings change the lung-model curves', () => {
    const engine = intubated();
    const before = engine.getVentWave();
    engine.dispatch({ type: 'SetVent', settings: { setVtMl: 700, peep: 12 } });
    engine.stepSim(6);
    const after = engine.getVentWave();
    expect(after.targetVtMl).toBe(700);
    expect(after.peep).toBe(12);
    expect(after.ppeak).toBeGreaterThan(before.ppeak);
  });

  it('high tidal volume trips the airway-pressure alarm', () => {
    const engine = intubated();
    engine.dispatch({ type: 'SetVent', settings: { setVtMl: 800 } });
    // stiffen the lungs so pressure spikes (scenario script path would ramp this)
    engine.getPatient().physiology.lungComplianceMlPerCmH2o = 14;
    engine.stepSim(20); // > debounce
    const alarms = engine.getActiveAlarms();
    expect(alarms.some((a) => a.id === 'vent-ppeak-hi' && a.active)).toBe(true);
    const raised = engine.getLog().find((e) => e.type === 'AlarmRaised' && e.alarmId === 'vent-ppeak-hi');
    expect(raised).toBeDefined();
  });

  it('silencing parks the alarm until the window expires', () => {
    const engine = intubated();
    engine.dispatch({ type: 'SetVent', settings: { setVtMl: 800 } });
    engine.getPatient().physiology.lungComplianceMlPerCmH2o = 14;
    engine.stepSim(20);
    engine.dispatch({ type: 'SilenceAlarm', alarmId: 'vent-ppeak-hi', durationS: 120 });
    const a = engine.getActiveAlarms().find((x) => x.id === 'vent-ppeak-hi')!;
    expect(a.silencedUntil).toBeGreaterThan(engine.getSimTime());
    engine.stepSim(130);
    const b = engine.getActiveAlarms().find((x) => x.id === 'vent-ppeak-hi')!;
    expect(b.silencedUntil).toBeLessThanOrEqual(engine.getSimTime());
  });
});
