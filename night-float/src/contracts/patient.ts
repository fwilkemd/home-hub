/**
 * PatientState and everything hanging off it. Zod-first: scenario files embed
 * an initial PatientState, so all of this must round-trip through JSON.
 */
import { z } from 'zod';
import {
  bodyZoneIdSchema,
  lineTypeSchema,
  rhythmIdSchema,
  usViewIdSchema,
  ventModeSchema,
  alarmPrioritySchema,
} from './ids';

// ---------------------------------------------------------------- vitals
export const vitalSignsSchema = z.object({
  hr: z.number(),
  rhythm: rhythmIdSchema,
  spo2: z.number(),
  rr: z.number(),
  map: z.number(),
  sbp: z.number(),
  dbp: z.number(),
  tempC: z.number(),
  etco2: z.number().optional(),
  cvp: z.number().optional(),
});
export type VitalSigns = z.infer<typeof vitalSignsSchema>;

// ---------------------------------------------------------------- exam
export const lungRecipeSchema = z.enum(['clear', 'crackles', 'wheeze', 'diminished', 'absent']);
export type LungRecipe = z.infer<typeof lungRecipeSchema>;

/** Parameters the audio layer uses to synthesize auscultation for a zone. */
export const auscultationParamsSchema = z.object({
  /** 0..1 systolic murmur intensity. TODO(MEDICAL): murmur character/timing taxonomy. */
  heartMurmur: z.number().min(0).max(1).default(0),
  /** 0..1 muffling (e.g. effusion). */
  heartMuffled: z.number().min(0).max(1).default(0),
  lungRecipe: lungRecipeSchema.default('clear'),
  /** 0..1 adventitious-sound intensity. */
  lungIntensity: z.number().min(0).max(1).default(0.5),
});
export type AuscultationParams = z.infer<typeof auscultationParamsSchema>;

export const examFindingsSchema = z.object({
  inspect: z.string().default('Unremarkable.'),
  palpate: z.string().default('Unremarkable.'),
  auscultateText: z.string().optional(),
  auscultation: auscultationParamsSchema.default({
    heartMurmur: 0,
    heartMuffled: 0,
    lungRecipe: 'clear',
    lungIntensity: 0.5,
  }),
});
export type ExamFindings = z.infer<typeof examFindingsSchema>;

// ---------------------------------------------------------------- ultrasound
// Parametric findings per view. The renderer binds these to shapes; the
// medical pass edits the numbers. Discriminated by anatomical family.
export const usCardiacFindingsSchema = z.object({
  kind: z.literal('cardiac'),
  /** 0..1 wall excursion. TODO(MEDICAL): map to EF ranges. */
  contractility: z.number().min(0).max(1).default(0.6),
  /** LV cavity scale, 1 = normal. */
  lvScale: z.number().min(0.3).max(2).default(1),
  /** RV cavity scale, 1 = normal. */
  rvScale: z.number().min(0.3).max(2).default(1),
  /** 0..1 pericardial effusion rim size. */
  effusion: z.number().min(0).max(1).default(0),
});
export const usIvcFindingsSchema = z.object({
  kind: z.literal('ivc'),
  diameterCm: z.number().min(0.2).max(4).default(1.8),
  /** 0..1 respiratory collapse fraction. */
  collapse: z.number().min(0).max(1).default(0.3),
});
export const usLungFindingsSchema = z.object({
  kind: z.literal('lung'),
  sliding: z.boolean().default(true),
  /** B-lines per intercostal window (0 = A-line pattern). */
  bLines: z.number().min(0).max(10).default(0),
  /** 0..1 pleural effusion size. */
  effusion: z.number().min(0).max(1).default(0),
});
export const usAbdFindingsSchema = z.object({
  kind: z.literal('abdominal'),
  /** 0..1 free-fluid stripe prominence. */
  freeFluid: z.number().min(0).max(1).default(0),
});
export const usFindingsSchema = z.discriminatedUnion('kind', [
  usCardiacFindingsSchema,
  usIvcFindingsSchema,
  usLungFindingsSchema,
  usAbdFindingsSchema,
]);
export type USFindings = z.infer<typeof usFindingsSchema>;
export type USCardiacFindings = z.infer<typeof usCardiacFindingsSchema>;
export type USIvcFindings = z.infer<typeof usIvcFindingsSchema>;
export type USLungFindings = z.infer<typeof usLungFindingsSchema>;
export type USAbdFindings = z.infer<typeof usAbdFindingsSchema>;

// ---------------------------------------------------------------- lines
export const lineAccessSchema = z.object({
  id: z.string(),
  type: lineTypeSchema,
  site: z.string(), // e.g. "L forearm", "R IJ", "L radial"
  placedAt: z.number().default(0), // sim seconds (negative = before scenario)
});
export type LineAccess = z.infer<typeof lineAccessSchema>;

// ---------------------------------------------------------------- devices
export const ventSettingsSchema = z.object({
  mode: ventModeSchema.default('VC'),
  setRr: z.number().default(16),
  setVtMl: z.number().default(450),
  peep: z.number().default(5),
  fio2: z.number().min(0.21).max(1).default(0.4),
  pinsp: z.number().default(15), // PC driving pressure above PEEP
  psupp: z.number().default(8), // PS support above PEEP
});
export type VentSettings = z.infer<typeof ventSettingsSchema>;

export const ventStateSchema = ventSettingsSchema.extend({
  /** true once the patient is intubated and on the circuit */
  connected: z.boolean().default(false),
  standby: z.boolean().default(true),
  alarmLimits: z
    .object({
      pawHigh: z.number().default(35),
      vteLowMl: z.number().default(250),
      apneaS: z.number().default(20),
    })
    .default({ pawHigh: 35, vteLowMl: 250, apneaS: 20 }),
});
export type VentState = z.infer<typeof ventStateSchema>;

export const pumpChannelSchema = z.object({
  id: z.string(),
  drugId: z.string().nullable().default(null),
  label: z.string().default(''),
  rateMlHr: z.number().default(0),
  vtbiMl: z.number().default(0),
  infusedMl: z.number().default(0),
  running: z.boolean().default(false),
  occluded: z.boolean().default(false),
});
export type PumpChannelState = z.infer<typeof pumpChannelSchema>;

export const alarmLimitSchema = z.object({
  lo: z.number().optional(),
  hi: z.number().optional(),
  priority: alarmPrioritySchema,
  label: z.string(),
});
export type AlarmLimit = z.infer<typeof alarmLimitSchema>;

export const monitorConfigSchema = z.object({
  /** minutes between automatic NIBP cycles */
  nibpIntervalMin: z.number().default(5),
  /** vital path -> limits. TODO(MEDICAL): sensible default alarm limits. */
  alarmLimits: z.record(z.string(), alarmLimitSchema).default({}),
});
export type MonitorConfig = z.infer<typeof monitorConfigSchema>;

export const deviceStatesSchema = z.object({
  monitor: monitorConfigSchema,
  vent: ventStateSchema,
  pumps: z.array(pumpChannelSchema).default([]),
});
export type DeviceStates = z.infer<typeof deviceStatesSchema>;

// ---------------------------------------------------------------- meds
export const infusionSchema = z.object({
  id: z.string(),
  drugId: z.string(),
  doseRate: z.number(),
  doseUnit: z.string(), // e.g. 'mcg/kg/min'
  channelId: z.string(),
  startedAt: z.number(),
});
export type Infusion = z.infer<typeof infusionSchema>;

export const medAdminRecordSchema = z.object({
  t: z.number(),
  drugId: z.string(),
  drugName: z.string(),
  dose: z.number(),
  unit: z.string(),
  route: z.string(),
});
export type MedAdminRecord = z.infer<typeof medAdminRecordSchema>;

// ---------------------------------------------------------------- physiology
/**
 * Continuous internal parameters. The engine integrates these; vitals are
 * derived from them. Keys are open-ended on purpose — the medical pass owns
 * the list's semantics. TODO(MEDICAL): real parameter set + units.
 */
export const physiologySchema = z.record(z.string(), z.number());
export type Physiology = z.infer<typeof physiologySchema>;

/** Engine defaults, merged under scenario-provided values. */
export const PHYSIOLOGY_DEFAULTS: Readonly<Record<string, number>> = {
  // TODO(MEDICAL): every one of these is a placeholder scalar, roughly 0..1
  // centered on "normal" unless noted.
  volumeStatus: 0.5, // 0 empty .. 1 overloaded
  svr: 0.5, // systemic vascular resistance, 0 low .. 1 high
  contractility: 0.6,
  shuntFraction: 0.05, // 0..1 — drives SpO2 response to FiO2
  respDrive: 0.5,
  sedation: 0, // 0 awake .. 1 deeply sedated
  paralysis: 0, // 0 none .. 1 fully paralyzed
  agitation: 0.1,
  lungComplianceMlPerCmH2o: 50,
  airwayResistanceCmH2oPerLps: 10,
  tempSetC: 37.0,
  hrBaseline: 78,
  mapSetpoint: 78, // baroreflex target
  perfusion: 0.8, // peripheral perfusion 0..1 (pleth amplitude)
};

// ---------------------------------------------------------------- patient
export const demographicsSchema = z.object({
  name: z.string(),
  age: z.number(),
  sex: z.string(),
  weightKg: z.number(),
});
export type Demographics = z.infer<typeof demographicsSchema>;

export const patientStateSchema = z.object({
  id: z.string(),
  demographics: demographicsSchema,
  vitals: vitalSignsSchema,
  physiology: physiologySchema,
  exam: z.partialRecord(bodyZoneIdSchema, examFindingsSchema).default({}),
  us: z.partialRecord(usViewIdSchema, usFindingsSchema).default({}),
  lines: z.array(lineAccessSchema).default([]),
  devices: deviceStatesSchema,
  infusions: z.array(infusionSchema).default([]),
  medsGiven: z.array(medAdminRecordSchema).default([]),
});
export type PatientState = z.infer<typeof patientStateSchema>;
