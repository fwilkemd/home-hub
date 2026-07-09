/**
 * SimCommand — the ONLY way anything outside the engine mutates sim state.
 * UI/world/nurse-bark buttons build commands; `engine.dispatch(cmd)` validates,
 * mutates, and emits SimEvents. Nothing in the UI touches state directly.
 */
import type { BodyZoneId, TimeScale, ToolId, UsViewId } from './ids';
import type { VentSettings } from './patient';
import type { OrderDraft, VerbalOrder } from './orders';

export type ExamMode = 'inspect' | 'palpate' | 'auscultate';

export type SimCommand =
  // orders & meds
  | { type: 'PlaceOrder'; draft: OrderDraft }
  | { type: 'DiscontinueOrder'; orderId: string }
  | { type: 'ModifyInfusion'; infusionId: string; doseRate: number }
  | { type: 'StopInfusion'; infusionId: string }
  | { type: 'VerbalOrder'; verbal: VerbalOrder }
  // time
  | { type: 'SetTimeScale'; scale: TimeScale }
  // devices
  | { type: 'SilenceAlarm'; alarmId: string; durationS?: number }
  | { type: 'SilenceAllAlarms'; durationS?: number }
  | { type: 'CycleNibp' }
  | { type: 'SetVent'; settings: Partial<VentSettings>; by?: 'player' | 'rt' }
  | { type: 'SetPump'; channelId: string; rateMlHr?: number; running?: boolean }
  // bedside
  | { type: 'PerformExam'; zone: BodyZoneId; mode: ExamMode }
  | { type: 'EquipTool'; tool: ToolId | null }
  // ultrasound
  | { type: 'UsSetView'; view: UsViewId | null }
  | { type: 'UsSetQuality'; quality: number }
  | { type: 'UsFreeze'; frozen: boolean }
  | { type: 'UsSaveClip'; view: UsViewId; dataUrl: string }
  // procedures
  | { type: 'StartProcedure'; procedureId: string; site?: string }
  | { type: 'AdvanceProcedureStep'; stepId: string; skipped?: boolean }
  | { type: 'AbortProcedure' }
  | { type: 'ContaminateSterileField'; what: string }
  // misc
  | { type: 'WriteNote'; text: string }
  | { type: 'EndScenario'; reason: 'aborted' };

export type SimCommandType = SimCommand['type'];
