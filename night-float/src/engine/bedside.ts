/**
 * Bedside interactions: physical exam text (with state-aware defaults),
 * ultrasound view/freeze/clip tracking, and NIBP cycling (manual, nurse-cuff
 * and automatic interval).
 */
import type { BodyZoneId, UsViewId } from '../contracts/ids';
import type { ExamMode } from '../contracts/commands';
import type { EngineCtx } from './types';
import { clamp01 } from './types';

const CUFF_TIME_S = 30; // TODO(MEDICAL): NIBP cuff cycle time

export interface BedsideHandle {
  tick(t: number, dt: number): void;
  performExam(zone: BodyZoneId, mode: ExamMode): void;
  /** start a cuff cycle; NibpMeasured lands CUFF_TIME_S later */
  requestNibp(): void;
  /** instantaneous measurement (nurse just finished her cuff task) */
  measureNibpNow(): void;
  setUsView(view: UsViewId | null): void;
  setUsQuality(q: number): void;
  setUsFrozen(frozen: boolean): void;
  saveUsClip(view: UsViewId): void;
  getUsView(): UsViewId | null;
}

const LUNG_TEXT: Record<string, string> = {
  clear: 'Clear breath sounds.',
  crackles: 'Coarse crackles.',
  wheeze: 'Diffuse expiratory wheezes.',
  diminished: 'Diminished breath sounds.',
  absent: 'No breath sounds.',
};

/**
 * Fallback exam text when the scenario didn't author a zone. A few
 * state-aware touches so the body tells the story.
 * TODO(MEDICAL): real exam findings taxonomy per zone/mode/state.
 */
export function defaultExam(
  zone: BodyZoneId,
  mode: ExamMode,
  ctx: Pick<EngineCtx, 'patient' | 'effective'>,
): string {
  const { patient, effective } = ctx;
  const v = patient.vitals;
  const sedation = clamp01(effective['sedation'] ?? 0);
  const perfusion = clamp01(effective['perfusionEff'] ?? effective['perfusion'] ?? 0.8);
  const limb = zone.startsWith('arm_') || zone.startsWith('leg_');
  const chest = zone === 'chest_left' || zone === 'chest_right';
  const hasEtt = patient.lines.some((l) => l.type === 'ett');

  if (mode === 'inspect') {
    if (zone === 'head') {
      if (sedation >= 0.7) return 'Eyes closed; no response to voice.';
      if (sedation >= 0.3) return 'Drowsy; opens eyes to voice.';
      return hasEtt ? 'ETT secured at the lips; tolerating the tube.' : 'Awake, no acute distress.';
    }
    if (chest || zone === 'precordium')
      return v.rr > 24 ? 'Tachypneic with accessory muscle use.' : 'Symmetric chest rise.';
    if (zone === 'abdomen') return 'Non-distended.';
    if (limb) return perfusion < 0.45 ? 'Mottled, dusky skin.' : 'Warm, well-perfused skin.';
    return 'Unremarkable.';
  }

  if (mode === 'palpate') {
    if (limb) return perfusion < 0.45 ? 'Cool to the touch; thready distal pulse.' : 'Warm; 2+ distal pulses.';
    if (zone === 'abdomen') return 'Soft, non-tender.';
    if (zone === 'precordium') return 'PMI non-displaced.';
    if (zone === 'neck') return 'Trachea midline; no subcutaneous crepitus.';
    return 'Unremarkable.';
  }

  // auscultate
  if (zone === 'precordium') {
    const irregular = v.rhythm === 'afib';
    const fast = v.hr > 110;
    return `${irregular ? 'Irregularly irregular' : 'Regular'} ${fast ? 'tachycardic ' : ''}heart sounds, no murmur appreciated.`;
  }
  if (chest) {
    const recipe = patient.exam[zone]?.auscultation.lungRecipe ?? 'clear';
    return LUNG_TEXT[recipe] ?? LUNG_TEXT.clear;
  }
  if (zone === 'abdomen') return 'Soft bowel sounds present.';
  return 'Nothing abnormal on auscultation.';
}

export function createBedside(ctx: EngineCtx): BedsideHandle {
  const rng = ctx.rng.nibp;
  let cuffDoneAt: number | null = null;
  let nextAutoAt = ctx.patient.devices.monitor.nibpIntervalMin * 60;
  let usView: UsViewId | null = null;
  let usFrozen = false;
  let usQuality = 1;
  void usFrozen;
  void usQuality;

  function measureNibpNow(): void {
    const v = ctx.patient.vitals;
    // small deterministic cuff noise TODO(MEDICAL): NIBP vs arterial offsets
    const jitter = () => Math.round(rng.gauss() * 2);
    const sbp = Math.max(20, Math.round(v.sbp) + jitter());
    const dbp = Math.max(10, Math.round(v.dbp) + jitter());
    ctx.emit({ type: 'NibpMeasured', sbp, dbp, map: Math.round((sbp + 2 * dbp) / 3) });
  }

  function requestNibp(): void {
    if (cuffDoneAt === null) cuffDoneAt = ctx.now() + CUFF_TIME_S;
  }

  function tick(t: number, _dt: number): void {
    if (cuffDoneAt !== null && t >= cuffDoneAt) {
      cuffDoneAt = null;
      measureNibpNow();
    }
    const intervalS = Math.max(ctx.patient.devices.monitor.nibpIntervalMin, 1) * 60;
    if (t >= nextAutoAt) {
      nextAutoAt = t + intervalS;
      requestNibp();
    }
  }

  function performExam(zone: BodyZoneId, mode: ExamMode): void {
    const rec = ctx.patient.exam[zone];
    let text: string | undefined;
    if (mode === 'inspect') text = rec?.inspect;
    else if (mode === 'palpate') text = rec?.palpate;
    else text = rec?.auscultateText;
    if (!text || text === 'Unremarkable.') text = defaultExam(zone, mode, ctx);
    ctx.emit({ type: 'ExamPerformed', zone, mode, findingsText: text });
  }

  return {
    tick,
    performExam,
    requestNibp,
    measureNibpNow,
    setUsView(view) {
      if (view === usView) return;
      usView = view;
      ctx.emit({ type: 'UsViewChanged', view });
    },
    setUsQuality(q) {
      usQuality = clamp01(q);
    },
    setUsFrozen(frozen) {
      usFrozen = frozen;
    },
    saveUsClip(view) {
      ctx.emit({ type: 'UsClipSaved', view, mediaId: ctx.nextId('us') });
    },
    getUsView: () => usView,
  };
}
