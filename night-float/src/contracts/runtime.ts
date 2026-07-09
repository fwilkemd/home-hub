/**
 * Module-boundary types: what the engine, world, screens, UI and audio expose
 * to each other. These are the seams the Phase-1 workstreams build against.
 */
import type {
  AlarmPriority,
  DeviceId,
  EmrTab,
  NurseStation,
  TimeScale,
  ToolId,
  UsViewId,
  ViewpointId,
} from './ids';
import type { PatientState, VitalSigns } from './patient';
import type { SimCommand } from './commands';
import type { SimEvent, LabResult } from './events';
import type { Order, MarEntry } from './orders';
import type { ScenarioFile, ProcedureDefinition } from './content';
import type { VentWaveParams, WaveformParams } from './waveforms';

// ================================================================ engine
export interface EngineOptions {
  /** overrides the scenario's seed (tests) */
  seed?: number;
  /** called synchronously for every appended SimEvent */
  onEvent?: (e: SimEvent) => void;
  /** resume from a serialized save (see EngineHandle.serialize) */
  restore?: EngineSave;
}

export interface EngineSave {
  version: 1;
  scenarioId: string;
  savedAtSim: number;
  /** engine-owned opaque payload */
  blob: unknown;
}

export interface EngineHandle {
  readonly scenario: ScenarioFile;
  /** advance real seconds; engine applies time compression + 10 Hz stepping */
  advance(realDtS: number): void;
  /** step exactly n sim seconds (tests, debug) */
  stepSim(simSeconds: number): void;
  dispatch(cmd: SimCommand): void;
  getPatient(): PatientState;
  getVitals(): VitalSigns;
  getWaveformParams(): WaveformParams;
  getVentWave(): VentWaveParams;
  getSimTime(): number;
  getTimeScale(): TimeScale;
  getLog(): readonly SimEvent[];
  getActiveAlarms(): ActiveAlarm[];
  /** current breath phase 0..1 (inhale start -> next inhale) for chest rise + audio */
  getBreathPhase(): number;
  isEnded(): boolean;
  serialize(): EngineSave;
  // ---- implemented by Phase 1B/3 engine subsystems (bridge tolerates absence)
  getProcedureRuntime?(): ProcedureRuntime | null;
  getNurseView?(): NurseView;
  getTutorialView?(): TutorialView | null;
}

export interface TutorialView {
  stepIndex: number;
  total: number;
  text: string | null;
}

// ================================================================ alarms
export interface ActiveAlarm {
  id: string;
  source: DeviceId;
  priority: AlarmPriority;
  label: string;
  raisedAt: number;
  /** condition currently true */
  active: boolean;
  /** latched alarms stay visible until acknowledged even if resolved */
  latched: boolean;
  silencedUntil: number;
}

// ================================================================ store rows
export interface FlowsheetPoint {
  t: number;
  hr: number;
  map: number;
  sbp: number;
  dbp: number;
  spo2: number;
  rr: number;
  tempC: number;
  etco2?: number;
  source: 'auto' | 'nibp';
}

export interface ResultedPanel {
  id: string; // orderId
  t: number;
  panelId: string;
  panelName: string;
  stat: boolean;
  results: LabResult[];
}

export interface PendingLab {
  orderId: string;
  panelId: string;
  panelName: string;
  stat: boolean;
  resultsAt: number;
}

export interface MediaItem {
  id: string;
  t: number;
  kind: 'us_still' | 'cxr';
  label: string;
  view?: UsViewId;
  dataUrl: string;
  findingsText?: string;
}

export interface NoteItem {
  id: string;
  t: number;
  text: string;
}

export interface Toast {
  id: string;
  text: string;
  kind: 'info' | 'alarm' | 'success' | 'tutorial';
  until: number; // real-time ms epoch
}

export interface NurseView {
  station: NurseStation;
  /** where she's headed (world animates the walk) */
  target: NurseStation;
  busyWith: string | null; // task label
  say: string | null;
  sayUntilReal: number; // ms epoch
}

export interface ProcedureRuntimeStep {
  id: string;
  prompt: string;
  detail?: string;
  interaction: string;
  overlay: 'us_procedural' | 'laryngoscopy' | 'none';
  status: 'pending' | 'active' | 'done' | 'skipped';
  skippable: boolean;
}

export interface ProcedureRuntime {
  procedureId: string;
  name: string;
  site: string;
  sterile: boolean;
  contaminated: boolean;
  startedAt: number;
  stepIndex: number;
  steps: ProcedureRuntimeStep[];
  definition: ProcedureDefinition;
}

export interface RubricResult {
  id: string;
  label: string;
  detail?: string;
  points: number;
  earned: number;
  pass: boolean;
}

export interface DebriefData {
  scenarioId: string;
  title: string;
  outcome: 'success' | 'death' | 'timeout' | 'aborted';
  summary: string;
  endedAtSim: number;
  score: number;
  maxScore: number;
  rubric: RubricResult[];
  events: SimEvent[];
  vitalsSeries: FlowsheetPoint[];
}

// ================================================================ interaction
/** A context action offered by whatever the player is looking at. */
export interface ContextAction {
  id: string;
  label: string;
  /** dispatched to the engine when chosen */
  command?: SimCommand;
  /** or a UI-side action the bridge interprets */
  ui?:
    | { type: 'openZoom'; device: DeviceId }
    | { type: 'openWorkstation'; tab?: EmrTab }
    | { type: 'equipTool'; tool: ToolId | null }
    | { type: 'openDrawer'; drawerId: string }
    | { type: 'startProcedureFlow'; procedureId: string };
}

export interface HoverInfo {
  targetId: string;
  label: string;
  actions: ContextAction[];
}

// ================================================================ world
export interface WorldDeps {
  /** live reads — called per frame */
  getPatient: () => PatientState | null;
  getWaveforms: () => WaveformParams | null;
  getBreathPhase: () => number;
  getSimTime: () => number;
  /** world -> app: hover changed, action chosen, pointer lock changed */
  onHover: (h: HoverInfo | null) => void;
  onAction: (a: ContextAction) => void;
  onPointerLock: (locked: boolean) => void;
}

export interface DevicePlacement {
  device: DeviceId;
  /** world position for audio spatialization */
  position: [number, number, number];
}

export interface WorldHandle {
  mount(container: HTMLElement): void;
  /** bind offscreen canvases as emissive screen textures */
  attachScreen(device: DeviceId, canvas: HTMLCanvasElement): void;
  update(realDtS: number): void;
  resize(): void;
  dispose(): void;
  teleport(viewpoint: ViewpointId): void;
  setDebugCam(on: boolean): void;
  requestPointerLock(): void;
  exitPointerLock(): void;
  getDevicePlacements(): DevicePlacement[];
  /** current camera pose for audio listener */
  getListenerPose(): { position: [number, number, number]; forward: [number, number, number] };
}

// ================================================================ screens
export interface DeviceScreenInstance {
  device: DeviceId;
  canvas: HTMLCanvasElement;
  /** draw if due (throttled internally); called every rAF */
  update(realTimeS: number): void;
  /** handle a click at canvas-space coords in the zoom overlay */
  click(x: number, y: number): void;
  /** optional continuous pointer for knobs/sliders */
  drag?(x: number, y: number, phase: 'start' | 'move' | 'end'): void;
}

export interface ScreensHandle {
  monitor: DeviceScreenInstance;
  vent: DeviceScreenInstance;
  pump: DeviceScreenInstance;
  us: DeviceScreenInstance;
  updateAll(realTimeS: number): void;
  dispose(): void;
}

// ================================================================ test api
export interface NfTestApi {
  ready: boolean;
  startScenario(id: string): Promise<void>;
  teleport(v: ViewpointId): void;
  setDebugCam(on: boolean): void;
  dispatch(cmd: SimCommand): void;
  advanceSim(seconds: number): void;
  getSnapshot(): {
    phase: string;
    simTime: number;
    engineEnded: boolean | null;
    vitals: VitalSigns | null;
    alarms: ActiveAlarm[];
    orders: Order[];
    mar: MarEntry[];
  };
  openWorkstation(tab?: EmrTab): void;
  closeWorkstation(): void;
  openZoom(device: DeviceId): void;
  closeZoom(): void;
}

declare global {
  interface Window {
    __nf?: NfTestApi;
  }
}
