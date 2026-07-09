/**
 * Orders — the EMR's main "act" verb. UI builds an OrderDraft, the engine
 * stamps id/time/status and emits OrderPlaced; the nurse task system and
 * engine subsystems consume it.
 */
import type { MedRoute } from './ids';
import type { VentSettings } from './patient';

export type OrderStatus = 'active' | 'in_progress' | 'completed' | 'discontinued';

export interface MedOrderPayload {
  kind: 'med';
  drugId: string;
  mode: 'bolus' | 'infusion';
  /** bolus dose in the drug's bolus doseUnit */
  dose?: number;
  doseUnit?: string;
  route: MedRoute;
  /** infusion starting rate in the drug's infusion doseUnit */
  rate?: number;
  rateUnit?: string;
}

export interface LabOrderPayload {
  kind: 'lab';
  panelId: string;
  stat: boolean;
}

export interface ImagingOrderPayload {
  kind: 'imaging';
  study: 'cxr';
}

export interface VentOrderPayload {
  kind: 'vent';
  settings: Partial<VentSettings>;
  note?: string;
}

export type NursingTask = 'cycle_nibp' | 'draw_labs' | 'reposition' | 'custom';
export interface NursingOrderPayload {
  kind: 'nursing';
  task: NursingTask;
  text: string;
}

export type OrderPayload =
  | MedOrderPayload
  | LabOrderPayload
  | ImagingOrderPayload
  | VentOrderPayload
  | NursingOrderPayload;

export type OrderDraft = OrderPayload & {
  /** human-readable one-liner, e.g. "norepinephrine gtt 0.05 mcg/kg/min" */
  label: string;
  /** verbal orders bypass the workstation but produce the same records */
  verbal?: boolean;
};

export type Order = OrderDraft & {
  id: string;
  t: number;
  status: OrderStatus;
};

// ---------------------------------------------------------------- verbal
/** Structured quick orders from the radial menu / command bar (SPEC §11.2). */
export type VerbalOrder =
  | { kind: 'push_med'; drugId: string; dose: number }
  | { kind: 'bolus_fluids'; volumeMl: number }
  | { kind: 'titrate'; infusionId: string; deltaSteps: number }
  | { kind: 'stat_lab'; panelId: string }
  | { kind: 'call_rt' }
  | { kind: 'cycle_nibp' };

// ---------------------------------------------------------------- MAR
export interface MarEntry {
  id: string;
  t: number;
  drugId: string;
  label: string;
  kind: 'bolus' | 'infusion_start' | 'infusion_change' | 'infusion_stop';
  dose?: number;
  unit?: string;
  route?: string;
  by: 'nurse' | 'player';
}
