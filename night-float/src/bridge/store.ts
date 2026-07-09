/**
 * The zustand store bridging engine -> world -> UI (SPEC §3).
 *
 * SHAPE IS A CONTRACT: Phase-1 workstreams read/write ONLY via the exported
 * actions; do not add/rename slices without the integration owner. The world
 * reads imperatively via hubStore.getState() in its frame loop; React uses
 * useHub(selector).
 */
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type {
  DeviceId,
  EmrTab,
  TimeScale,
  ToolId,
  UsViewId,
} from '../contracts/ids';
import type { PatientState, VitalSigns } from '../contracts/patient';
import type { SimEvent } from '../contracts/events';
import type { Order, MarEntry } from '../contracts/orders';
import type { VentWaveParams, WaveformParams } from '../contracts/waveforms';
import type {
  ActiveAlarm,
  DebriefData,
  FlowsheetPoint,
  HoverInfo,
  MediaItem,
  NoteItem,
  NurseView,
  PendingLab,
  ProcedureRuntime,
  ResultedPanel,
  Toast,
  TutorialView,
} from '../contracts/runtime';

export type AppPhase = 'menu' | 'loading' | 'running' | 'debrief';

export interface UsUiState {
  activeView: UsViewId | null;
  frozen: boolean;
  depth: number; // 1..3 relative depth scale
  gain: number; // 0..1
  /** 0..1 window quality from probe micro-positioning */
  quality: number;
  mode: 'diagnostic' | 'procedural';
}

export interface LastExamCard {
  zone: string;
  mode: string;
  text: string;
  untilReal: number;
}

export interface SettingsState {
  masterVol: number;
  sfxVol: number;
  ambienceVol: number;
  llmEnabled: boolean;
  llmKey: string;
}

export interface HubState {
  // ---- app lifecycle
  phase: AppPhase;
  scenarioId: string | null;
  scenarioTitle: string;
  clockStart: string; // "03:00" wall label at t=0
  // ---- sim mirrors (synced by the bridge loop; read-only for UI/world)
  simTime: number;
  timeScale: TimeScale;
  vitals: VitalSigns | null;
  patient: PatientState | null;
  waveforms: WaveformParams | null;
  ventWave: VentWaveParams | null;
  alarms: ActiveAlarm[];
  breathPhase: number;
  // ---- accumulated records
  events: SimEvent[];
  orders: Order[];
  mar: MarEntry[];
  labResults: ResultedPanel[];
  pendingLabs: PendingLab[];
  flowsheet: FlowsheetPoint[];
  media: MediaItem[];
  notes: NoteItem[];
  // ---- people
  nurse: NurseView;
  // ---- player / interaction
  heldTool: ToolId | null;
  hover: HoverInfo | null;
  pointerLocked: boolean;
  // ---- overlays
  workstationOpen: boolean;
  emrTab: EmrTab;
  zoomDevice: DeviceId | null;
  radialOpen: boolean;
  settingsOpen: boolean;
  helpOpen: boolean;
  // ---- subsystem UI state
  us: UsUiState;
  procedure: ProcedureRuntime | null;
  lastExam: LastExamCard | null;
  debrief: DebriefData | null;
  toasts: Toast[];
  tutorial: TutorialView | null;
  settings: SettingsState;
  debugCam: boolean;
}

const initialNurse: NurseView = {
  station: 'station',
  target: 'station',
  busyWith: null,
  say: null,
  sayUntilReal: 0,
};

export const initialUsState: UsUiState = {
  activeView: null,
  frozen: false,
  depth: 2,
  gain: 0.5,
  quality: 0.85,
  mode: 'diagnostic',
};

const initialState: HubState = {
  phase: 'menu',
  scenarioId: null,
  scenarioTitle: '',
  clockStart: '03:00',
  simTime: 0,
  timeScale: 1,
  vitals: null,
  patient: null,
  waveforms: null,
  ventWave: null,
  alarms: [],
  breathPhase: 0,
  events: [],
  orders: [],
  mar: [],
  labResults: [],
  pendingLabs: [],
  flowsheet: [],
  media: [],
  notes: [],
  nurse: initialNurse,
  heldTool: null,
  hover: null,
  pointerLocked: false,
  workstationOpen: false,
  emrTab: 'chart',
  zoomDevice: null,
  radialOpen: false,
  settingsOpen: false,
  helpOpen: false,
  us: initialUsState,
  procedure: null,
  lastExam: null,
  debrief: null,
  toasts: [],
  tutorial: null,
  settings: { masterVol: 0.8, sfxVol: 0.9, ambienceVol: 0.7, llmEnabled: false, llmKey: '' },
  debugCam: false,
};

export const hubStore = createStore<HubState>()(() => ({ ...initialState }));

/** React hook. */
export function useHub<T>(selector: (s: HubState) => T): T {
  return useStore(hubStore, selector);
}

// ================================================================ actions
// Small, single-purpose mutators. Everything sim-side flows through
// bridge/session dispatch — these only touch UI/mirror state.
let toastCounter = 0;

export const hubActions = {
  reset(): void {
    hubStore.setState({ ...initialState, settings: hubStore.getState().settings }, true);
  },
  set(partial: Partial<HubState>): void {
    hubStore.setState(partial);
  },
  toast(text: string, kind: Toast['kind'] = 'info', ttlMs = 5000): void {
    const t: Toast = { id: `toast-${++toastCounter}`, text, kind, until: Date.now() + ttlMs };
    hubStore.setState((s) => ({ toasts: [...s.toasts.filter((x) => x.until > Date.now()), t] }));
  },
  pruneToasts(): void {
    const now = Date.now();
    const { toasts } = hubStore.getState();
    if (toasts.some((t) => t.until <= now)) {
      hubStore.setState({ toasts: toasts.filter((t) => t.until > now) });
    }
  },
  openWorkstation(tab?: EmrTab): void {
    hubStore.setState((s) => ({
      workstationOpen: true,
      emrTab: tab ?? s.emrTab,
      radialOpen: false,
      zoomDevice: null,
    }));
  },
  closeWorkstation(): void {
    hubStore.setState({ workstationOpen: false });
  },
  openZoom(device: DeviceId): void {
    hubStore.setState({ zoomDevice: device, workstationOpen: false, radialOpen: false });
  },
  closeZoom(): void {
    hubStore.setState({ zoomDevice: null });
  },
  setEmrTab(tab: EmrTab): void {
    hubStore.setState({ emrTab: tab });
  },
  setRadial(open: boolean): void {
    hubStore.setState({ radialOpen: open });
  },
  setSettingsOpen(open: boolean): void {
    hubStore.setState({ settingsOpen: open });
  },
  setHelpOpen(open: boolean): void {
    hubStore.setState({ helpOpen: open });
  },
  setHover(h: HoverInfo | null): void {
    const cur = hubStore.getState().hover;
    if (cur === h) return;
    if (cur && h && cur.targetId === h.targetId && cur.label === h.label) return;
    hubStore.setState({ hover: h });
  },
  setPointerLocked(locked: boolean): void {
    hubStore.setState({ pointerLocked: locked });
  },
  setHeldTool(tool: ToolId | null): void {
    hubStore.setState({ heldTool: tool });
  },
  setUs(patch: Partial<UsUiState>): void {
    hubStore.setState((s) => ({ us: { ...s.us, ...patch } }));
  },
  updateSettings(patch: Partial<SettingsState>): void {
    hubStore.setState((s) => {
      const settings = { ...s.settings, ...patch };
      try {
        localStorage.setItem('nf-settings', JSON.stringify(settings));
      } catch {}
      return { settings };
    });
  },
  loadSettings(): void {
    try {
      const raw = localStorage.getItem('nf-settings');
      if (raw) {
        hubStore.setState((s) => ({ settings: { ...s.settings, ...JSON.parse(raw) } }));
      }
    } catch {}
  },
};
