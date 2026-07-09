/**
 * Radial verbal-order menu (Q, SPEC §11.2): a ring of structured quick
 * orders over a deterministic parser — no free text. 1-9 select, Q/Esc close.
 */
import { useEffect, useMemo } from 'react';
import { hubActions, useHub } from '../bridge/store';
import { dispatch } from '../bridge/session';
import { drugs, getDrug } from '../data/drugs';
import { labPanels } from '../data/labs';
import type { PatientState } from '../contracts/patient';
import type { VerbalOrder } from '../contracts/orders';
import { fmtNum } from './format';

interface RadialEntry {
  key: string;
  label: string;
  sub?: string;
  disabled?: boolean;
  verbal?: VerbalOrder;
}

function findPanel(patterns: RegExp[]): { id: string; name: string } | undefined {
  return labPanels.find((p) => patterns.some((rx) => rx.test(p.id) || rx.test(p.name)));
}

/** Defensive against empty registries: missing prerequisites render disabled. */
function buildEntries(patient: PatientState | null): RadialEntry[] {
  const pushDrug = drugs.find((d) => d.class === 'pressor' && d.bolus) ?? drugs.find((d) => d.bolus);
  const inf = patient?.infusions[0] ?? null;
  const infName = inf ? (getDrug(inf.drugId)?.name ?? inf.drugId) : '';
  const lactate = findPanel([/lactate/i]);
  const abg = findPanel([/\babg\b/i, /blood gas/i, /^gas/i]);

  return [
    pushDrug?.bolus
      ? {
          key: 'push',
          label: `Push ${pushDrug.name}`,
          sub: `${fmtNum(pushDrug.bolus.default)} ${pushDrug.bolus.doseUnit}`,
          verbal: { kind: 'push_med', drugId: pushDrug.id, dose: pushDrug.bolus.default },
        }
      : { key: 'push', label: 'Push med', sub: 'no drugs loaded', disabled: true },
    { key: 'lr500', label: 'Bolus LR', sub: '500 mL', verbal: { kind: 'bolus_fluids', volumeMl: 500 } },
    { key: 'lr1000', label: 'Bolus LR', sub: '1000 mL', verbal: { kind: 'bolus_fluids', volumeMl: 1000 } },
    inf
      ? {
          key: 'up',
          label: `${infName} up`,
          sub: `now ${fmtNum(inf.doseRate)} ${inf.doseUnit}`,
          verbal: { kind: 'titrate', infusionId: inf.id, deltaSteps: 1 },
        }
      : { key: 'up', label: 'Titrate up', sub: 'no active gtt', disabled: true },
    inf
      ? {
          key: 'down',
          label: `${infName} down`,
          sub: `now ${fmtNum(inf.doseRate)} ${inf.doseUnit}`,
          verbal: { kind: 'titrate', infusionId: inf.id, deltaSteps: -1 },
        }
      : { key: 'down', label: 'Titrate down', sub: 'no active gtt', disabled: true },
    lactate
      ? { key: 'lactate', label: 'STAT lactate', sub: lactate.name, verbal: { kind: 'stat_lab', panelId: lactate.id } }
      : { key: 'lactate', label: 'STAT lactate', sub: 'panel not loaded', disabled: true },
    abg
      ? { key: 'abg', label: 'STAT ABG', sub: abg.name, verbal: { kind: 'stat_lab', panelId: abg.id } }
      : { key: 'abg', label: 'STAT ABG', sub: 'panel not loaded', disabled: true },
    { key: 'rt', label: 'Call RT', sub: 'respiratory therapy', verbal: { kind: 'call_rt' } },
    { key: 'nibp', label: 'Cycle NIBP', sub: 'blood pressure now', verbal: { kind: 'cycle_nibp' } },
  ];
}

function choose(entry: RadialEntry): void {
  if (entry.disabled || !entry.verbal) return;
  dispatch({ type: 'VerbalOrder', verbal: entry.verbal });
  hubActions.setRadial(false);
}

export function RadialMenu() {
  const patient = useHub((s) => s.patient);
  const entries = useMemo(() => buildEntries(patient), [patient]);

  // 1-9 select while open (Q / Esc close via the global handler).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') {
        const entry = entries[Number(e.key) - 1];
        if (entry) {
          e.preventDefault();
          choose(entry);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entries]);

  const R = 205;
  return (
    <div className="radial-veil" onClick={() => hubActions.setRadial(false)}>
      <div className="radial" role="menu" aria-label="Verbal orders" onClick={(e) => e.stopPropagation()}>
        <div className="radial-center">
          <strong>VERBAL ORDER</strong>
          <span>1-9 select</span>
          <span>Q / Esc close</span>
        </div>
        {entries.map((entry, i) => {
          const ang = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(ang) * R;
          const y = Math.sin(ang) * R;
          return (
            <button
              key={entry.key}
              className="radial-item"
              role="menuitem"
              disabled={entry.disabled}
              style={{ transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px))` }}
              onClick={() => choose(entry)}
            >
              <span className="kc">{i + 1}</span>
              <span className="radial-item-label">{entry.label}</span>
              {entry.sub && <span className="radial-item-sub">{entry.sub}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
