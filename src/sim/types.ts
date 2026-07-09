/**
 * Engine-internal types. Content-facing shapes live in schema.ts (zod).
 * Pure TypeScript — no three.js, runs headless in Node.
 */
import type { RhythmToken } from './schema'

export type {
  RhythmToken,
  EngineContinuousVar,
  ScenarioData,
  CatalogData,
  InterventionDef,
  EffectSpec,
  Condition,
  EventAction,
} from './schema'
export { ENGINE_CONTINUOUS_VARS, RHYTHM_TOKENS } from './schema'

export interface TickSample {
  t: number
  values: Record<string, number>
  rhythm: RhythmToken
}

export type LogEntryType =
  | 'order'
  | 'orderRejected'
  | 'orderActive'
  | 'infusionStopped'
  | 'message'
  | 'result'
  | 'event'
  | 'exam'
  | 'alarmStart'
  | 'alarmEnd'
  | 'alarmSilenced'
  | 'endpoint'

export interface LogEntry {
  t: number
  type: LogEntryType
  text: string
  /** Message sender, order id, alarm var, event id… whatever names the source. */
  ref?: string
  orderNo?: number
  vitals: Record<string, number>
  rhythm: RhythmToken
}

export interface EndpointResult {
  id: string
  kind: 'success' | 'fail' | 'timeout'
  label: string
  atSec: number
}

export interface OrderResult {
  ok: boolean
  orderNo?: number
  missing?: string[]
}

export interface ActiveInfusion {
  orderNo: number
  interventionId: string
  label: string
  startedAt: number
}

export interface SessionExport {
  scenarioId: string
  scenarioTitle: string
  seed: number
  endedAtSec: number | null
  endpoint: EndpointResult | null
  log: LogEntry[]
  history: TickSample[]
}
