import { defineDrug } from '../../contracts/content';

// TODO(MEDICAL): paralytic exemplar (weight-based bolus, paralysis then wear-off) — placeholder numbers.
export const rocuronium = defineDrug({
  id: 'rocuronium',
  name: 'rocuronium',
  class: 'paralytic',
  todoMedical:
    'Real NMB: onset ~60-90s, duration 30-60 min, train-of-four depth, no sedation/analgesia of its own (must pair with sedative); placeholder steep Hill on paralysis.',
  concentration: { amount: 100, unit: 'mg', volumeMl: 10 }, // 10 mg/ml
  bolus: { doseUnit: 'mg/kg', min: 0.6, max: 1.2, default: 1, pushS: 10 },
  pk: { onsetS: 50, offsetS: 2100, refDose: 1 }, // ce=1 at 1 mg/kg
  effects: [
    // steep: near-full paralysis at intubating dose, releases as ce decays
    { param: 'paralysis', mode: 'add', potency: 1.0, ec50: 0.35, hillN: 3 },
  ],
  notes: 'paralysis >= 0.9 stops spontaneous breathing (respiratory stub).',
});
