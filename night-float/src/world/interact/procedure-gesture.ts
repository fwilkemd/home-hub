/**
 * Diegetic procedure gesture (SPEC §9): while pointer-locked with an active
 * click_hold / align_hold step, holding E accumulates progress (heldTime /
 * holdS); releasing early loses it; reaching 1.0 advances the step. Progress
 * is published ~20 Hz via hubActions.setProcedureHold for the HUD ring.
 * Requirements: player within reach of the patient; align_hold additionally
 * needs the center-screen ray on a patient zone (read from store.hover, which
 * the hover raycast keeps current while locked).
 *
 * Also owns the sterile-field bookkeeping (SPEC §9.2): once a gown/glove/
 * drape step of a sterile procedure is done, any world action the player
 * fires on a NON-patient target dispatches ContaminateSterileField once per
 * distinct target.
 */
import type { HoverInfo } from '../../contracts/runtime';
import type { WorldCtx, Updater } from '../types';
import type * as THREE from 'three';
import { hubActions, hubStore, type HubState } from '../../bridge/store';

const REACH_M = 2.2;
const REPORT_S = 0.05; // ~20 Hz
const STERILE_STEP_RX = /gown|glove|drape|sterile/i;

export interface ProcedureGesture {
  update: Updater;
  /** true while an active hold step owns the E key (suppress hover actions) */
  capturesE(): boolean;
  /** call before forwarding a hover action — sterile-field contamination */
  noteWorldAction(hover: HoverInfo | null): void;
  dispose(): void;
}

interface ActiveHold {
  stepId: string;
  interaction: string;
  holdS: number;
}

function activeHold(s: HubState): ActiveHold | null {
  const proc = s.procedure;
  if (!proc) return null;
  const step = proc.steps[proc.stepIndex];
  if (!step || step.status !== 'active') return null;
  if (step.interaction !== 'click_hold' && step.interaction !== 'align_hold') return null;
  return {
    stepId: step.id,
    interaction: step.interaction,
    holdS: proc.definition.steps[proc.stepIndex]?.holdS ?? 1.2,
  };
}

export function createProcedureGesture(ctx: WorldCtx, patientCenter: THREE.Vector3): ProcedureGesture {
  let eHeld = false;
  let armed = false; // a completed hold requires a fresh press for the next step
  let heldS = 0;
  let throttle = 1; // >= REPORT_S so the first sample publishes immediately
  let reported: { stepId: string; progress: number } | null = null;
  let procKey: string | null = null;
  const touched = new Set<string>(); // contamination once per distinct target

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyE' && !e.repeat) {
      eHeld = true;
      armed = true;
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'KeyE') {
      eHeld = false;
      armed = false;
    }
  };
  const onBlur = (): void => {
    eHeld = false;
    armed = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const clearProgress = (): void => {
    heldS = 0;
    throttle = 1;
    if (reported) {
      reported = null;
      hubActions.setProcedureHold(null);
    }
  };

  const update: Updater = (dt) => {
    const s = hubStore.getState();
    const key = s.procedure ? `${s.procedure.procedureId}:${s.procedure.startedAt}` : null;
    if (key !== procKey) {
      procKey = key;
      touched.clear();
    }
    const hold = activeHold(s);
    if (!hold || !s.pointerLocked) {
      clearProgress();
      return;
    }
    // the mirror advanced to a new step mid-hold — start over
    if (reported && reported.stepId !== hold.stepId) clearProgress();
    if (!eHeld || !armed) {
      // release before 1.0 -> progress lost (that's the game)
      if (heldS > 0 || reported) clearProgress();
      return;
    }

    const near = ctx.camera.position.distanceTo(patientCenter) <= REACH_M;
    const aimed =
      hold.interaction !== 'align_hold' || (s.hover?.targetId ?? '').startsWith('zone_');
    if (near && aimed) heldS += dt; // conditions unmet: progress freezes, not lost

    const progress = hold.holdS > 0 ? Math.min(1, heldS / hold.holdS) : 1;
    if (progress >= 1) {
      ctx.deps.onAction({
        id: 'proc-hold-complete',
        label: '',
        command: { type: 'AdvanceProcedureStep', stepId: hold.stepId },
      });
      armed = false; // next hold step needs a fresh press
      clearProgress();
      return;
    }
    throttle += dt;
    if (throttle >= REPORT_S) {
      throttle = 0;
      if (
        !reported ||
        reported.stepId !== hold.stepId ||
        Math.abs(progress - reported.progress) >= 0.005
      ) {
        reported = { stepId: hold.stepId, progress };
        hubActions.setProcedureHold(reported);
      }
    }
  };

  const capturesE = (): boolean => {
    const s = hubStore.getState();
    return s.pointerLocked && activeHold(s) !== null;
  };

  const noteWorldAction = (hover: HoverInfo | null): void => {
    if (!hover || hover.targetId.startsWith('zone_')) return; // the patient IS the field
    const s = hubStore.getState();
    const proc = s.procedure;
    if (!proc || !proc.sterile || proc.contaminated) return;
    const fieldUp = proc.steps.some(
      (st) => st.status === 'done' && STERILE_STEP_RX.test(`${st.id} ${st.prompt}`),
    );
    if (!fieldUp || touched.has(hover.targetId)) return;
    touched.add(hover.targetId);
    ctx.deps.onAction({
      id: 'sterile-contaminated',
      label: '',
      command: { type: 'ContaminateSterileField', what: hover.label },
    });
  };

  return {
    update,
    capturesE,
    noteWorldAction,
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      clearProgress();
    },
  };
}
