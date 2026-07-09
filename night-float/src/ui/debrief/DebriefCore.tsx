/**
 * Debrief content (SPEC §13): outcome banner, rubric, timeline canvas,
 * procedure log, orders vs results. Reused by the full-screen debrief and
 * the EMR Debrief tab.
 */
import { useMemo } from 'react';
import type { SimEvent } from '../../contracts/events';
import type { DebriefData } from '../../contracts/runtime';
import { describeEvent, wallClock } from '../format';
import { IconCheck, IconX } from '../icons';
import { TimelineCanvas } from './TimelineCanvas';

const OUTCOME_META: Record<DebriefData['outcome'], { label: string; cls: string }> = {
  success: { label: 'SUCCESS', cls: 'ok' },
  death: { label: 'DEATH', cls: 'crit' },
  timeout: { label: 'TIMEOUT', cls: 'warn' },
  aborted: { label: 'ABORTED', cls: 'gray' },
};

interface ProcLog {
  key: string;
  name: string;
  site?: string;
  steps: { prompt: string; skipped: boolean }[];
  complications: string[];
  outcome: 'completed' | 'aborted' | 'incomplete';
  durationS?: number;
}

function collectProcedures(events: readonly SimEvent[]): ProcLog[] {
  const out: ProcLog[] = [];
  const open = new Map<string, ProcLog>();
  for (const e of events) {
    if (e.type === 'ProcedureStarted') {
      const log: ProcLog = {
        key: `${e.procedureId}-${e.seq}`,
        name: e.name,
        site: e.site,
        steps: [],
        complications: [],
        outcome: 'incomplete',
      };
      open.set(e.procedureId, log);
      out.push(log);
    } else if (e.type === 'ProcedureStepCompleted') {
      open.get(e.procedureId)?.steps.push({ prompt: e.prompt, skipped: e.skipped });
    } else if (e.type === 'ProcedureComplication') {
      open.get(e.procedureId)?.complications.push(e.label);
    } else if (e.type === 'ProcedureCompleted') {
      const log = open.get(e.procedureId);
      if (log) {
        log.outcome = 'completed';
        log.durationS = e.durationS;
        open.delete(e.procedureId);
      }
    } else if (e.type === 'ProcedureAborted') {
      const log = open.get(e.procedureId);
      if (log) {
        log.outcome = 'aborted';
        open.delete(e.procedureId);
      }
    }
  }
  return out;
}

export function DebriefCore({
  debrief,
  clockStart,
}: {
  debrief: DebriefData;
  clockStart: string;
}) {
  const meta = OUTCOME_META[debrief.outcome];
  const procedures = useMemo(() => collectProcedures(debrief.events), [debrief]);
  const orderEvents = useMemo(
    () => debrief.events.filter((e) => e.type === 'OrderPlaced'),
    [debrief],
  );
  const resultEvents = useMemo(
    () => debrief.events.filter((e) => e.type === 'LabResulted' || e.type === 'ImagingResulted'),
    [debrief],
  );

  return (
    <div className="debrief">
      <header className={`outcome ${meta.cls}`}>
        <div className="outcome-label">{meta.label}</div>
        <div className="outcome-summary">
          <strong>{debrief.title}</strong>
          {debrief.summary ? ` — ${debrief.summary}` : ''}
          {'  ·  ended '}
          {wallClock(clockStart, debrief.endedAtSim, false)}
        </div>
        <div className="outcome-score mono">
          {debrief.score} / {debrief.maxScore}
        </div>
      </header>

      <section>
        <h3>Rubric</h3>
        <ul className="rubric">
          {debrief.rubric.length === 0 && <li className="dim">No rubric defined for this scenario.</li>}
          {debrief.rubric.map((r) => (
            <li key={r.id} className={r.pass ? 'pass' : 'fail'}>
              <span className="glyph">{r.pass ? <IconCheck size={13} /> : <IconX size={12} />}</span>
              <span className="rubric-label">
                {r.label}
                {r.detail && <span className="dim"> — {r.detail}</span>}
              </span>
              <span className="mono">
                {r.earned}/{r.points}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Timeline</h3>
        <TimelineCanvas debrief={debrief} clockStart={clockStart} />
      </section>

      <section>
        <h3>Procedure log</h3>
        {procedures.length === 0 && <p className="empty">No procedures performed.</p>}
        {procedures.map((p) => (
          <div key={p.key} className="proclog">
            <h4>
              {p.name}
              {p.site && <span className="dim">{p.site}</span>}
              <span
                className={`chip ${p.outcome === 'completed' ? 'ok' : p.outcome === 'aborted' ? 'warn' : ''}`}
              >
                {p.outcome}
                {p.durationS !== undefined ? ` · ${Math.round(p.durationS / 60)} min` : ''}
              </span>
            </h4>
            <ul>
              {p.steps.map((s, i) => (
                <li key={i}>
                  {s.prompt}
                  {s.skipped && <span className="dim"> (skipped)</span>}
                </li>
              ))}
              {p.complications.map((c, i) => (
                <li key={`c${i}`} className="comp">
                  Complication — {c}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h3>Orders vs results</h3>
        <div className="ovr">
          <div>
            <h3>Orders placed</h3>
            <ul>
              {orderEvents.length === 0 && <li className="dim">none</li>}
              {orderEvents.map((e) => (
                <li key={e.seq}>
                  <span className="mono">{wallClock(clockStart, e.t, false)}</span>
                  <span>{e.type === 'OrderPlaced' ? e.order.label : ''}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Results returned</h3>
            <ul>
              {resultEvents.length === 0 && <li className="dim">none</li>}
              {resultEvents.map((e) => (
                <li key={e.seq}>
                  <span className="mono">{wallClock(clockStart, e.t, false)}</span>
                  <span>{describeEvent(e)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
