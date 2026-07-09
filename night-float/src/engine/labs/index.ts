/**
 * Labs + imaging subsystem (SPEC §5.4): order -> turnaround queue ->
 * LabResulted / ImagingResulted. Specimens are drawn by the nurse (she calls
 * orderDrawn); imaging is "sent to radiology" at order time. Stat results
 * auto-drop time compression.
 */
import { getLabPanel } from '../../data/labs';
import type { LabResult, LabFlag } from '../../contracts/events';
import type { LabTestDef } from '../../contracts/content';
import type { PatientState } from '../../contracts/patient';
import type { EngineCtx } from '../types';
import { labGenerators } from './generators';

const CXR_TURNAROUND_S = 240; // TODO(MEDICAL): portable CXR realistic timing
const STAT_FRACTION = 0.5; // fallback when a panel lacks statTurnaroundS

interface PendingPanel {
  orderId: string;
  panelId: string;
  stat: boolean;
  resultsAt: number;
}

interface PendingImaging {
  orderId: string;
  study: string;
  mediaId: string;
  resultsAt: number;
}

export interface LabsHandle {
  tick(t: number, dt: number): void;
  /** nurse finished the bedside draw -> stamp turnaround + LabOrdered */
  orderDrawn(orderId: string, panelId: string, stat: boolean): void;
  /** imaging goes straight to the queue at order time */
  orderImaging(orderId: string, study: 'cxr'): void;
  serialize(): { panels: PendingPanel[]; imaging: PendingImaging[] };
  restore(state: { panels: PendingPanel[]; imaging: PendingImaging[] }): void;
}

function flagFor(test: LabTestDef, value: number): LabFlag {
  if (test.critLo !== undefined && value <= test.critLo) return 'crit_low';
  if (test.critHi !== undefined && value >= test.critHi) return 'crit_high';
  if (value < test.refLo) return 'low';
  if (value > test.refHi) return 'high';
  return 'normal';
}

function roundTo(value: number, precision: number): number {
  const f = Math.pow(10, precision);
  return Math.round(value * f) / f;
}

/** CXR findings text derived from state. TODO(MEDICAL): real read templates. */
export function buildCxrFindings(patient: PatientState): string {
  const lines: string[] = [];
  if (patient.lines.some((l) => l.type === 'ett'))
    lines.push('ETT tip 4 cm above the carina.'); // TODO(MEDICAL)
  if (patient.lines.some((l) => l.type === 'cvc'))
    lines.push('Central venous catheter tip at the cavoatrial junction.'); // TODO(MEDICAL)

  let maxB = 0;
  let maxEffusion = 0;
  for (const view of ['lung_ant_l', 'lung_ant_r', 'lung_post_l', 'lung_post_r'] as const) {
    const f = patient.us[view];
    if (f && f.kind === 'lung') {
      maxB = Math.max(maxB, f.bLines);
      maxEffusion = Math.max(maxEffusion, f.effusion);
    }
  }
  if (maxB >= 5) lines.push('Diffuse bilateral airspace opacities.');
  else if (maxB >= 2) lines.push('Patchy bibasilar opacities.');
  else lines.push('Lungs are clear.');
  if (maxEffusion >= 0.3) lines.push('Small pleural effusion with costophrenic blunting.');
  lines.push('No pneumothorax. Cardiomediastinal silhouette within normal limits.');
  return lines.join(' ');
}

export function createLabs(ctx: EngineCtx): LabsHandle {
  const panels: PendingPanel[] = [];
  const imaging: PendingImaging[] = [];
  const rng = ctx.rng.labs;

  function orderDrawn(orderId: string, panelId: string, stat: boolean): void {
    const panel = getLabPanel(panelId);
    if (!panel) {
      ctx.emit({ type: 'PlayerAction', action: 'LabOrder', detail: `unknown panel ${panelId}` });
      return;
    }
    const turnaround = stat ? (panel.statTurnaroundS ?? panel.turnaroundS * STAT_FRACTION) : panel.turnaroundS;
    const resultsAt = ctx.now() + turnaround;
    panels.push({ orderId, panelId, stat, resultsAt });
    ctx.emit({
      type: 'LabOrdered',
      orderId,
      panelId,
      panelName: panel.name,
      stat,
      resultsAt,
    });
  }

  function orderImaging(orderId: string, study: 'cxr'): void {
    const resultsAt = ctx.now() + CXR_TURNAROUND_S;
    const mediaId = ctx.nextId('img');
    imaging.push({ orderId, study, mediaId, resultsAt });
    ctx.emit({ type: 'ImagingOrdered', orderId, study, resultsAt });
  }

  function resultPanel(pending: PendingPanel): void {
    const panel = getLabPanel(pending.panelId);
    if (!panel) return;
    const results: LabResult[] = panel.tests.map((test) => {
      const gen = labGenerators[test.generator];
      const midpoint = (test.refLo + test.refHi) / 2;
      const raw = gen ? gen(ctx.patient, ctx.effective, rng) : midpoint;
      const value = roundTo(raw, test.precision);
      return {
        testId: test.id,
        name: test.name,
        value,
        unit: test.unit,
        refLo: test.refLo,
        refHi: test.refHi,
        flag: flagFor(test, value),
      };
    });
    ctx.emit({
      type: 'LabResulted',
      orderId: pending.orderId,
      panelId: pending.panelId,
      panelName: panel.name,
      results,
      stat: pending.stat,
    });
    ctx.emit({ type: 'OrderCompleted', orderId: pending.orderId });
    if (pending.stat) ctx.dropToRealtime('stat lab resulted');
  }

  function tick(t: number, _dt: number): void {
    for (let i = 0; i < panels.length; i++) {
      if (panels[i].resultsAt <= t) {
        const [due] = panels.splice(i, 1);
        i--;
        resultPanel(due);
      }
    }
    for (let i = 0; i < imaging.length; i++) {
      if (imaging[i].resultsAt <= t) {
        const [due] = imaging.splice(i, 1);
        i--;
        ctx.emit({
          type: 'ImagingResulted',
          orderId: due.orderId,
          study: due.study,
          findingsText: buildCxrFindings(ctx.patient),
          mediaId: due.mediaId,
        });
        ctx.emit({ type: 'OrderCompleted', orderId: due.orderId });
      }
    }
  }

  return {
    tick,
    orderDrawn,
    orderImaging,
    serialize: () => ({ panels: [...panels], imaging: [...imaging] }),
    restore: (state) => {
      panels.splice(0, panels.length, ...state.panels);
      imaging.splice(0, imaging.length, ...state.imaging);
    },
  };
}
