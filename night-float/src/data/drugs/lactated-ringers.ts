import { defineDrug } from '../../contracts/content';

/** Crystalloid fluid exemplar — dosed in ml, bolus only. Placeholders. */
export const lactatedRingers = defineDrug({
  id: 'lactated-ringers',
  name: 'lactated Ringer’s',
  class: 'fluid',
  todoMedical:
    'Real volume kinetics: intravascular retention/redistribution over hours, dilution of Hgb/electrolytes, pulmonary edema risk when overloaded; placeholder saturating volumeStatus bump with a long offset.',
  concentration: { amount: 1000, unit: 'ml', volumeMl: 1000 },
  bolus: {
    doseUnit: 'ml',
    min: 250,
    max: 2000,
    default: 1000,
    pushS: 60, // TODO(MEDICAL) via todoMedical: a real 1L bolus runs 15-30+ min
  },
  pk: { onsetS: 60, offsetS: 3600, refDose: 1000 }, // ce=1 per liter
  effects: [
    // diminishing returns as ce (liters given) climbs
    { param: 'volumeStatus', mode: 'add', potency: 0.6, ec50: 3, hillN: 1 },
  ],
});
