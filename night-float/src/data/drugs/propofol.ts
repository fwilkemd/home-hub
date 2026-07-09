import { defineDrug } from '../../contracts/content';

// TODO(MEDICAL): sedative exemplar (bolus + infusion, hypotension side effect) — placeholder numbers.
export const propofol = defineDrug({
  id: 'propofol',
  name: 'propofol',
  class: 'sedative',
  todoMedical:
    'Real TCI-style PK (context-sensitive half-time), sedation depth scale (RASS), dose-dependent vasodilation/myocardial depression, apnea at induction doses; placeholder Hill curves.',
  concentration: { amount: 1000, unit: 'mg', volumeMl: 100 }, // 10 mg/ml
  bolus: { doseUnit: 'mg', min: 20, max: 200, default: 50, pushS: 15 },
  infusion: { doseUnit: 'mcg/kg/min', min: 5, max: 80, default: 30, step: 5 },
  pk: { onsetS: 30, offsetS: 300, refDose: 40 }, // refDose doubles for bolus mg + rate; TODO via todoMedical
  effects: [
    { param: 'sedation', mode: 'add', potency: 1.0, ec50: 0.5, hillN: 1.4 },
    { param: 'svr', mode: 'add', potency: -0.15, ec50: 0.8, hillN: 1 },
    { param: 'contractility', mode: 'add', potency: -0.08, ec50: 1, hillN: 1 },
    { param: 'respDrive', mode: 'add', potency: -0.35, ec50: 0.7, hillN: 1.2 },
  ],
});
