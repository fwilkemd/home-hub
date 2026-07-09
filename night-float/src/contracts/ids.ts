/**
 * Canonical ID unions. Everything that names a "kind of thing" lives here so
 * engine, world, screens, UI and content files all agree.
 */
import { z } from 'zod';

// ---------------------------------------------------------------- rhythms
export const ALL_RHYTHMS = [
  'sinus',
  'sinus_tach',
  'sinus_brady',
  'afib',
  'vt',
  'vf',
  'asystole',
] as const;
export const rhythmIdSchema = z.enum(ALL_RHYTHMS);
export type RhythmId = z.infer<typeof rhythmIdSchema>;

/** Rhythms with no forward cardiac output (pulseless). */
export const PULSELESS_RHYTHMS: readonly RhythmId[] = ['vf', 'asystole'];

// ---------------------------------------------------------------- body zones
export const ALL_BODY_ZONES = [
  'head',
  'neck',
  'precordium',
  'chest_left',
  'chest_right',
  'abdomen',
  'arm_left',
  'arm_right',
  'leg_left',
  'leg_right',
] as const;
export const bodyZoneIdSchema = z.enum(ALL_BODY_ZONES);
export type BodyZoneId = z.infer<typeof bodyZoneIdSchema>;

// ---------------------------------------------------------------- ultrasound
export const ALL_US_VIEWS = [
  'plax', // parasternal long axis
  'psax', // parasternal short axis
  'a4c', // apical 4-chamber
  'subxiphoid',
  'ivc',
  'lung_ant_l',
  'lung_ant_r',
  'lung_post_l',
  'lung_post_r',
  'ruq',
  'luq',
  'pelvis',
] as const;
export const usViewIdSchema = z.enum(ALL_US_VIEWS);
export type UsViewId = z.infer<typeof usViewIdSchema>;

export const US_VIEW_LABELS: Record<UsViewId, string> = {
  plax: 'Parasternal long',
  psax: 'Parasternal short',
  a4c: 'Apical 4-chamber',
  subxiphoid: 'Subxiphoid',
  ivc: 'IVC',
  lung_ant_l: 'Ant. lung L',
  lung_ant_r: 'Ant. lung R',
  lung_post_l: 'Post. lung L',
  lung_post_r: 'Post. lung R',
  ruq: 'RUQ',
  luq: 'LUQ',
  pelvis: 'Pelvis',
};

// ---------------------------------------------------------------- tools
export const ALL_TOOLS = [
  'stethoscope',
  'us_probe',
  'laryngoscope',
  'cvl_kit',
  'aline_kit',
  'ett_kit',
] as const;
export const toolIdSchema = z.enum(ALL_TOOLS);
export type ToolId = z.infer<typeof toolIdSchema>;

export const TOOL_LABELS: Record<ToolId, string> = {
  stethoscope: 'Stethoscope',
  us_probe: 'Ultrasound probe',
  laryngoscope: 'Laryngoscope',
  cvl_kit: 'Central line kit',
  aline_kit: 'Arterial line kit',
  ett_kit: 'Intubation kit',
};

// ---------------------------------------------------------------- devices
export const ALL_DEVICES = ['monitor', 'vent', 'pump', 'us_machine', 'workstation'] as const;
export const deviceIdSchema = z.enum(ALL_DEVICES);
export type DeviceId = z.infer<typeof deviceIdSchema>;

// ---------------------------------------------------------------- misc enums
export const alarmPrioritySchema = z.enum(['crisis', 'warning', 'advisory']);
export type AlarmPriority = z.infer<typeof alarmPrioritySchema>;

export type TimeScale = 0 | 1 | 8 | 32;
export const TIME_SCALES: readonly TimeScale[] = [0, 1, 8, 32];

export const lineTypeSchema = z.enum(['piv', 'cvc', 'aline', 'ett', 'foley']);
export type LineType = z.infer<typeof lineTypeSchema>;

export const medRouteSchema = z.enum(['iv_push', 'iv_infusion', 'im', 'po', 'neb']);
export type MedRoute = z.infer<typeof medRouteSchema>;

export const ventModeSchema = z.enum(['VC', 'PC', 'PS']);
export type VentMode = z.infer<typeof ventModeSchema>;

export type OrderKind = 'med' | 'lab' | 'imaging' | 'vent' | 'nursing';

/** Named camera viewpoints used by ?debugcam and the screenshot tour. */
export const ALL_VIEWPOINTS = ['bedside', 'monitor', 'vent', 'ultrasound', 'wide'] as const;
export type ViewpointId = (typeof ALL_VIEWPOINTS)[number];

/** Waypoint stations the nurse NPC moves between (world maps these to xyz). */
export type NurseStation =
  | 'station' // her home spot near the door
  | 'supply'
  | 'pump'
  | 'bedside_left'
  | 'bedside_right'
  | 'workstation'
  | 'door';

export type EmrTab =
  | 'chart'
  | 'orders'
  | 'mar'
  | 'results'
  | 'flowsheet'
  | 'media'
  | 'notes'
  | 'debrief';
