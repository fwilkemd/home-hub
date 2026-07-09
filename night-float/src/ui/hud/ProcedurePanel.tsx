/**
 * Diegetic procedure card (bottom-right) while a procedure runs: step list,
 * active-step prompt, and a button path that completes/skips/aborts steps so
 * procedures are finishable standalone before world gestures wire up.
 * Hold steps bind the ring to the live E-hold gesture (store.procedureHold);
 * with no gesture running the ring stays indeterminate.
 */
import { useHub } from '../../bridge/store';
import { dispatch } from '../../bridge/session';
import { IconCaret, IconCheck, IconX } from '../icons';

/** Determinate progress ring fed by the world E-hold gesture. */
function HoldRing({ progress }: { progress: number }) {
  const r = 10.5;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <svg className="holdring-live" width={26} height={26} viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3" />
      <circle
        cx="13"
        cy="13"
        r={r}
        fill="none"
        stroke="var(--acc)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(c * p).toFixed(2)} ${c.toFixed(2)}`}
        transform="rotate(-90 13 13)"
      />
    </svg>
  );
}

export function ProcedurePanel() {
  const proc = useHub((s) => s.procedure);
  const hold = useHub((s) => s.procedureHold);
  const pointerLocked = useHub((s) => s.pointerLocked);
  if (!proc) return null;

  const active = proc.steps[proc.stepIndex] ?? proc.steps.find((s) => s.status === 'active') ?? null;
  const isHold =
    active !== null && (active.interaction === 'click_hold' || active.interaction === 'align_hold');
  const liveProgress =
    isHold && active && hold && hold.stepId === active.id ? hold.progress : null;
  const holdS = proc.definition.steps[proc.stepIndex]?.holdS ?? 1.2;

  return (
    <div className="procpanel" role="region" aria-label="Procedure">
      <header className="procpanel-head">
        <strong>{proc.name}</strong>
        <span className="dim">{proc.site}</span>
        {proc.sterile && (
          <span className={`chip ${proc.contaminated ? 'crit' : 'ok'}`}>
            {proc.contaminated ? 'FIELD CONTAMINATED' : 'sterile'}
          </span>
        )}
      </header>

      <ol className="procsteps">
        {proc.steps.map((st) => (
          <li key={st.id} className={`procstep ${st.status}`}>
            <span className="procstep-glyph">
              {st.status === 'done' ? (
                <IconCheck size={11} />
              ) : st.status === 'skipped' ? (
                <IconX size={10} />
              ) : st.status === 'active' ? (
                <IconCaret size={10} />
              ) : (
                <span className="dot" />
              )}
            </span>
            <span>{st.prompt}</span>
          </li>
        ))}
      </ol>

      {active && (
        <div className="procactive" data-step={active.id}>
          <div className="procactive-row">
            {isHold &&
              (liveProgress !== null ? (
                <HoldRing progress={liveProgress} />
              ) : (
                <span className="holdring" title="Hold interaction" />
              ))}
            <div>
              <div className="procactive-prompt">{active.prompt}</div>
              {active.detail && <div className="procactive-detail">{active.detail}</div>}
              {isHold && pointerLocked && (
                <div className="procgesture">
                  <span className="kc">E</span> hold {holdS.toFixed(1)}s
                  {active.interaction === 'align_hold' ? ' — on the patient' : ''}
                </div>
              )}
            </div>
          </div>
          <div className="procpanel-actions">
            <button
              className="btn acc sm"
              onClick={() => dispatch({ type: 'AdvanceProcedureStep', stepId: active.id })}
            >
              Complete step
            </button>
            {active.skippable && (
              <button
                className="btn sm"
                onClick={() =>
                  dispatch({ type: 'AdvanceProcedureStep', stepId: active.id, skipped: true })
                }
              >
                Skip
              </button>
            )}
            <button className="btn danger sm" onClick={() => dispatch({ type: 'AbortProcedure' })}>
              Abort
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
