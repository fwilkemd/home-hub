/**
 * Diegetic procedure card (bottom-right) while a procedure runs: step list,
 * active-step prompt, and a button path that completes/skips/aborts steps so
 * procedures are finishable standalone before world gestures wire up.
 */
import { useHub } from '../../bridge/store';
import { dispatch } from '../../bridge/session';
import { IconCaret, IconCheck, IconX } from '../icons';

export function ProcedurePanel() {
  const proc = useHub((s) => s.procedure);
  if (!proc) return null;

  const active = proc.steps[proc.stepIndex] ?? proc.steps.find((s) => s.status === 'active') ?? null;
  const isHold =
    active !== null && (active.interaction === 'click_hold' || active.interaction === 'align_hold');

  return (
    <div className="procpanel" role="region" aria-label="Procedure">
      <header className="procpanel-head">
        <strong>{proc.name}</strong>
        <span className="dim">{proc.site}</span>
        {proc.sterile && (
          <span className={`chip ${proc.contaminated ? 'crit' : 'ok'}`}>
            {proc.contaminated ? 'CONTAMINATED' : 'sterile'}
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
        <div className="procactive">
          <div className="procactive-row">
            {isHold && <span className="holdring" title="Hold interaction" />}
            <div>
              <div className="procactive-prompt">{active.prompt}</div>
              {active.detail && <div className="procactive-detail">{active.detail}</div>}
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
