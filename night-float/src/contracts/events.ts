/**
 * SimEvent — the append-only log entry union. The log is the source of truth
 * for debrief, rubric scoring, the flowsheet and replay. Every meaningful
 * thing that happens in the sim MUST pass through here.
 */
import type { AlarmPriority, BodyZoneId, DeviceId, RhythmId, TimeScale, UsViewId } from './ids';
import type { Infusion, LineAccess, PumpChannelState, VentState, VitalSigns } from './patient';
import type { Order } from './orders';

export type LabFlag = 'normal' | 'high' | 'low' | 'crit_high' | 'crit_low';

export interface LabResult {
  testId: string;
  name: string;
  value: number;
  unit: string;
  refLo: number;
  refHi: number;
  flag: LabFlag;
}

export type NurseTaskKind =
  | 'give_med'
  | 'hang_infusion'
  | 'titrate_infusion'
  | 'draw_labs'
  | 'cycle_nibp'
  | 'reposition'
  | 'custom';

// ---------------------------------------------------------------- the union
export type SimEventBody =
  // orders
  | { type: 'OrderPlaced'; order: Order }
  | { type: 'OrderModified'; orderId: string; label: string; rate?: number; rateUnit?: string }
  | { type: 'OrderDiscontinued'; orderId: string }
  | { type: 'OrderCompleted'; orderId: string }
  // meds
  | {
      type: 'MedAdministered';
      drugId: string;
      drugName: string;
      dose: number;
      unit: string;
      route: string;
      by: 'nurse' | 'player';
    }
  | { type: 'InfusionStarted'; infusion: Infusion; label: string }
  | { type: 'InfusionRateChanged'; infusionId: string; drugId: string; doseRate: number; doseUnit: string; label: string }
  | { type: 'InfusionStopped'; infusionId: string; drugId: string; label: string }
  // vitals & rhythm
  | { type: 'VitalsSnapshot'; vitals: VitalSigns }
  | { type: 'NibpMeasured'; sbp: number; dbp: number; map: number }
  | { type: 'RhythmChanged'; from: RhythmId; to: RhythmId }
  // alarms
  | { type: 'AlarmRaised'; alarmId: string; source: DeviceId; priority: AlarmPriority; label: string }
  | { type: 'AlarmSilenced'; alarmId: string; durationS: number }
  | { type: 'AlarmResolved'; alarmId: string }
  // labs & imaging
  | { type: 'LabOrdered'; orderId: string; panelId: string; panelName: string; stat: boolean; resultsAt: number }
  | { type: 'LabResulted'; orderId: string; panelId: string; panelName: string; results: LabResult[]; stat: boolean }
  | { type: 'ImagingOrdered'; orderId: string; study: string; resultsAt: number }
  | { type: 'ImagingResulted'; orderId: string; study: string; findingsText: string; mediaId: string }
  // procedures
  | { type: 'ProcedureStarted'; procedureId: string; name: string; site?: string }
  | { type: 'ProcedureStepCompleted'; procedureId: string; stepId: string; prompt: string; skipped: boolean }
  | { type: 'ProcedureComplication'; procedureId: string; complicationId: string; label: string }
  | { type: 'ProcedureCompleted'; procedureId: string; name: string; durationS: number }
  | { type: 'ProcedureAborted'; procedureId: string }
  | { type: 'SterileFieldContaminated'; procedureId: string; what: string }
  | { type: 'LinePlaced'; line: LineAccess }
  // devices
  | { type: 'VentSettingsChanged'; vent: VentState; by: 'player' | 'rt' | 'scenario' }
  | { type: 'PumpChannelChanged'; channel: PumpChannelState }
  // people
  | { type: 'NurseAction'; taskId: string; kind: NurseTaskKind; phase: 'started' | 'done'; say?: string; detail?: string }
  | { type: 'NurseSpeech'; say: string }
  | { type: 'PlayerAction'; action: string; detail?: string }
  | {
      type: 'ExamPerformed';
      zone: BodyZoneId;
      mode: 'inspect' | 'palpate' | 'auscultate';
      findingsText: string;
    }
  | { type: 'UsViewChanged'; view: UsViewId | null }
  | { type: 'UsClipSaved'; view: UsViewId; mediaId: string }
  | { type: 'NoteWritten'; text: string }
  // scenario machinery
  | { type: 'ScenarioScriptedEvent'; scriptId: string; label?: string }
  | { type: 'TimeScaleChanged'; scale: TimeScale; auto: boolean; reason?: string }
  | { type: 'ScenarioStarted'; scenarioId: string; title: string }
  | {
      type: 'ScenarioEnded';
      outcome: 'success' | 'death' | 'timeout' | 'aborted';
      summary: string;
    };

export type SimEvent = { t: number; seq: number } & SimEventBody;
export type SimEventType = SimEventBody['type'];

/** Narrow helper: `isEvent(e, 'LabResulted')` gives the right payload type. */
export function isEvent<T extends SimEventType>(
  e: SimEvent,
  type: T,
): e is Extract<SimEvent, { type: T }> {
  return e.type === type;
}
