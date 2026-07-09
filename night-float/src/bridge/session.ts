/**
 * Session manager — owns the running scenario: engine instance, frame loop,
 * store sync cadences, dispatch, debrief construction, save/export.
 * This is the ONLY module that holds the EngineHandle.
 */
import type { SimCommand } from '../contracts/commands';
import type {
  DebriefData,
  EngineHandle,
  EngineSave,
  ProcedureRuntime,
  WorldHandle,
} from '../contracts/runtime';
import type { ScreensHandle } from '../contracts/runtime';
import type { TimeScale } from '../contracts/ids';
import { getScenario, scenarios } from '../data/scenarios';
import { createEngine } from '../engine';
import { evaluateRubric } from '../engine/scenario/rubric';
import { applySimEvent, replayLogIntoStore } from './apply-event';
import { stashClipDataUrl } from './media';
import { hubActions, hubStore } from './store';
import { loadModules, type AppModules, type AudioHandle } from './modules';

interface Session {
  engine: EngineHandle;
  world: WorldHandle | null;
  screens: ScreensHandle | null;
  audio: AudioHandle | null;
  rafId: number;
  lastFrameMs: number;
  accSync: number;
  accSnapshot: number;
}

let session: Session | null = null;

export function getEngine(): EngineHandle | null {
  return session?.engine ?? null;
}
export function getWorld(): WorldHandle | null {
  return session?.world ?? null;
}
export function getScreens(): ScreensHandle | null {
  return session?.screens ?? null;
}

export function listScenarios() {
  return scenarios.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle ?? '',
    oneLiner: s.briefing.oneLiner,
  }));
}

// ================================================================ lifecycle
export async function startScenario(id: string, restore?: EngineSave): Promise<void> {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);
  stopSession();
  hubActions.reset();
  hubActions.set({
    phase: 'loading',
    scenarioId: id,
    scenarioTitle: scenario.title,
    clockStart: scenario.clockStart,
  });

  // events emitted during createEngine land before `session` exists:
  const queuedEvents: import('../contracts/events').SimEvent[] = [];
  let engineRef: EngineHandle | null = null;
  const engine = createEngine(scenario, {
    restore,
    onEvent: (e) => {
      if (engineRef) applySimEvent(e, engineRef);
      else queuedEvents.push(e);
    },
  });
  engineRef = engine;
  // resuming a save: rebuild the store's accumulated records from the log
  if (restore) replayLogIntoStore(engine);

  const modules: AppModules = await loadModules();

  let world: WorldHandle | null = null;
  let screens: ScreensHandle | null = null;
  let audio: AudioHandle | null = null;

  if (modules.createWorld) {
    world = modules.createWorld({
      getPatient: () => engine.getPatient(),
      getWaveforms: () => engine.getWaveformParams(),
      getBreathPhase: () => engine.getBreathPhase(),
      getSimTime: () => engine.getSimTime(),
      onHover: (h) => hubActions.setHover(h),
      onAction: (a) => runContextAction(a),
      onPointerLock: (locked) => hubActions.setPointerLocked(locked),
    });
    const container = document.getElementById('app');
    if (container) world.mount(container);
  }
  if (modules.createScreens) {
    screens = modules.createScreens(engine);
    if (world && screens) {
      world.attachScreen('monitor', screens.monitor.canvas);
      world.attachScreen('vent', screens.vent.canvas);
      world.attachScreen('pump', screens.pump.canvas);
      world.attachScreen('us_machine', screens.us.canvas);
    }
  }
  if (modules.createAudio) {
    audio = modules.createAudio(engine, world);
  }

  session = {
    engine,
    world,
    screens,
    audio,
    rafId: 0,
    lastFrameMs: performance.now(),
    accSync: 1,
    accSnapshot: 1,
  };
  for (const e of queuedEvents) applySimEvent(e, engine);
  syncMirrors(true);
  hubActions.set({ phase: 'running' });
  startLoop();
}

export function stopSession(): void {
  if (!session) return;
  cancelAnimationFrame(session.rafId);
  session.world?.dispose();
  session.screens?.dispose();
  session.audio?.dispose();
  session = null;
}

export function backToMenu(): void {
  stopSession();
  hubActions.reset();
}

// ================================================================ frame loop
function startLoop(): void {
  if (!session) return;
  const loop = (nowMs: number) => {
    if (!session) return;
    const dt = Math.min((nowMs - session.lastFrameMs) / 1000, 0.25);
    session.lastFrameMs = nowMs;
    frame(dt, nowMs / 1000);
    session.rafId = requestAnimationFrame(loop);
  };
  session.rafId = requestAnimationFrame(loop);
}

function frame(realDtS: number, realTimeS: number): void {
  if (!session) return;
  const { engine, world, screens, audio } = session;

  engine.advance(realDtS);

  world?.update(realDtS);
  screens?.updateAll(realTimeS);
  audio?.update(realDtS);

  // store sync cadences — cheap mirrors at 5 Hz, patient clone at 2 Hz
  session.accSync += realDtS;
  if (session.accSync >= 0.2) {
    session.accSync = 0;
    syncMirrors(false);
  }
  session.accSnapshot += realDtS;
  if (session.accSnapshot >= 0.5) {
    session.accSnapshot = 0;
    hubActions.set({
      patient: JSON.parse(JSON.stringify(session.engine.getPatient())),
    });
    hubActions.pruneToasts();
  }

  if (engine.isEnded() && hubStore.getState().phase === 'running') {
    finishScenario();
  }
}

/** Force an immediate mirror sync (test API — headless frames can be slow). */
export function syncNow(): void {
  syncMirrors(true);
}

// The engine hands back the SAME mutable ProcedureRuntime object every call;
// React selectors need a fresh reference exactly when something changed and a
// stable one otherwise. Fingerprint-gate a clone.
let procFingerprint = '';
let procMirror: ProcedureRuntime | null = null;

function mirrorProcedure(live: ProcedureRuntime | null): ProcedureRuntime | null {
  if (!live) {
    procFingerprint = '';
    procMirror = null;
    return null;
  }
  const fp = `${live.procedureId}|${live.startedAt}|${live.stepIndex}|${live.contaminated}|${live.steps
    .map((s) => s.status[0])
    .join('')}`;
  if (fp !== procFingerprint || !procMirror) {
    procFingerprint = fp;
    procMirror = JSON.parse(JSON.stringify(live));
  }
  return procMirror;
}

function syncMirrors(includePatient: boolean): void {
  if (!session) return;
  const { engine } = session;
  hubActions.set({
    simTime: engine.getSimTime(),
    timeScale: engine.getTimeScale(),
    vitals: engine.getVitals(),
    waveforms: engine.getWaveformParams(),
    ventWave: engine.getVentWave(),
    alarms: engine.getActiveAlarms(),
    breathPhase: engine.getBreathPhase(),
    procedure: mirrorProcedure(engine.getProcedureRuntime?.() ?? null),
    nurse: engine.getNurseView?.() ?? hubStore.getState().nurse,
    tutorial: engine.getTutorialView?.() ?? null,
    ...(includePatient
      ? { patient: JSON.parse(JSON.stringify(engine.getPatient())) }
      : {}),
  });
}

// ================================================================ commands
export function dispatch(cmd: SimCommand): void {
  const engine = session?.engine;
  if (!engine) return;
  if (cmd.type === 'UsSaveClip') stashClipDataUrl(cmd.dataUrl);
  engine.dispatch(cmd);
  // commands that must reflect immediately (not wait for the 5 Hz sync)
  if (cmd.type === 'SetTimeScale') {
    hubActions.set({ timeScale: engine.getTimeScale() });
  }
}

export function runContextAction(a: import('../contracts/runtime').ContextAction): void {
  if (a.command) dispatch(a.command);
  if (!a.ui) return;
  switch (a.ui.type) {
    case 'openZoom':
      hubActions.openZoom(a.ui.device);
      getWorld()?.exitPointerLock();
      break;
    case 'openWorkstation':
      hubActions.openWorkstation(a.ui.tab);
      getWorld()?.exitPointerLock();
      break;
    case 'equipTool':
      hubActions.setHeldTool(a.ui.tool);
      dispatch({ type: 'EquipTool', tool: a.ui.tool });
      break;
    case 'openDrawer':
      dispatch({ type: 'PlaceOrder', draft: { kind: 'nursing', task: 'custom', text: `opened drawer ${a.ui.drawerId}`, label: `Opened ${a.ui.drawerId}` } });
      break;
    case 'startProcedureFlow':
      // site choice happens in the UI (SitePicker); it dispatches StartProcedure
      hubActions.setSitePicker({ procedureId: a.ui.procedureId });
      getWorld()?.exitPointerLock();
      break;
  }
}

// ================================================================ debrief
function finishScenario(): void {
  if (!session) return;
  const { engine } = session;
  const log = engine.getLog();
  const end = [...log].reverse().find((e) => e.type === 'ScenarioEnded');
  const outcome = end && end.type === 'ScenarioEnded' ? end.outcome : 'aborted';
  const summary = end && end.type === 'ScenarioEnded' ? end.summary : '';
  const rubric = evaluateRubric(engine.scenario.rubric, log);
  const debrief: DebriefData = {
    scenarioId: engine.scenario.id,
    title: engine.scenario.title,
    outcome,
    summary,
    endedAtSim: engine.getSimTime(),
    score: rubric.reduce((a, r) => a + r.earned, 0),
    maxScore: rubric.reduce((a, r) => a + r.points, 0),
    rubric,
    events: [...log],
    vitalsSeries: hubStore.getState().flowsheet,
  };
  hubActions.set({ phase: 'debrief', debrief, workstationOpen: false, zoomDevice: null });
  getWorld()?.exitPointerLock();
}

// ================================================================ save/load
const SAVE_KEY = 'nf-save';

export function saveGame(): 'saved' | 'blocked' | 'failed' {
  const engine = session?.engine;
  if (!engine || engine.isEnded()) return 'blocked';
  // in-flight procedures aren't serialized (see DECISIONS.md)
  if (engine.getProcedureRuntime?.()) return 'blocked';
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(engine.serialize()));
    return 'saved';
  } catch {
    return 'failed';
  }
}

export function getSavedGame(): (EngineSave & { title: string; clockStart: string }) | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as EngineSave;
    if (save.version !== 1) return null;
    const scenario = getScenario(save.scenarioId);
    if (!scenario) return null;
    return { ...save, title: scenario.title, clockStart: scenario.clockStart };
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}

export async function loadSavedGame(): Promise<boolean> {
  const save = getSavedGame();
  if (!save) return false;
  await startScenario(save.scenarioId, save);
  return true;
}

// ================================================================ export
export function exportLogJson(): string {
  const engine = session?.engine;
  const debrief = hubStore.getState().debrief;
  const payload = {
    exportedAt: new Date().toISOString(),
    scenarioId: engine?.scenario.id ?? debrief?.scenarioId ?? null,
    log: engine ? engine.getLog() : (debrief?.events ?? []),
    debrief,
  };
  return JSON.stringify(payload, null, 2);
}

export function setTimeScale(scale: TimeScale): void {
  dispatch({ type: 'SetTimeScale', scale });
}
