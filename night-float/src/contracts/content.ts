/**
 * Content-file schemas: drugs, lab panels, procedures, scenarios, rubrics.
 * Everything in /src/data must parse through these. This file IS the medical
 * firewall's outer wall — the medical pass edits data matching these shapes.
 */
import { z } from 'zod';
import {
  bodyZoneIdSchema,
  lineTypeSchema,
  rhythmIdSchema,
  toolIdSchema,
  usViewIdSchema,
} from './ids';
import { auscultationParamsSchema, patientStateSchema } from './patient';

// ================================================================ predicates
export const cmpOpSchema = z.enum(['lt', 'lte', 'gt', 'gte', 'eq']);
export type CmpOp = z.infer<typeof cmpOpSchema>;

const whereSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export type Predicate =
  | { type: 'vital'; path: string; op: CmpOp; value: number }
  | { type: 'physiology'; param: string; op: CmpOp; value: number }
  | { type: 'elapsed'; op: 'gt' | 'lt'; seconds: number }
  | {
      type: 'eventOccurred';
      eventType: string;
      where?: Record<string, string | number | boolean>;
      withinLastS?: number;
    }
  | {
      type: 'sustained';
      path: string;
      op: CmpOp;
      value: number;
      seconds: number;
      /** lapses shorter than this don't reset the clock (noise tolerance); default 0 */
      graceS?: number;
    }
  | { type: 'and'; conditions: Predicate[] }
  | { type: 'or'; conditions: Predicate[] }
  | { type: 'not'; condition: Predicate };

export const predicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('vital'), path: z.string(), op: cmpOpSchema, value: z.number() }),
    z.object({
      type: z.literal('physiology'),
      param: z.string(),
      op: cmpOpSchema,
      value: z.number(),
    }),
    z.object({ type: z.literal('elapsed'), op: z.enum(['gt', 'lt']), seconds: z.number() }),
    z.object({
      type: z.literal('eventOccurred'),
      eventType: z.string(),
      where: whereSchema.optional(),
      withinLastS: z.number().optional(),
    }),
    z.object({
      type: z.literal('sustained'),
      path: z.string(),
      op: cmpOpSchema,
      value: z.number(),
      seconds: z.number(),
      graceS: z.number().optional(),
    }),
    z.object({ type: z.literal('and'), conditions: z.array(predicateSchema) }),
    z.object({ type: z.literal('or'), conditions: z.array(predicateSchema) }),
    z.object({ type: z.literal('not'), condition: predicateSchema }),
  ]),
) as z.ZodType<Predicate>;

// ================================================================ effects
// StateEffects are declarative patches applied to PatientState by the engine.
// Used by procedures (step/completion effects) and scenario scripts.
const usPatchSchema = z.record(z.string(), z.union([z.number(), z.boolean()]));

const setEffect = z.object({
  type: z.literal('set'),
  /** dot path into PatientState, e.g. "devices.vent.fio2" */
  path: z.string(),
  value: z.union([z.number(), z.string(), z.boolean()]),
});
const addEffect = z.object({ type: z.literal('add'), path: z.string(), value: z.number() });
const setPhysiologyEffect = z.object({
  type: z.literal('setPhysiology'),
  param: z.string(),
  value: z.number(),
});
const rampPhysiologyEffect = z.object({
  type: z.literal('rampPhysiology'),
  param: z.string(),
  to: z.number(),
  overS: z.number(),
});
const addLineEffect = z.object({
  type: z.literal('addLine'),
  lineType: lineTypeSchema,
  /** literal site, or "$site" = the site chosen when the procedure started */
  site: z.string(),
});
// Sparse patch schemas: hand-built (no .default()s) because zod v4's
// .partial() still applies inner defaults, which would turn "change nothing"
// into "reset everything to schema defaults".
const ventSettingsPatchSchema = z.object({
  mode: z.enum(['VC', 'PC', 'PS']).optional(),
  setRr: z.number().optional(),
  setVtMl: z.number().optional(),
  peep: z.number().optional(),
  fio2: z.number().min(0.21).max(1).optional(),
  pinsp: z.number().optional(),
  psupp: z.number().optional(),
});

const setVentEffect = z.object({
  type: z.literal('setVent'),
  settings: ventSettingsPatchSchema,
  connect: z.boolean().optional(),
});
const setUsFindingEffect = z.object({
  type: z.literal('setUsFinding'),
  view: usViewIdSchema,
  patch: usPatchSchema,
});
const examFindingsPatchSchema = z.object({
  inspect: z.string().optional(),
  palpate: z.string().optional(),
  auscultateText: z.string().optional(),
  auscultation: auscultationParamsSchema.optional(),
});

const setExamFindingEffect = z.object({
  type: z.literal('setExamFinding'),
  zone: bodyZoneIdSchema,
  patch: examFindingsPatchSchema,
});
const setRhythmEffect = z.object({ type: z.literal('setRhythm'), rhythm: rhythmIdSchema });

export const stateEffectSchema = z.discriminatedUnion('type', [
  setEffect,
  addEffect,
  setPhysiologyEffect,
  rampPhysiologyEffect,
  addLineEffect,
  setVentEffect,
  setUsFindingEffect,
  setExamFindingEffect,
  setRhythmEffect,
]);
export type StateEffect = z.infer<typeof stateEffectSchema>;

// Scenario scripts can additionally talk to the player.
const nurseSayAction = z.object({ type: z.literal('nurseSay'), text: z.string() });
const notifyAction = z.object({ type: z.literal('notify'), text: z.string() });

export const scriptActionSchema = z.discriminatedUnion('type', [
  setEffect,
  addEffect,
  setPhysiologyEffect,
  rampPhysiologyEffect,
  addLineEffect,
  setVentEffect,
  setUsFindingEffect,
  setExamFindingEffect,
  setRhythmEffect,
  nurseSayAction,
  notifyAction,
]);
export type ScriptAction = z.infer<typeof scriptActionSchema>;

// ================================================================ drugs
export const drugClassSchema = z.enum([
  'pressor',
  'fluid',
  'sedative',
  'paralytic',
  'antiarrhythmic',
  'opioid',
  'analgesic',
  'other',
]);
export type DrugClass = z.infer<typeof drugClassSchema>;

/**
 * PD effect: modifier on a named physiology parameter, scaled by effect-site
 * level. magnitude = potency * ce^n / (ce^n + ec50^n); mode 'add' adds it,
 * 'mult' multiplies the param by (1 + magnitude).
 * TODO(MEDICAL): the whole PD shape is a placeholder frame.
 */
export const drugEffectSchema = z.object({
  param: z.string(),
  mode: z.enum(['add', 'mult']),
  potency: z.number(),
  ec50: z.number(),
  hillN: z.number().default(1),
});
export type DrugEffect = z.infer<typeof drugEffectSchema>;

export const drugDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  class: drugClassSchema,
  /** REQUIRED — one line on what the real model must capture. */
  todoMedical: z.string(),
  /** how it's supplied, for pump math: amount per volume */
  concentration: z.object({
    amount: z.number(),
    unit: z.string(),
    volumeMl: z.number(),
  }),
  bolus: z
    .object({
      doseUnit: z.string(),
      min: z.number(),
      max: z.number(),
      default: z.number(),
      /** seconds over which a "push" is given */
      pushS: z.number().default(30),
    })
    .optional(),
  infusion: z
    .object({
      doseUnit: z.string(),
      min: z.number(),
      max: z.number(),
      default: z.number(),
      step: z.number(),
    })
    .optional(),
  /** effect-site kinetics: rise and decay time constants (seconds). */
  pk: z.object({
    onsetS: z.number(),
    offsetS: z.number(),
    /** normalizes dose to effect-site units: ce contribution = dose/refDose */
    refDose: z.number(),
  }),
  effects: z.array(drugEffectSchema),
  /** probabilistic rhythm conversions while effect-site level >= minCe */
  rhythmEffects: z
    .array(
      z.object({
        from: z.array(rhythmIdSchema),
        to: rhythmIdSchema,
        probPerMin: z.number(),
        minCe: z.number(),
      }),
    )
    .default([]),
  notes: z.string().optional(),
});
export type DrugDefinition = z.infer<typeof drugDefinitionSchema>;

// ================================================================ labs
export const labTestDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  refLo: z.number(),
  refHi: z.number(),
  critLo: z.number().optional(),
  critHi: z.number().optional(),
  /** key into the engine's generator registry (engine/labs/generators.ts) */
  generator: z.string(),
  /** decimal places for display */
  precision: z.number().default(1),
});
export type LabTestDef = z.infer<typeof labTestDefSchema>;

export const labPanelDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** point-of-care panels result fast */
  poc: z.boolean().default(false),
  turnaroundS: z.number(),
  statTurnaroundS: z.number().optional(),
  todoMedical: z.string(),
  tests: z.array(labTestDefSchema),
});
export type LabPanelDefinition = z.infer<typeof labPanelDefinitionSchema>;

// ================================================================ procedures
export const procedureInteractionSchema = z.enum(['click', 'click_hold', 'align_hold', 'slider']);
export type ProcedureInteraction = z.infer<typeof procedureInteractionSchema>;

export const procedureComplicationSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** 0..1 chance evaluated when the hooked step completes */
  baseProb: z.number(),
  /** multipliers applied if the named steps were skipped */
  probIfSkipped: z.array(z.object({ stepId: z.string(), mult: z.number() })).default([]),
  effects: z.array(stateEffectSchema).default([]),
});
export type ProcedureComplication = z.infer<typeof procedureComplicationSchema>;

export const procedureStepSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  detail: z.string().optional(),
  tool: toolIdSchema.optional(),
  interaction: procedureInteractionSchema,
  /** hold duration for click_hold / align_hold */
  holdS: z.number().default(1.2),
  /** which special screen the step uses, if any */
  overlay: z.enum(['us_procedural', 'laryngoscopy', 'none']).default('none'),
  skippable: z.boolean().default(false),
  skipConsequenceNote: z.string().optional(),
  complications: z.array(procedureComplicationSchema).default([]),
  effects: z.array(stateEffectSchema).default([]),
});
export type ProcedureStep = z.infer<typeof procedureStepSchema>;

export const procedureDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  todoMedical: z.string(),
  requiredTool: toolIdSchema,
  kitLabel: z.string(),
  siteOptions: z.array(z.string()).min(1),
  positioningNote: z.string(),
  sterile: z.boolean().default(false),
  steps: z.array(procedureStepSchema).min(1),
  completionEffects: z.array(stateEffectSchema).default([]),
});
export type ProcedureDefinition = z.infer<typeof procedureDefinitionSchema>;

// ================================================================ rubric
export type RubricCondition =
  | { type: 'eventOccurred'; eventType: string; where?: Record<string, string | number | boolean> }
  | {
      type: 'eventWithin';
      eventType: string;
      where?: Record<string, string | number | boolean>;
      afterEventType: string;
      afterWhere?: Record<string, string | number | boolean>;
      windowS: number;
    }
  | { type: 'never'; eventType: string; where?: Record<string, string | number | boolean> }
  | { type: 'outcome'; outcome: 'success' | 'death' | 'timeout' | 'aborted' };

export const rubricConditionSchema: z.ZodType<RubricCondition> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('eventOccurred'),
    eventType: z.string(),
    where: whereSchema.optional(),
  }),
  z.object({
    type: z.literal('eventWithin'),
    eventType: z.string(),
    where: whereSchema.optional(),
    afterEventType: z.string(),
    afterWhere: whereSchema.optional(),
    windowS: z.number(),
  }),
  z.object({ type: z.literal('never'), eventType: z.string(), where: whereSchema.optional() }),
  z.object({
    type: z.literal('outcome'),
    outcome: z.enum(['success', 'death', 'timeout', 'aborted']),
  }),
]) as z.ZodType<RubricCondition>;

export const rubricItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string().optional(),
  points: z.number(),
  condition: rubricConditionSchema,
});
export type RubricItem = z.infer<typeof rubricItemSchema>;

export const scenarioRubricSchema = z.object({
  items: z.array(rubricItemSchema),
});
export type ScenarioRubric = z.infer<typeof scenarioRubricSchema>;

// ================================================================ scenario
export const scriptedEventSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  /** fire at sim time (seconds)... */
  at: z.number().optional(),
  /** ...or when a predicate becomes true (first time only) */
  when: predicateSchema.optional(),
  actions: z.array(scriptActionSchema),
  /** auto-drop time compression to 1x with a chime */
  dropToRealtime: z.boolean().default(false),
});
export type ScriptedEvent = z.infer<typeof scriptedEventSchema>;

export const endConditionSchema = z.object({
  id: z.string(),
  outcome: z.enum(['success', 'death', 'timeout']),
  when: predicateSchema,
  summary: z.string(),
});
export type EndCondition = z.infer<typeof endConditionSchema>;

export const tutorialStepSchema = z.object({
  id: z.string(),
  text: z.string(),
  doneWhen: predicateSchema,
});
export type TutorialStep = z.infer<typeof tutorialStepSchema>;

export const scenarioFileSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  /** deterministic seed for the whole run */
  seed: z.number(),
  /** wall-clock label shown on the HUD at t=0, e.g. "03:12" */
  clockStart: z.string().default('03:00'),
  briefing: z.object({
    oneLiner: z.string(),
    hpi: z.string(),
    background: z.string(),
  }),
  durationLimitS: z.number().optional(),
  initialPatient: patientStateSchema,
  scriptedEvents: z.array(scriptedEventSchema).default([]),
  endConditions: z.array(endConditionSchema).default([]),
  rubric: scenarioRubricSchema.default({ items: [] }),
  tutorial: z.array(tutorialStepSchema).default([]),
});
export type ScenarioFile = z.infer<typeof scenarioFileSchema>;

// ================================================================ authoring
// Identity helpers so TS data files get inference + validation at load time.
export const defineDrug = (d: z.input<typeof drugDefinitionSchema>): DrugDefinition =>
  drugDefinitionSchema.parse(d);
export const defineLabPanel = (d: z.input<typeof labPanelDefinitionSchema>): LabPanelDefinition =>
  labPanelDefinitionSchema.parse(d);
export const defineProcedure = (
  d: z.input<typeof procedureDefinitionSchema>,
): ProcedureDefinition => procedureDefinitionSchema.parse(d);
export const defineScenario = (d: z.input<typeof scenarioFileSchema>): ScenarioFile =>
  scenarioFileSchema.parse(d);
