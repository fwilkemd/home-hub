import { defineDrug } from '../../contracts/content';

// TODO(MEDICAL): pressor exemplar — every number below is a placeholder (see todoMedical).
export const norepinephrine = defineDrug({
  id: 'norepinephrine',
  name: 'norepinephrine',
  class: 'pressor',
  todoMedical:
    'Real alpha/beta agonism: dose-dependent SVR + inotropy + chronotropy, reflex effects, extravasation risk; placeholder Hill curves on svr/contractility.',
  concentration: { amount: 8, unit: 'mg', volumeMl: 250 }, // 32 mcg/ml
  infusion: { doseUnit: 'mcg/kg/min', min: 0.01, max: 1, default: 0.05, step: 0.02 },
  pk: { onsetS: 45, offsetS: 120, refDose: 0.1 }, // ce=1 at 0.1 mcg/kg/min
  effects: [
    { param: 'svr', mode: 'add', potency: 0.35, ec50: 0.8, hillN: 1.2 },
    { param: 'contractility', mode: 'add', potency: 0.1, ec50: 1, hillN: 1 },
    { param: 'chronotropy', mode: 'add', potency: 6, ec50: 1.2, hillN: 1 }, // bpm
  ],
  notes: 'MAP response emerges from svr/contractility in the hemodynamics stub.',
});
