import { defineDrug } from '../../contracts/content';

// TODO(MEDICAL): opioid exemplar (sedation + respiratory depression) — placeholder numbers.
export const fentanyl = defineDrug({
  id: 'fentanyl',
  name: 'fentanyl',
  class: 'opioid',
  todoMedical:
    'Real opioid PD: analgesia vs sedation vs respiratory depression dissociation, chest-wall rigidity at high push doses, tolerance; placeholder respDrive/sedation Hill curves.',
  concentration: { amount: 100, unit: 'mcg', volumeMl: 2 },
  bolus: { doseUnit: 'mcg', min: 25, max: 200, default: 50, pushS: 10 },
  infusion: { doseUnit: 'mcg/hr', min: 25, max: 200, default: 50, step: 25 },
  pk: { onsetS: 60, offsetS: 900, refDose: 100 },
  effects: [
    { param: 'sedation', mode: 'add', potency: 0.35, ec50: 0.8, hillN: 1 },
    { param: 'respDrive', mode: 'add', potency: -0.5, ec50: 0.9, hillN: 1.3 },
  ],
});
