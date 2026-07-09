/**
 * Small transient HUD cards: exam findings, tutorial banner, toast column.
 */
import { useHub } from '../../bridge/store';
import { useNow } from '../useNow';

export function ExamCard() {
  const lastExam = useHub((s) => s.lastExam);
  const now = useNow(500);
  if (!lastExam || lastExam.untilReal <= now) return null;
  return (
    <div className="examcard">
      <div className="examcard-head">
        <span>{lastExam.zone.replace(/_/g, ' ')}</span>
        <span className="chip acc">{lastExam.mode}</span>
      </div>
      <p className="examcard-text">{lastExam.text}</p>
    </div>
  );
}

export function TutorialBanner() {
  const tutorial = useHub((s) => s.tutorial);
  if (!tutorial?.text) return null;
  const step = Math.min(tutorial.stepIndex + 1, tutorial.total);
  return (
    <div className="tutorial">
      <span className="chip acc">
        Step {step}/{tutorial.total}
      </span>
      <span>{tutorial.text}</span>
    </div>
  );
}

/** Toast column, top center-right. Mounted at App level (all phases). */
export function Toasts() {
  const toasts = useHub((s) => s.toasts);
  const now = useNow(500);
  const live = toasts.filter((t) => t.until > now);
  if (live.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {live.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
