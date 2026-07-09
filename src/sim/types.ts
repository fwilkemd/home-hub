/**
 * Shared types for the simulation core.
 * This layer is pure TypeScript — no three.js, runs headless in Node.
 */

export const RHYTHM_TOKENS = ['sinus', 'afib', 'svt', 'vt', 'vf', 'asystole'] as const
export type RhythmToken = (typeof RHYTHM_TOKENS)[number]

/** Engine-default continuous variables, always present and shown on the monitor. */
export const ENGINE_CONTINUOUS_VARS = ['hr', 'sbp', 'dbp', 'spo2', 'rr', 'tempC'] as const
export type EngineContinuousVar = (typeof ENGINE_CONTINUOUS_VARS)[number]

export interface DriftSpec {
  setpoint: number
  /** Units per minute, applied toward the setpoint (sign is informational). */
  ratePerMin: number
}

export interface CustomVarSpec {
  name: string
  initial: number
  setpoint?: number
  ratePerMin?: number
}

export interface PatientInfo {
  name: string
  age: number
  sex: string
  weightKg: number
  chartNote?: string
  history?: string[]
  homeMeds?: string[]
}

/**
 * Scenario content shape (subset needed for M1; the zod schema arrives in M3
 * as the validated source of truth).
 */
export interface ScenarioData {
  schemaVersion: number
  id: string
  title: string
  patient?: PatientInfo
  customVars?: CustomVarSpec[]
  initial: {
    vitals: Partial<Record<EngineContinuousVar, number>> & { rhythm?: RhythmToken }
    grants?: string[]
  }
  drift?: Partial<Record<string, DriftSpec>>
  timeLimitSec?: number
}

export interface TickSample {
  t: number
  values: Record<string, number>
  rhythm: RhythmToken
}
