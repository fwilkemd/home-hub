/**
 * Lab value generator registry (SPEC §5.4). Lab panel content in
 * /src/data/labs references these by the `generator` key. EVERY function here
 * is a medical-pass stub: plausible noise around scenario-flavored anchors
 * plus crude state coupling. Scenarios can steer anchors by setting
 * physiology params named `<generator>Anchor` (e.g. { kAnchor: 5.1 }).
 */
import type { PatientState } from '../../contracts/patient';
import type { Rng } from '../rng';
import { clamp, clamp01 } from '../types';

export type LabGenerator = (
  patient: PatientState,
  effective: Record<string, number>,
  rng: Rng,
) => number;

function anchor(patient: PatientState, id: string, fallback: number): number {
  return patient.physiology[`${id}Anchor`] ?? fallback;
}

/** Deterministic lactate core shared by the lactate + gas generators.
 * TODO(MEDICAL): lactate kinetics = production (hypoperfusion) - clearance. */
function lactateOf(patient: PatientState, eff: Record<string, number>): number {
  const map = patient.vitals.map;
  const volume = clamp01(eff['volumeStatus'] ?? 0.5);
  const base = anchor(patient, 'lactate', 1.1);
  const hypoperfusion = Math.max(0, 68 - map) * 0.14 + Math.max(0, 0.35 - volume) * 3;
  return clamp(base + hypoperfusion, 0.4, 18);
}

/** Effective FiO2 mirrors the respiratory stub. TODO(MEDICAL). */
function fio2Of(patient: PatientState, eff: Record<string, number>): number {
  const vent = patient.devices.vent;
  if (vent.connected && !vent.standby) return vent.fio2;
  return clamp(eff['fio2'] ?? 0.21, 0.21, 1);
}

export const labGenerators: Record<string, LabGenerator> = {
  // ---- CBC --------------------------------------------------------------
  // TODO(MEDICAL): WBC kinetics with infection/steroids; placeholder fever tie.
  wbc: (p, e, rng) =>
    clamp(anchor(p, 'wbc', 8.5) + Math.max(0, p.vitals.tempC - 37.2) * 2 + rng.gauss() * 0.7, 1, 60),
  // TODO(MEDICAL): dilution vs blood loss; placeholder volume dilution only.
  hgb: (p, e, rng) =>
    clamp(anchor(p, 'hgb', 12.5) * (1 - 0.3 * Math.max(0, (e['volumeStatus'] ?? 0.5) - 0.5)) + rng.gauss() * 0.25, 3, 22),
  // TODO(MEDICAL): hct tracks hgb x3 as a placeholder.
  hct: (p, e, rng) => clamp(labGenerators.hgb(p, e, rng) * 3 + rng.gauss() * 0.5, 9, 65),
  plt: (p, _e, rng) => clamp(anchor(p, 'plt', 230) + rng.gauss() * 14, 5, 900),

  // ---- BMP --------------------------------------------------------------
  na: (p, _e, rng) => clamp(anchor(p, 'na', 138) + rng.gauss() * 1.4, 110, 175),
  // TODO(MEDICAL): K shifts with acidosis/insulin; crude lactate bump.
  k: (p, e, rng) =>
    clamp(anchor(p, 'k', 4.0) + (lactateOf(p, e) > 4 ? 0.3 : 0) + rng.gauss() * 0.18, 1.8, 9),
  cl: (p, _e, rng) => clamp(anchor(p, 'cl', 103) + rng.gauss() * 1.4, 80, 130),
  // TODO(MEDICAL): bicarbonate consumed by lactate 1:1-ish placeholder.
  tco2: (p, e, rng) => clamp(24 - (lactateOf(p, e) - 1) * 1.6 + rng.gauss() * 0.8, 6, 40),
  bun: (p, e, rng) =>
    clamp(anchor(p, 'bun', 17) + Math.max(0, 60 - p.vitals.map) * 0.15 + rng.gauss() * 1.2, 3, 140),
  // TODO(MEDICAL): creatinine should lag hypotension by hours, not track it.
  cr: (p, e, rng) =>
    clamp(anchor(p, 'cr', 1.0) * (1 + Math.max(0, 62 - p.vitals.map) * 0.012) + rng.gauss() * 0.06, 0.3, 12),
  glucose: (p, e, rng) =>
    clamp(anchor(p, 'glucose', 126) + Math.max(0, 66 - p.vitals.map) * 0.8 + rng.gauss() * 8, 30, 700),

  // ---- gases ------------------------------------------------------------
  // TODO(MEDICAL): pH from full acid-base (anion gap, resp compensation).
  ph: (p, e, rng) => {
    const paco2 = labGenerators.paco2(p, e, rng);
    return clamp(7.4 - (lactateOf(p, e) - 1) * 0.028 - (paco2 - 40) * 0.006 + rng.gauss() * 0.008, 6.7, 7.75);
  },
  // TODO(MEDICAL): PaCO2 from alveolar ventilation; crude RR inverse.
  paco2: (p, _e, rng) => {
    const rr = Math.max(p.vitals.rr, 4);
    return clamp(40 * Math.pow(15 / rr, 0.7) + rng.gauss() * 1.5, 15, 110);
  },
  // TODO(MEDICAL): PaO2 from shunt equation; crude FiO2/shunt blend.
  pao2: (p, e, rng) => {
    const shunt = clamp01(e['shuntFraction'] ?? 0.05);
    const fio2 = fio2Of(p, e);
    return clamp(fio2 * 480 * (1 - shunt * 1.6) + rng.gauss() * 4, 30, 480);
  },
  hco3: (p, e, rng) => clamp(24 - (lactateOf(p, e) - 1) * 1.6 + rng.gauss() * 0.6, 5, 40),
  lactate: (p, e, rng) => clamp(lactateOf(p, e) + rng.gauss() * 0.15, 0.3, 20),

  // ---- cardiac / coags ----------------------------------------------------
  // TODO(MEDICAL): troponin rise/fall kinetics over hours post-injury.
  trop: (p, _e, rng) =>
    clamp(anchor(p, 'trop', 0.01) + Math.max(0, 58 - p.vitals.map) * 0.004 + Math.abs(rng.gauss()) * 0.004, 0, 40),
  inr: (p, e, rng) =>
    clamp(anchor(p, 'inr', 1.1) + (lactateOf(p, e) > 6 ? 0.3 : 0) + rng.gauss() * 0.05, 0.8, 9),
  ptt: (p, _e, rng) => clamp(anchor(p, 'ptt', 30) + rng.gauss() * 1.8, 18, 150),
};
