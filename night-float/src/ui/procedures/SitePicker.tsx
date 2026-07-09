/**
 * Site-choice dialog for a procedure about to start (SPEC §9). The world's
 * 'startProcedureFlow' context action sets store.sitePicker and exits pointer
 * lock; this modal shows the briefing + site options and dispatches
 * StartProcedure. Single-site procedures skip straight through.
 * Keyboard: 1-9 pick a site, Enter starts, Esc cancels (captured before the
 * global handler so nothing double-fires).
 */
import { useEffect, useState } from 'react';
import { hubActions, useHub } from '../../bridge/store';
import { dispatch } from '../../bridge/session';
import { getProcedure } from '../../data/procedures';
import { IconX } from '../icons';

export function SitePicker() {
  const req = useHub((s) => s.sitePicker);
  if (!req) return null;
  return <SitePickerDialog key={req.procedureId} procedureId={req.procedureId} />;
}

function start(procedureId: string, site: string): void {
  dispatch({ type: 'StartProcedure', procedureId, site });
  hubActions.setSitePicker(null);
}

function SitePickerDialog({ procedureId }: { procedureId: string }) {
  const def = getProcedure(procedureId);
  const [site, setSite] = useState(def?.siteOptions[0] ?? '');
  const single = (def?.siteOptions.length ?? 0) <= 1;

  // unknown procedure or a single site: nothing to choose — resolve silently
  useEffect(() => {
    if (!def) hubActions.setSitePicker(null);
    else if (single) start(procedureId, def.siteOptions[0]);
  }, [def, single, procedureId]);

  // window-capture so Esc/Enter/digits never reach the global key handler
  useEffect(() => {
    if (!def || single) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        hubActions.setSitePicker(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        start(procedureId, site);
      } else if (e.key >= '1' && e.key <= '9') {
        const opt = def.siteOptions[Number(e.key) - 1];
        if (opt) {
          e.stopPropagation();
          setSite(opt);
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [def, single, procedureId, site]);

  if (!def || single) return null;

  return (
    <div className="veil" role="presentation">
      <div className="dialog sitepicker" role="dialog" aria-label={`Start ${def.name}`}>
        <div className="dialog-head">
          <span>{def.name}</span>
          <button
            className="iconbtn"
            onClick={() => hubActions.setSitePicker(null)}
            aria-label="Cancel procedure"
          >
            <IconX />
          </button>
        </div>
        <div className="dialog-body">
          <div className="sitepicker-brief">{def.positioningNote}</div>
          <div className="sitepicker-meta">
            <span className="chip">{def.kitLabel}</span>
            {def.sterile && <span className="chip warn">sterile procedure</span>}
          </div>
          <div className="sitepicker-sites" role="radiogroup" aria-label="Site">
            {def.siteOptions.map((opt, i) => (
              <button
                key={opt}
                className={`sitebtn ${opt === site ? 'sel' : ''}`}
                role="radio"
                aria-checked={opt === site}
                onClick={() => setSite(opt)}
              >
                <span className="kc">{i + 1}</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="dialog-foot">
          <span className="dim small sitepicker-keys">
            <span className="kc">1-{def.siteOptions.length}</span> site ·{' '}
            <span className="kc">Enter</span> start · <span className="kc">Esc</span> cancel
          </span>
          <button className="btn" onClick={() => hubActions.setSitePicker(null)}>
            Cancel
          </button>
          <button className="btn acc" autoFocus onClick={() => start(procedureId, site)}>
            Start — {site}
          </button>
        </div>
      </div>
    </div>
  );
}
