/**
 * Engine-internal shared context. NOT a contract — subsystems under
 * src/engine/* wire together through this. Everything here is pure data +
 * callbacks; no renderer/UI/store imports (eslint-enforced).
 */
import type { ScenarioFile } from '../contracts/content';
import type { SimEvent, SimEventBody } from '../contracts/events';
import type { PatientState } from '../contracts/patient';
import type { EventLog } from './log';
import type { SimClock } from './clock';
import type { Rng } from './rng';

/**
 * Independent deterministic RNG streams, all forked ONCE from the scenario
 * seed at engine creation (fixed labels), so call order in one subsystem can
 * never perturb another (SPEC §4 determinism).
 */
export interface RngStreams {
  physio: Rng;
  labs: Rng;
  complications: Rng;
  rhythm: Rng;
  nibp: Rng;
  nurse: Rng;
}

/**
 * Params whose BASE value integrates toward the drug-driven target instead of
 * receiving a transient effective modifier (so the world can read them off
 * PatientState — eyes close, movement stops). Integration lives in
 * physiology/sedation.ts; pharmacology only publishes the targets.
 * TODO(MEDICAL): which params behave as slow states vs instant modifiers.
 */
export const INTEGRATED_PARAMS: readonly string[] = ['sedation', 'paralysis'];

export interface EngineCtx {
  scenario: ScenarioFile;
  patient: PatientState;
  log: EventLog;
  clock: SimClock;
  rng: RngStreams;
  /**
   * EFFECTIVE physiology parameters for the current tick:
   * base (patient.physiology) + pharmacology modifiers. Rebuilt every tick by
   * the pharmacology pass; read-only for everyone downstream. Never persisted.
   */
  effective: Record<string, number>;
  /**
   * Drug-driven targets for INTEGRATED_PARAMS, rebuilt each tick by
   * pharmacology and consumed by physiology/sedation.ts.
   */
  drugTargets: Record<string, number>;
  /** append an event at the current sim time */
  emit(body: SimEventBody): SimEvent;
  now(): number;
  /** deterministic per-prefix id counters: nextId('inf') -> 'inf-1', 'inf-2'... */
  nextId(prefix: string): string;
  /** drop time compression to 1x (no-op at <=1x) with an auto TimeScaleChanged */
  dropToRealtime(reason: string): void;
  endScenario(outcome: 'success' | 'death' | 'timeout' | 'aborted', summary: string): void;
  isEnded(): boolean;
  weightKg(): number;
}

/** Every subsystem exposes at least a per-tick advance. dt is sim seconds. */
export interface Subsystem {
  tick(t: number, dt: number): void;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Exponential smoothing step: move `current` toward `target` with time
 * constant `tauS` over `dt` seconds. tau <= 0 snaps immediately.
 */
export function approach(current: number, target: number, dt: number, tauS: number): number {
  if (tauS <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dt / tauS));
}
