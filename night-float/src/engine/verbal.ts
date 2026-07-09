/**
 * Verbal orders (SPEC §11.2): structured quick orders from the radial menu /
 * command bar. Deterministic translation into the same OrderDraft pipeline as
 * the workstation (records identical, nurse handling faster via verbal flag).
 */
import type { Order, OrderDraft, VerbalOrder } from '../contracts/orders';
import { getDrug } from '../data/drugs';
import { getLabPanel } from '../data/labs';
import type { EngineCtx } from './types';
import { clamp } from './types';
import type { NurseHandle } from './nurse';

export function handleVerbalOrder(
  ctx: EngineCtx,
  nurse: NurseHandle,
  placeOrder: (draft: OrderDraft) => Order,
  v: VerbalOrder,
): void {
  switch (v.kind) {
    case 'push_med': {
      const drug = getDrug(v.drugId);
      if (!drug || !drug.bolus) {
        ctx.emit({ type: 'NurseSpeech', say: "I can't push that." });
        return;
      }
      const dose = clamp(v.dose, drug.bolus.min, drug.bolus.max);
      placeOrder({
        kind: 'med',
        drugId: drug.id,
        mode: 'bolus',
        dose,
        doseUnit: drug.bolus.doseUnit,
        route: 'iv_push',
        label: `${drug.name} ${dose} ${drug.bolus.doseUnit} IV push`,
        verbal: true,
      });
      break;
    }
    case 'bolus_fluids': {
      const drug = getDrug('lactated-ringers');
      if (!drug || !drug.bolus) return;
      const dose = clamp(v.volumeMl, drug.bolus.min, drug.bolus.max);
      placeOrder({
        kind: 'med',
        drugId: drug.id,
        mode: 'bolus',
        dose,
        doseUnit: 'ml',
        route: 'iv_infusion',
        label: `${drug.name} ${dose} ml bolus`,
        verbal: true,
      });
      break;
    }
    case 'titrate': {
      const infusion = ctx.patient.infusions.find((i) => i.id === v.infusionId);
      const drug = infusion ? getDrug(infusion.drugId) : undefined;
      if (!infusion || !drug?.infusion) {
        ctx.emit({ type: 'NurseSpeech', say: "That drip isn't running." });
        return;
      }
      const raw = infusion.doseRate + v.deltaSteps * drug.infusion.step;
      const newRate = Math.round(clamp(raw, drug.infusion.min, drug.infusion.max) * 1e4) / 1e4;
      if (newRate === infusion.doseRate) {
        ctx.emit({ type: 'NurseSpeech', say: "That's already at the limit." });
        return;
      }
      nurse.enqueueTitrate(infusion.id, { newRate, verbal: true });
      break;
    }
    case 'stat_lab': {
      const panel = getLabPanel(v.panelId);
      placeOrder({
        kind: 'lab',
        panelId: v.panelId,
        stat: true,
        label: `${panel?.name ?? v.panelId} — STAT`,
        verbal: true,
      });
      break;
    }
    case 'call_rt':
      ctx.emit({ type: 'PlayerAction', action: 'CallRT' });
      ctx.emit({ type: 'NurseSpeech', say: 'RT is on the way.' });
      break;
    case 'cycle_nibp':
      placeOrder({
        kind: 'nursing',
        task: 'cycle_nibp',
        text: 'Cycle a cuff pressure',
        label: 'Cycle NIBP',
        verbal: true,
      });
      break;
  }
}
