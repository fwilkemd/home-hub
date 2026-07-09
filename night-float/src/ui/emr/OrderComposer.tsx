/**
 * Order composer dialog: dose/rate clamped to the drug definition, stat
 * toggle for labs, live vent-settings preview — then [Sign order] dispatches
 * PlaceOrder with a readable label.
 */
import { useMemo, useState } from 'react';
import { hubActions, useHub } from '../../bridge/store';
import { dispatch } from '../../bridge/session';
import type { OrderDraft } from '../../contracts/orders';
import { fmtNum } from '../format';
import { IconX } from '../icons';
import {
  describeVentSettings,
  imagingDraft,
  labDraft,
  medBolusDraft,
  medInfusionDraft,
  nursingDraft,
  ventDraft,
  type Orderable,
} from './orderables';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A slider step that feels right for the span (bolus sliders). */
function niceStep(lo: number, hi: number): number {
  const span = Math.max(hi - lo, 0.001);
  const raw = span / 40;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}

function DoseRow({
  value,
  lo,
  hi,
  step,
  unit,
  onChange,
}: {
  value: number;
  lo: number;
  hi: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="composer-row">
      <input
        type="range"
        min={lo}
        max={hi}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        aria-label="Dose"
      />
      <input
        className="input composer-num mono"
        type="number"
        min={lo}
        max={hi}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <span className="dim">{unit}</span>
    </div>
  );
}

export function OrderComposer({ seed, onClose }: { seed: Orderable; onClose: () => void }) {
  const patient = useHub((s) => s.patient);

  const bolus = seed.kind === 'med' && seed.mode === 'bolus' ? seed.drug.bolus : undefined;
  const infusion = seed.kind === 'med' && seed.mode === 'infusion' ? seed.drug.infusion : undefined;

  const [dose, setDose] = useState<number>(() =>
    seed.kind === 'med'
      ? seed.mode === 'bolus'
        ? (seed.presetDose ?? bolus?.default ?? 0)
        : (seed.presetRate ?? infusion?.default ?? 0)
      : 0,
  );
  const [stat, setStat] = useState<boolean>(seed.kind === 'lab' ? (seed.presetStat ?? false) : false);

  const ventSettings = useMemo(
    () => (seed.kind === 'vent' && patient ? seed.make(patient.devices.vent) : null),
    [seed, patient],
  );

  const draft: OrderDraft | null = useMemo(() => {
    switch (seed.kind) {
      case 'med': {
        if (seed.mode === 'bolus') {
          if (!bolus) return null;
          return medBolusDraft(seed.drug, clamp(dose, bolus.min, bolus.max));
        }
        if (!infusion) return null;
        return medInfusionDraft(seed.drug, clamp(dose, infusion.min, infusion.max));
      }
      case 'lab':
        return labDraft(seed.panel, stat);
      case 'imaging':
        return imagingDraft();
      case 'vent':
        return ventSettings && Object.keys(ventSettings).length > 0 ? ventDraft(ventSettings) : null;
      case 'nursing':
        return nursingDraft(seed.task, seed.text, seed.title);
    }
  }, [seed, dose, stat, ventSettings, bolus, infusion]);

  const sign = () => {
    if (!draft) return;
    dispatch({ type: 'PlaceOrder', draft });
    hubActions.toast(`Signed — ${draft.label}`, 'success', 3500);
    onClose();
  };

  return (
    <div className="veil" onClick={onClose}>
      <div className="dialog" role="dialog" aria-label="Compose order" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <span>{seed.title}</span>
          <button className="iconbtn" onClick={onClose} aria-label="Cancel order">
            <IconX />
          </button>
        </div>

        <div className="dialog-body">
          {seed.kind === 'med' && seed.mode === 'bolus' && bolus && (
            <>
              <DoseRow
                value={dose}
                lo={bolus.min}
                hi={bolus.max}
                step={niceStep(bolus.min, bolus.max)}
                unit={bolus.doseUnit}
                onChange={setDose}
              />
              <p className="dim small" style={{ margin: 0 }}>
                Route IV push · allowed {fmtNum(bolus.min)}–{fmtNum(bolus.max)} {bolus.doseUnit}
              </p>
            </>
          )}

          {seed.kind === 'med' && seed.mode === 'infusion' && infusion && (
            <>
              <DoseRow
                value={dose}
                lo={infusion.min}
                hi={infusion.max}
                step={infusion.step}
                unit={infusion.doseUnit}
                onChange={setDose}
              />
              <p className="dim small" style={{ margin: 0 }}>
                Starting rate · titrate by {fmtNum(infusion.step)} {infusion.doseUnit} · range{' '}
                {fmtNum(infusion.min)}–{fmtNum(infusion.max)}
              </p>
            </>
          )}

          {seed.kind === 'med' &&
            ((seed.mode === 'bolus' && !bolus) || (seed.mode === 'infusion' && !infusion)) && (
              <p className="empty">This drug has no {seed.mode} form defined.</p>
            )}

          {seed.kind === 'lab' && (
            <label className="check">
              <input type="checkbox" checked={stat} onChange={(e) => setStat(e.currentTarget.checked)} />
              STAT priority
              <span className="dim small">
                {stat
                  ? ` (~${Math.round((seed.panel.statTurnaroundS ?? seed.panel.turnaroundS / 2) / 60)} min)`
                  : ` (~${Math.round(seed.panel.turnaroundS / 60)} min)`}
              </span>
            </label>
          )}

          {seed.kind === 'imaging' && (
            <p className="dim" style={{ margin: 0 }}>
              Portable chest x-ray at the bedside. The image lands in Media when read.
            </p>
          )}

          {seed.kind === 'vent' &&
            (ventSettings ? (
              <p className="dim" style={{ margin: 0 }}>
                New settings: {describeVentSettings(ventSettings)}
              </p>
            ) : (
              <p className="empty">No live vent data yet.</p>
            ))}

          {seed.kind === 'nursing' && (
            <p className="dim" style={{ margin: 0 }}>
              {seed.text} — the nurse picks this up as a task.
            </p>
          )}

          {draft && <div className="composer-preview">{draft.label}</div>}
        </div>

        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn acc" onClick={sign} disabled={!draft}>
            Sign order
          </button>
        </div>
      </div>
    </div>
  );
}
