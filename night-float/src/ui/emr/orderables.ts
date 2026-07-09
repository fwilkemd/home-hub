/**
 * Orderable catalog for the Orders tab, built from the data registries
 * (which may be EMPTY while content lands in a parallel workstream — every
 * builder degrades gracefully). Also draft/label builders + favorites.
 */
import type { DrugDefinition, LabPanelDefinition } from '../../contracts/content';
import type { VentSettings, VentState } from '../../contracts/patient';
import type { NursingTask, Order, OrderDraft } from '../../contracts/orders';
import { drugs } from '../../data/drugs';
import { labPanels } from '../../data/labs';
import { fmtNum } from '../format';

export type Orderable =
  | {
      key: string;
      group: 'Medications';
      kind: 'med';
      title: string;
      sub: string;
      drug: DrugDefinition;
      mode: 'bolus' | 'infusion';
      presetDose?: number;
      presetRate?: number;
    }
  | {
      key: string;
      group: 'Labs';
      kind: 'lab';
      title: string;
      sub: string;
      panel: LabPanelDefinition;
      presetStat?: boolean;
    }
  | { key: string; group: 'Imaging'; kind: 'imaging'; title: string; sub: string }
  | {
      key: string;
      group: 'Ventilator';
      kind: 'vent';
      title: string;
      sub: string;
      make: (vent: VentState) => Partial<VentSettings>;
    }
  | {
      key: string;
      group: 'Nursing';
      kind: 'nursing';
      title: string;
      sub: string;
      task: NursingTask;
      text: string;
    };

export const ORDER_GROUPS = ['Medications', 'Labs', 'Imaging', 'Ventilator', 'Nursing'] as const;

const round2 = (v: number): number => Math.round(v * 100) / 100;

export function buildOrderables(): Orderable[] {
  const out: Orderable[] = [];
  for (const drug of drugs) {
    if (drug.bolus) {
      out.push({
        key: `med-${drug.id}-bolus`,
        group: 'Medications',
        kind: 'med',
        title: `${drug.name} bolus`,
        sub: `${fmtNum(drug.bolus.min)}–${fmtNum(drug.bolus.max)} ${drug.bolus.doseUnit} IV push`,
        drug,
        mode: 'bolus',
      });
    }
    if (drug.infusion) {
      out.push({
        key: `med-${drug.id}-gtt`,
        group: 'Medications',
        kind: 'med',
        title: `${drug.name} gtt`,
        sub: `${fmtNum(drug.infusion.min)}–${fmtNum(drug.infusion.max)} ${drug.infusion.doseUnit}`,
        drug,
        mode: 'infusion',
      });
    }
  }
  for (const panel of labPanels) {
    out.push({
      key: `lab-${panel.id}`,
      group: 'Labs',
      kind: 'lab',
      title: panel.name,
      sub: panel.poc ? 'point of care' : `~${Math.round(panel.turnaroundS / 60)} min turnaround`,
      panel,
    });
  }
  out.push({
    key: 'img-cxr',
    group: 'Imaging',
    kind: 'imaging',
    title: 'CXR (portable)',
    sub: 'chest x-ray at bedside',
  });
  out.push(
    {
      key: 'vent-fio2',
      group: 'Ventilator',
      kind: 'vent',
      title: 'FiO2 +10%',
      sub: 'raise oxygen',
      make: (v) => ({ fio2: round2(Math.min(1, v.fio2 + 0.1)) }),
    },
    {
      key: 'vent-peep',
      group: 'Ventilator',
      kind: 'vent',
      title: 'PEEP +2',
      sub: 'raise PEEP',
      make: (v) => ({ peep: Math.min(24, v.peep + 2) }),
    },
    {
      key: 'vent-rr',
      group: 'Ventilator',
      kind: 'vent',
      title: 'RR +2',
      sub: 'raise set rate',
      make: (v) => ({ setRr: Math.min(40, v.setRr + 2) }),
    },
    {
      key: 'vent-vc',
      group: 'Ventilator',
      kind: 'vent',
      title: 'Mode VC',
      sub: 'volume control',
      make: () => ({ mode: 'VC' }),
    },
    {
      key: 'vent-pc',
      group: 'Ventilator',
      kind: 'vent',
      title: 'Mode PC',
      sub: 'pressure control',
      make: () => ({ mode: 'PC' }),
    },
    {
      key: 'vent-ps',
      group: 'Ventilator',
      kind: 'vent',
      title: 'Mode PS',
      sub: 'pressure support',
      make: () => ({ mode: 'PS' }),
    },
  );
  out.push(
    {
      key: 'nur-nibp',
      group: 'Nursing',
      kind: 'nursing',
      title: 'Cycle NIBP',
      sub: 'blood pressure now',
      task: 'cycle_nibp',
      text: 'Cycle NIBP now',
    },
    {
      key: 'nur-repo',
      group: 'Nursing',
      kind: 'nursing',
      title: 'Reposition patient',
      sub: 'turn / head of bed',
      task: 'reposition',
      text: 'Reposition patient',
    },
  );
  return out;
}

// ---------------------------------------------------------------- drafts
export function describeVentSettings(settings: Partial<VentSettings>): string {
  const parts: string[] = [];
  if (settings.mode !== undefined) parts.push(`mode ${settings.mode}`);
  if (settings.fio2 !== undefined) parts.push(`FiO2 ${Math.round(settings.fio2 * 100)}%`);
  if (settings.peep !== undefined) parts.push(`PEEP ${fmtNum(settings.peep)}`);
  if (settings.setRr !== undefined) parts.push(`RR ${fmtNum(settings.setRr)}`);
  if (settings.setVtMl !== undefined) parts.push(`Vt ${fmtNum(settings.setVtMl)} mL`);
  if (settings.pinsp !== undefined) parts.push(`Pinsp ${fmtNum(settings.pinsp)}`);
  if (settings.psupp !== undefined) parts.push(`PS ${fmtNum(settings.psupp)}`);
  return parts.join(' · ') || 'no changes';
}

export function medBolusDraft(drug: DrugDefinition, dose: number): OrderDraft {
  const b = drug.bolus;
  const unit = b?.doseUnit ?? 'dose';
  return {
    kind: 'med',
    drugId: drug.id,
    mode: 'bolus',
    dose,
    doseUnit: unit,
    route: 'iv_push',
    label: `${drug.name} ${fmtNum(dose)} ${unit} IV push`,
  };
}

export function medInfusionDraft(drug: DrugDefinition, rate: number): OrderDraft {
  const inf = drug.infusion;
  const unit = inf?.doseUnit ?? 'rate';
  return {
    kind: 'med',
    drugId: drug.id,
    mode: 'infusion',
    rate,
    rateUnit: unit,
    route: 'iv_infusion',
    label: `${drug.name} gtt ${fmtNum(rate)} ${unit}`,
  };
}

export function labDraft(panel: LabPanelDefinition, stat: boolean): OrderDraft {
  return { kind: 'lab', panelId: panel.id, stat, label: `${panel.name}${stat ? ' — STAT' : ''}` };
}

export function imagingDraft(): OrderDraft {
  return { kind: 'imaging', study: 'cxr', label: 'CXR (portable)' };
}

export function ventDraft(settings: Partial<VentSettings>): OrderDraft {
  return { kind: 'vent', settings, label: `Vent — ${describeVentSettings(settings)}` };
}

export function nursingDraft(task: NursingTask, text: string, label: string): OrderDraft {
  return { kind: 'nursing', task, text, label };
}

// ---------------------------------------------------------------- favorites
const clampBolus = (drug: DrugDefinition, v: number): number =>
  drug.bolus ? Math.min(drug.bolus.max, Math.max(drug.bolus.min, v)) : v;

/** norepi gtt · LR bolus 1 L · lactate STAT · ABG STAT · CXR — best-effort. */
export function buildFavorites(all: Orderable[]): Orderable[] {
  const out: Orderable[] = [];
  const norepi = all.find(
    (o) => o.kind === 'med' && o.mode === 'infusion' && /norepi/i.test(o.drug.id + ' ' + o.drug.name),
  );
  if (norepi) out.push({ ...norepi, key: 'fav-norepi' });

  const lr = all.find(
    (o) =>
      o.kind === 'med' &&
      o.mode === 'bolus' &&
      (/lactated|ringer|\blr\b/i.test(o.drug.id + ' ' + o.drug.name) || o.drug.class === 'fluid'),
  );
  if (lr && lr.kind === 'med') {
    out.push({ ...lr, key: 'fav-lr', title: `${lr.drug.name} 1 L bolus`, presetDose: clampBolus(lr.drug, 1000) });
  }

  const lactate = all.find((o) => o.kind === 'lab' && /lactate/i.test(o.panel.id + ' ' + o.panel.name));
  if (lactate && lactate.kind === 'lab') {
    out.push({ ...lactate, key: 'fav-lactate', title: `${lactate.panel.name} STAT`, presetStat: true });
  }

  const abg = all.find(
    (o) => o.kind === 'lab' && /\babg\b|blood gas/i.test(o.panel.id + ' ' + o.panel.name),
  );
  if (abg && abg.kind === 'lab') {
    out.push({ ...abg, key: 'fav-abg', title: `${abg.panel.name} STAT`, presetStat: true });
  }

  const cxr = all.find((o) => o.kind === 'imaging');
  if (cxr) out.push({ ...cxr, key: 'fav-cxr' });
  return out;
}

/** Map a previously placed order back onto a composer seed (recents). */
export function seedFromOrder(order: Order, all: Orderable[]): Orderable | null {
  switch (order.kind) {
    case 'med': {
      const found = all.find(
        (o) => o.kind === 'med' && o.drug.id === order.drugId && o.mode === order.mode,
      );
      if (!found || found.kind !== 'med') return null;
      return {
        ...found,
        key: `recent-${order.id}`,
        presetDose: order.mode === 'bolus' ? order.dose : undefined,
        presetRate: order.mode === 'infusion' ? order.rate : undefined,
      };
    }
    case 'lab': {
      const found = all.find((o) => o.kind === 'lab' && o.panel.id === order.panelId);
      if (!found || found.kind !== 'lab') return null;
      return { ...found, key: `recent-${order.id}`, presetStat: order.stat };
    }
    case 'imaging':
      return all.find((o) => o.kind === 'imaging') ?? null;
    case 'vent': {
      const settings = order.settings;
      return {
        key: `recent-${order.id}`,
        group: 'Ventilator',
        kind: 'vent',
        title: order.label,
        sub: 'reorder',
        make: () => settings,
      };
    }
    case 'nursing': {
      const found = all.find((o) => o.kind === 'nursing' && o.task === order.task);
      return found ?? null;
    }
  }
}
