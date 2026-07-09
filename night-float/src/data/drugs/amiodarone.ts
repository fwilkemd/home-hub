import { defineDrug } from '../../contracts/content';

// TODO(MEDICAL): antiarrhythmic exemplar (probabilistic rhythm conversion) — placeholder numbers.
export const amiodarone = defineDrug({
  id: 'amiodarone',
  name: 'amiodarone',
  class: 'antiarrhythmic',
  todoMedical:
    'Real class III kinetics: load-then-drip dosing, conversion probabilities per rhythm/duration, hypotension with fast pushes, QT effects; placeholder probPerMin conversion + mild svr/chronotropy dips.',
  concentration: { amount: 150, unit: 'mg', volumeMl: 100 },
  bolus: { doseUnit: 'mg', min: 150, max: 300, default: 150, pushS: 120 },
  infusion: { doseUnit: 'mg/min', min: 0.5, max: 1, default: 1, step: 0.5 },
  pk: { onsetS: 120, offsetS: 1800, refDose: 150 },
  effects: [
    { param: 'chronotropy', mode: 'add', potency: -10, ec50: 1, hillN: 1 }, // bpm
    { param: 'svr', mode: 'add', potency: -0.05, ec50: 1, hillN: 1 },
  ],
  rhythmEffects: [{ from: ['afib', 'vt'], to: 'sinus', probPerMin: 0.25, minCe: 0.4 }],
});
