/**
 * Pure PK/PD math (SPEC §5.3) — kept side-effect free so tests can exercise
 * the numbers directly. The generic frame is machinery; every constant that
 * flows through it comes from /src/data/drugs.
 */
import type { DrugDefinition, DrugEffect } from '../../contracts/content';

/**
 * Advance a normalized effect-site level toward `target` (infusion steady
 * state, 0 once stopped). Rises with onsetS, decays with offsetS.
 * TODO(MEDICAL): real model wants plasma + effect-site compartments (ke0),
 * context-sensitive half-times, and nonlinear clearance where relevant.
 */
export function advanceCe(
  ce: number,
  target: number,
  dt: number,
  onsetS: number,
  offsetS: number,
): number {
  const tau = target > ce ? Math.max(onsetS, 0.1) : Math.max(offsetS, 0.1);
  return ce + (target - ce) * (1 - Math.exp(-dt / tau));
}

/**
 * Hill-shaped effect magnitude: potency * ce^n / (ce^n + ec50^n).
 * Negative potency yields negative magnitudes (inhibitory effects).
 * TODO(MEDICAL): placeholder frame — real PD curves per drug/effect.
 */
export function effectMagnitude(effect: DrugEffect, ce: number): number {
  if (ce <= 0) return 0;
  const n = effect.hillN;
  const cen = Math.pow(ce, n);
  const e50n = Math.pow(Math.max(effect.ec50, 1e-6), n);
  return (effect.potency * cen) / (cen + e50n);
}

/** '.../kg/...' anywhere in a dose unit means the dose is weight-based. */
export function isWeightBased(doseUnit: string): boolean {
  return /\/kg\b|\/kg\//.test(doseUnit);
}

/** Per-minute vs per-hour rate units (defaults to per-hour when unmarked). */
function perMinute(doseUnit: string): boolean {
  return /\/min\b/.test(doseUnit);
}

/** Leading mass/volume unit of a dose unit string, e.g. 'mcg/kg/min' -> 'mcg'. */
export function massUnitOf(doseUnit: string): string {
  return doseUnit.split('/')[0].trim();
}

/** Unit conversion factors into micrograms (volume 'ml' handled separately). */
const TO_MCG: Record<string, number> = { mcg: 1, ug: 1, mg: 1000, g: 1_000_000 };

/**
 * Convert an infusion dose rate (in the drug's infusion doseUnit) into pump
 * ml/hr using the drug's supplied concentration and patient weight.
 * Volume-dosed drugs (unit 'ml...') pass through directly.
 * TODO(MEDICAL): real version needs diluent/bag options and unit sanity table.
 */
export function doseRateToMlHr(drug: DrugDefinition, doseRate: number, weightKg: number): number {
  const unit = drug.infusion?.doseUnit ?? drug.bolus?.doseUnit ?? 'mg/hr';
  const mass = massUnitOf(unit);
  let amountPerHr = doseRate * (perMinute(unit) ? 60 : 1);
  if (isWeightBased(unit)) amountPerHr *= weightKg;
  if (mass === 'ml') return round2(amountPerHr); // volumetric drug (e.g. fluids)
  const massToMcg = TO_MCG[mass] ?? 1;
  const concAmountMcg = drug.concentration.amount * (TO_MCG[drug.concentration.unit] ?? 1);
  if (concAmountMcg <= 0) return 0;
  const mcgPerMl = concAmountMcg / Math.max(drug.concentration.volumeMl, 0.001);
  return round2((amountPerHr * massToMcg) / mcgPerMl);
}

/** Inverse of doseRateToMlHr — used when the player programs the pump in ml/hr. */
export function mlHrToDoseRate(drug: DrugDefinition, mlHr: number, weightKg: number): number {
  const unit = drug.infusion?.doseUnit ?? drug.bolus?.doseUnit ?? 'mg/hr';
  const mass = massUnitOf(unit);
  if (mass === 'ml') return round2(mlHr);
  const concAmountMcg = drug.concentration.amount * (TO_MCG[drug.concentration.unit] ?? 1);
  const mcgPerMl = concAmountMcg / Math.max(drug.concentration.volumeMl, 0.001);
  let amount = (mlHr * mcgPerMl) / (TO_MCG[mass] ?? 1); // per hour, in dose-unit mass
  if (perMinute(unit)) amount /= 60;
  if (isWeightBased(unit)) amount /= Math.max(weightKg, 1);
  return round4(amount);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
