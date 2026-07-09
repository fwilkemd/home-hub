/**
 * App shell (workstream D): phase switch, the single global keydown handler,
 * and overlay composition. src/main.tsx mounts <App /> into #ui.
 */
import { lazy, Suspense, useEffect } from 'react';
import './styles.css';
import { hubActions, hubStore, useHub } from '../bridge/store';
import { getWorld } from '../bridge/session';
import { MainMenu } from './MainMenu';
import { SettingsModal } from './SettingsModal';
import { Hud } from './hud/Hud';
import { Toasts } from './hud/Cards';
import { Workstation } from './emr/Workstation';
import { ZoomOverlay } from './ZoomOverlay';
import { RadialMenu } from './RadialMenu';
import { SitePicker } from './procedures/SitePicker';
import { ProcedureOverlayHost } from './procedures/ProcedureOverlayHost';
import { DebriefScreen } from './DebriefScreen';
import { equipTool, HOTBAR_TOOLS, stepTimeScale, togglePause } from './tools';

/** Lazy so the AI module costs nothing unless enabled in settings. */
const ChatDock = lazy(() => import('../ai/ChatDrawer'));

export function App() {
  const phase = useHub((s) => s.phase);
  useGlobalKeys(phase === 'running');
  return (
    <>
      {phase === 'menu' && <MainMenu />}
      {phase === 'loading' && <LoadingVeil />}
      {phase === 'running' && <RunningLayer />}
      {phase === 'debrief' && <DebriefScreen />}
      <Toasts />
      <SettingsGate />
    </>
  );
}

function LoadingVeil() {
  return (
    <div className="loadveil">
      <div className="spinner" aria-hidden="true" />
      <span>Preparing the room</span>
    </div>
  );
}

function RunningLayer() {
  const workstationOpen = useHub((s) => s.workstationOpen);
  const zoomDevice = useHub((s) => s.zoomDevice);
  const radialOpen = useHub((s) => s.radialOpen);
  const llmOn = useHub((s) => s.settings.llmEnabled && s.settings.llmKey.trim().length > 0);
  return (
    <>
      {/* before the HUD so crosshair + procedure panel paint above it */}
      <ProcedureOverlayHost />
      <Hud />
      {workstationOpen && <Workstation />}
      {zoomDevice !== null && <ZoomOverlay device={zoomDevice} />}
      {radialOpen && <RadialMenu />}
      <SitePicker />
      {llmOn && (
        <Suspense fallback={null}>
          <ChatDock />
        </Suspense>
      )}
    </>
  );
}

function SettingsGate() {
  const open = useHub((s) => s.settingsOpen);
  return open ? <SettingsModal /> : null;
}

// ================================================================ keyboard
function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * The ONE window keydown handler, active while a scenario runs.
 * Tab workstation · Q radial · Esc close-topmost · 1-6 tools · Space pause ·
 * [ ] - + time scale. WASD/E/F/C/V belong to the world while pointer-locked.
 */
function useGlobalKeys(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const s = hubStore.getState();
      if (s.phase !== 'running') return;

      // Tab ALWAYS toggles the workstation and never moves browser focus.
      if (e.key === 'Tab') {
        e.preventDefault();
        if (s.workstationOpen) {
          hubActions.closeWorkstation();
        } else {
          hubActions.openWorkstation();
          getWorld()?.exitPointerLock();
        }
        return;
      }

      // Esc closes the topmost overlay; with nothing open (and pointer not
      // locked — the browser owns Esc while locked) it opens settings.
      if (e.key === 'Escape') {
        if (s.radialOpen) hubActions.setRadial(false);
        else if (s.zoomDevice !== null) hubActions.closeZoom();
        else if (s.workstationOpen) hubActions.closeWorkstation();
        else if (s.settingsOpen) hubActions.setSettingsOpen(false);
        else if (!s.pointerLocked) hubActions.setSettingsOpen(true);
        return;
      }

      if (isEditable(e.target)) return; // don't steal keys from text fields

      const overlayOpen =
        s.workstationOpen || s.zoomDevice !== null || s.radialOpen || s.settingsOpen;

      if (e.key === 'q' || e.key === 'Q') {
        const otherOverlay = s.workstationOpen || s.zoomDevice !== null || s.settingsOpen;
        if (!otherOverlay) {
          const opening = !s.radialOpen;
          hubActions.setRadial(opening);
          if (opening) getWorld()?.exitPointerLock();
        }
        return;
      }

      if (!overlayOpen && e.key >= '1' && e.key <= '6') {
        equipTool(HOTBAR_TOOLS[Number(e.key) - 1]);
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (e.key === '[' || e.key === '-') {
        stepTimeScale(-1);
        return;
      }
      if (e.key === ']' || e.key === '+' || e.key === '=') {
        stepTimeScale(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}
