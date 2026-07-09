/**
 * Lab panel definitions. Reference ranges and turnarounds are placeholders;
 * `generator` keys map into src/engine/labs/generators.ts (all TODO(MEDICAL)).
 */
import { defineLabPanel } from '../../contracts/content';

export const cbc = defineLabPanel({
  id: 'cbc',
  name: 'CBC',
  turnaroundS: 900,
  statTurnaroundS: 420,
  todoMedical: 'Real CBC behavior: differential, acute blood loss lag, hemoconcentration.',
  tests: [
    { id: 'wbc', name: 'WBC', unit: 'K/uL', refLo: 4, refHi: 11, critHi: 30, generator: 'wbc', precision: 1 },
    { id: 'hgb', name: 'Hgb', unit: 'g/dL', refLo: 12, refHi: 16, critLo: 7, generator: 'hgb', precision: 1 },
    { id: 'hct', name: 'Hct', unit: '%', refLo: 36, refHi: 48, critLo: 21, generator: 'hct', precision: 1 },
    { id: 'plt', name: 'Platelets', unit: 'K/uL', refLo: 150, refHi: 400, critLo: 50, generator: 'plt', precision: 0 },
  ],
});

export const bmp = defineLabPanel({
  id: 'bmp',
  name: 'BMP',
  turnaroundS: 1200,
  statTurnaroundS: 600,
  todoMedical: 'Real chemistry coupling: renal function kinetics, anion gap, fluid effects.',
  tests: [
    { id: 'na', name: 'Sodium', unit: 'mmol/L', refLo: 135, refHi: 145, critLo: 120, critHi: 160, generator: 'na', precision: 0 },
    { id: 'k', name: 'Potassium', unit: 'mmol/L', refLo: 3.5, refHi: 5.1, critLo: 2.5, critHi: 6.5, generator: 'k', precision: 1 },
    { id: 'cl', name: 'Chloride', unit: 'mmol/L', refLo: 98, refHi: 107, generator: 'cl', precision: 0 },
    { id: 'tco2', name: 'CO2', unit: 'mmol/L', refLo: 22, refHi: 29, critLo: 10, generator: 'tco2', precision: 0 },
    { id: 'bun', name: 'BUN', unit: 'mg/dL', refLo: 7, refHi: 20, generator: 'bun', precision: 0 },
    { id: 'cr', name: 'Creatinine', unit: 'mg/dL', refLo: 0.6, refHi: 1.2, critHi: 4, generator: 'cr', precision: 2 },
    { id: 'glucose', name: 'Glucose', unit: 'mg/dL', refLo: 70, refHi: 140, critLo: 40, critHi: 500, generator: 'glucose', precision: 0 },
  ],
});

export const abg = defineLabPanel({
  id: 'abg',
  name: 'ABG',
  poc: true,
  turnaroundS: 300,
  statTurnaroundS: 180,
  todoMedical: 'Real gas exchange: A-a gradient, acid-base compensation math.',
  tests: [
    { id: 'ph', name: 'pH', unit: '', refLo: 7.35, refHi: 7.45, critLo: 7.1, critHi: 7.6, generator: 'ph', precision: 2 },
    { id: 'paco2', name: 'PaCO2', unit: 'mmHg', refLo: 35, refHi: 45, critHi: 70, generator: 'paco2', precision: 0 },
    { id: 'pao2', name: 'PaO2', unit: 'mmHg', refLo: 75, refHi: 100, critLo: 50, generator: 'pao2', precision: 0 },
    { id: 'hco3', name: 'HCO3', unit: 'mmol/L', refLo: 22, refHi: 26, critLo: 10, generator: 'hco3', precision: 1 },
  ],
});

export const lactate = defineLabPanel({
  id: 'lactate',
  name: 'Lactate',
  poc: true,
  turnaroundS: 240,
  statTurnaroundS: 120,
  todoMedical: 'Real lactate kinetics: production under hypoperfusion, clearance with resuscitation.',
  tests: [
    { id: 'lactate', name: 'Lactate', unit: 'mmol/L', refLo: 0.5, refHi: 2.0, critHi: 4, generator: 'lactate', precision: 1 },
  ],
});

export const troponin = defineLabPanel({
  id: 'troponin',
  name: 'Troponin I',
  turnaroundS: 1500,
  statTurnaroundS: 900,
  todoMedical: 'Real troponin rise/fall over hours; demand vs ACS patterns.',
  tests: [
    { id: 'trop', name: 'Troponin I', unit: 'ng/mL', refLo: 0, refHi: 0.04, critHi: 0.5, generator: 'trop', precision: 2 },
  ],
});

export const coags = defineLabPanel({
  id: 'coags',
  name: 'Coags',
  turnaroundS: 1500,
  statTurnaroundS: 900,
  todoMedical: 'Real coagulation behavior: DIC trends, anticoagulant effects.',
  tests: [
    { id: 'inr', name: 'INR', unit: '', refLo: 0.9, refHi: 1.2, critHi: 5, generator: 'inr', precision: 1 },
    { id: 'ptt', name: 'PTT', unit: 's', refLo: 25, refHi: 35, critHi: 100, generator: 'ptt', precision: 0 },
  ],
});
