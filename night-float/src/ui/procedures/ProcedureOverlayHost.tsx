/**
 * Watches the mirrored procedure runtime and drives the automatic overlays
 * (SPEC §9.3): steps flagged 'us_procedural' flip the ultrasound to
 * procedural mode inside the device zoom; steps flagged 'laryngoscopy'
 * render the first-person airway view (painter created lazily, once per
 * procedure run). Everything restores itself when the step passes or the
 * procedure ends/aborts. Mounted BEFORE the HUD so the crosshair and the
 * procedure panel stay visible and clickable above the airway view.
 */
import { useEffect, useRef, useState } from 'react';
import { hubActions, hubStore } from '../../bridge/store';
import { getEngine, getWorld } from '../../bridge/session';
import {
  createLaryngoscopyPainter,
  type LaryngoscopyPainter,
} from '../../screens/laryngoscopy';
import { LaryngoscopyOverlay } from './LaryngoscopyOverlay';
import { useProcedure } from './useProcedure';

export function ProcedureOverlayHost() {
  const proc = useProcedure();
  const active = proc ? (proc.steps[proc.stepIndex] ?? null) : null;
  const procKey = proc ? `${proc.procedureId}:${proc.startedAt}` : null;

  // one painter per procedure run, created only if a laryngoscopy step shows
  const painterRef = useRef<{ key: string; painter: LaryngoscopyPainter } | null>(null);
  if (painterRef.current && painterRef.current.key !== procKey) painterRef.current = null;

  // per-step "player closed the view" flag; a new procedure starts fresh
  const [hiddenStep, setHiddenStep] = useState<string | null>(null);
  useEffect(() => setHiddenStep(null), [procKey]);

  // ---- us_procedural: procedural US inside the machine zoom, then restore
  const usOn = active?.overlay === 'us_procedural';
  useEffect(() => {
    if (!usOn) return;
    hubActions.setUs({ mode: 'procedural' });
    hubActions.openZoom('us_machine');
    getWorld()?.exitPointerLock();
    return () => {
      hubActions.setUs({ mode: 'diagnostic' });
      if (hubStore.getState().zoomDevice === 'us_machine') hubActions.closeZoom();
    };
  }, [usOn]);

  // ---- laryngoscopy slider steps need the cursor
  const laryngSlider = active?.overlay === 'laryngoscopy' && active.interaction === 'slider';
  useEffect(() => {
    if (laryngSlider) getWorld()?.exitPointerLock();
  }, [laryngSlider]);

  if (!proc || !active || active.overlay !== 'laryngoscopy' || !procKey) return null;

  if (hiddenStep === active.id) {
    return (
      <button className="laryng-reopen" onClick={() => setHiddenStep(null)}>
        Raise the laryngoscope view
      </button>
    );
  }

  const engine = getEngine();
  if (!engine) return null;
  if (!painterRef.current) {
    painterRef.current = { key: procKey, painter: createLaryngoscopyPainter(engine) };
  }
  return (
    <LaryngoscopyOverlay
      painter={painterRef.current.painter}
      sliderStep={active.interaction === 'slider' ? active : null}
      onClose={() => setHiddenStep(active.id)}
    />
  );
}
