import { describe, expect, it } from 'vitest';
import {
  advanceCe,
  doseRateToMlHr,
  effectMagnitude,
  mlHrToDoseRate,
} from '../../src/engine/pharmacology/kinetics';
import { getDrug } from '../../src/data/drugs';

function drug(id: string) {
  const d = getDrug(id);
  if (!d) throw new Error(`missing drug ${id}`);
  return d;
}

describe('infusion math', () => {
  it('weight-based mcg/kg/min converts to pump ml/hr', () => {
    // norepi 8mg/250ml = 32 mcg/ml; 0.1 mcg/kg/min @ 80kg = 480 mcg/hr = 15 ml/hr
    expect(doseRateToMlHr(drug('norepinephrine'), 0.1, 80)).toBe(15);
  });

  it('non-weight mg/min converts to pump ml/hr', () => {
    // amio 150mg/100ml = 1.5 mg/ml; 1 mg/min = 60 mg/hr = 40 ml/hr
    expect(doseRateToMlHr(drug('amiodarone'), 1, 70)).toBe(40);
  });

  it('mcg/hr converts to pump ml/hr', () => {
    // fentanyl 100mcg/2ml = 50 mcg/ml; 50 mcg/hr = 1 ml/hr
    expect(doseRateToMlHr(drug('fentanyl'), 50, 70)).toBe(1);
  });

  it('volumetric drugs pass ml rates straight through', () => {
    expect(doseRateToMlHr(drug('lactated-ringers'), 125, 70)).toBe(125);
  });

  it('mlHrToDoseRate inverts doseRateToMlHr', () => {
    const norepi = drug('norepinephrine');
    const mlHr = doseRateToMlHr(norepi, 0.12, 70);
    expect(mlHrToDoseRate(norepi, mlHr, 70)).toBeCloseTo(0.12, 4);
  });

  it('ce approaches the infusion steady state with the onset time constant', () => {
    let ce = 0;
    const dt = 0.1;
    for (let t = 0; t < 45 * 5; t += dt) ce = advanceCe(ce, 1, dt, 45, 120);
    expect(ce).toBeGreaterThan(0.98);
    expect(ce).toBeLessThanOrEqual(1);
  });

  it('ce decays toward zero with the offset time constant after stopping', () => {
    let ce = 1;
    const dt = 0.1;
    for (let t = 0; t < 120; t += dt) ce = advanceCe(ce, 0, dt, 45, 120);
    expect(ce).toBeCloseTo(Math.exp(-1), 1); // one offset tau => ~36.8%
  });

  it('effect magnitude follows the Hill curve', () => {
    const effect = { param: 'svr', mode: 'add' as const, potency: 0.4, ec50: 0.8, hillN: 1 };
    expect(effectMagnitude(effect, 0)).toBe(0);
    expect(effectMagnitude(effect, 0.8)).toBeCloseTo(0.2, 6); // ce = ec50 => half potency
    expect(effectMagnitude(effect, 1e6)).toBeCloseTo(0.4, 3); // saturates at potency
  });
});
