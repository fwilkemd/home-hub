import { z } from 'zod'

/**
 * Content contract — the single source of truth for what the content author
 * may write in /content. `npm run schema:export` emits these as JSON Schema.
 * Pure TypeScript, no three.js — runs headless.
 */

export const SCHEMA_VERSION = 1

export const RHYTHM_TOKENS = ['sinus', 'afib', 'svt', 'vt', 'vf', 'asystole'] as const
export const RhythmSchema = z.enum(RHYTHM_TOKENS)
export type RhythmToken = z.infer<typeof RhythmSchema>

export const ENGINE_CONTINUOUS_VARS = ['hr', 'sbp', 'dbp', 'spo2', 'rr', 'tempC'] as const
export type EngineContinuousVar = (typeof ENGINE_CONTINUOUS_VARS)[number]

// ---- conditions -------------------------------------------------------------

export const ComparisonOpSchema = z.enum(['<', '<=', '>', '>=', '=='])
export type ComparisonOp = z.infer<typeof ComparisonOpSchema>

const LeafConditionSchema = z.strictObject({
  var: z.string().describe('Variable name; `rhythm` compares against rhythm tokens'),
  op: ComparisonOpSchema,
  value: z.union([z.number(), z.string()]),
  sustainSec: z.number().nonnegative().optional()
    .describe('Condition must hold for this many consecutive seconds before it counts as true'),
})
export type LeafCondition = z.infer<typeof LeafConditionSchema>

export type Condition = LeafCondition | { all: Condition[] }
export const ConditionSchema: z.ZodType<Condition> = z.union([
  LeafConditionSchema,
  z.strictObject({ all: z.array(z.lazy(() => ConditionSchema)).min(1) }),
])

// ---- effects ----------------------------------------------------------------

export const EffectSchema = z
  .strictObject({
    var: z.string(),
    delta: z.number().optional().describe('Continuous vars: peak additive contribution'),
    set: z.string().optional().describe('Discrete vars (e.g. rhythm): value applied at onsetSec'),
    onsetSec: z.number().nonnegative().default(0),
    peakSec: z.number().nonnegative().optional()
      .describe('Time (from effect start) at which the full delta is reached; defaults to onsetSec'),
    durationSec: z.number().nonnegative().optional()
      .describe('Hold time measured from onsetSec. Boluses default to 300; ignored for running infusions'),
    decaySec: z.number().nonnegative().optional()
      .describe('Linear decay time after the hold ends (or after an infusion stops); default 120'),
  })
  .refine((e) => (e.delta === undefined) !== (e.set === undefined), {
    message: 'An effect needs exactly one of `delta` (continuous) or `set` (discrete)',
  })
export type EffectSpec = z.infer<typeof EffectSchema>

// ---- interventions catalog ----------------------------------------------------

export const InterventionTypeSchema = z.enum(['bolus', 'infusion', 'action', 'lab', 'imaging'])

export const InterventionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1).describe('Order-panel tab; the engine renders whatever categories exist'),
  type: InterventionTypeSchema,
  requires: z.array(z.string()).default([]).describe('Generic tags that must have been granted'),
  grants: z.array(z.string()).default([]).describe('Tags granted when the nurse task completes'),
  busySec: z.number().nonnegative().default(0).describe('Nurse task time before the order takes effect'),
  effects: z.array(EffectSchema).default([]),
  onOrderMessage: z.string().optional(),
  resultDelaySec: z.number().nonnegative().optional().describe('lab/imaging: delay until the result posts'),
  resultText: z.string().optional().describe('lab/imaging result; {{var}} reads the sim value at result time'),
})
export type InterventionDef = z.infer<typeof InterventionSchema>

export const CatalogSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  interventions: z.array(InterventionSchema).min(1),
}).refine(
  (c) => new Set(c.interventions.map((i) => i.id)).size === c.interventions.length,
  { message: 'Intervention ids must be unique' },
)
export type CatalogData = z.infer<typeof CatalogSchema>

// ---- scenario -----------------------------------------------------------------

export const PatientSchema = z.strictObject({
  name: z.string(),
  age: z.number(),
  sex: z.string(),
  weightKg: z.number(),
  chartNote: z.string().optional(),
  history: z.array(z.string()).default([]),
  homeMeds: z.array(z.string()).default([]),
})

export const CustomVarSchema = z.strictObject({
  name: z.string().min(1),
  initial: z.number(),
  setpoint: z.number().optional(),
  ratePerMin: z.number().optional(),
})

const DriftSchema = z.strictObject({
  setpoint: z.number(),
  ratePerMin: z.number(),
})

export const ExamFindingSchema = z.strictObject({
  when: ConditionSchema.optional().describe('Omit for the default finding; first match wins'),
  text: z.string(),
})

export const EventActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('effect'), effect: EffectSchema }),
  z.strictObject({ type: z.literal('setVar'), var: z.string(), value: z.union([z.number(), z.string()]) }),
  z.strictObject({
    type: z.literal('setSetpoint'),
    var: z.string(),
    setpoint: z.number(),
    ratePerMin: z.number().optional(),
    rampSec: z.number().positive().optional()
      .describe('Reach the setpoint over this many seconds (overrides ratePerMin)'),
  }),
  z.strictObject({ type: z.literal('message'), from: z.string().default('Nurse'), text: z.string() }),
  z.strictObject({ type: z.literal('revealExam'), region: z.string(), text: z.string() }),
  z.strictObject({ type: z.literal('endpoint'), id: z.string() }),
])
export type EventAction = z.infer<typeof EventActionSchema>

export const ScenarioEventSchema = z.strictObject({
  id: z.string().min(1),
  trigger: z.strictObject({ when: ConditionSchema }),
  actions: z.array(EventActionSchema).min(1),
  repeatable: z.boolean().default(false),
})

export const EndpointSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(['success', 'fail']),
  label: z.string(),
  when: ConditionSchema.optional().describe('Omit for endpoints only reachable via an `endpoint` event action'),
})

export const AlarmLimitSchema = z.strictObject({
  low: z.number().optional(),
  high: z.number().optional(),
})

export const ScenarioSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string().min(1),
  patient: PatientSchema.optional(),
  customVars: z.array(CustomVarSchema).default([]),
  initial: z.strictObject({
    vitals: z.strictObject({
      hr: z.number(),
      sbp: z.number(),
      dbp: z.number(),
      spo2: z.number(),
      rr: z.number(),
      tempC: z.number(),
      rhythm: RhythmSchema.default('sinus'),
    }),
    grants: z.array(z.string()).default([]),
  }),
  drift: z.record(z.string(), DriftSchema).default({}),
  exam: z.record(z.string(), z.array(ExamFindingSchema)).default({}),
  alarms: z.record(z.string(), AlarmLimitSchema).default({}),
  events: z.array(ScenarioEventSchema).default([]),
  endpoints: z.array(EndpointSchema).default([]),
  arterialLine: z.boolean().default(true)
    .describe('false → the monitor cycles NIBP every 3 min instead of continuous BP numerics'),
  timeLimitSec: z.number().positive().optional(),
})
export type ScenarioData = z.infer<typeof ScenarioSchema>

// ---- validation helpers ---------------------------------------------------------

export class ContentValidationError extends Error {
  constructor(public readonly file: string, detail: string) {
    super(`Invalid content in ${file}:\n${detail}`)
    this.name = 'ContentValidationError'
  }
}

function validate<T>(schema: z.ZodType<T>, raw: unknown, sourceName: string): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new ContentValidationError(sourceName, z.prettifyError(result.error))
  }
  return result.data
}

export function parseScenario(raw: unknown, sourceName = 'scenario'): ScenarioData {
  return validate(ScenarioSchema, raw, sourceName)
}

export function parseCatalog(raw: unknown, sourceName = 'interventions.json'): CatalogData {
  return validate(CatalogSchema, raw, sourceName)
}
