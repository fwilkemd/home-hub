/**
 * Notes tab: signed notes list + free-text editor with a templated event
 * note (wall time, one-line vitals, active infusions).
 */
import { useState } from 'react';
import { useHub } from '../../bridge/store';
import { dispatch } from '../../bridge/session';
import { getDrug } from '../../data/drugs';
import { fmtNum, wallClock } from '../format';

export function NotesTab() {
  const notes = useHub((s) => s.notes);
  const vitals = useHub((s) => s.vitals);
  const patient = useHub((s) => s.patient);
  const clockStart = useHub((s) => s.clockStart);
  const simTime = useHub((s) => s.simTime);
  const [text, setText] = useState('');

  const sign = () => {
    const t = text.trim();
    if (!t) return;
    dispatch({ type: 'WriteNote', text: t });
    setText('');
  };

  const insertTemplate = () => {
    const infusions =
      patient && patient.infusions.length > 0
        ? patient.infusions
            .map((i) => `${getDrug(i.drugId)?.name ?? i.drugId} ${fmtNum(i.doseRate)} ${i.doseUnit}`)
            .join(', ')
        : 'none';
    const vitalsLine = vitals
      ? `HR ${Math.round(vitals.hr)} (${vitals.rhythm}) · BP ${Math.round(vitals.sbp)}/${Math.round(
          vitals.dbp,
        )} (MAP ${Math.round(vitals.map)}) · SpO2 ${Math.round(vitals.spo2)}% · RR ${Math.round(
          vitals.rr,
        )} · T ${fmtNum(vitals.tempC)} C`
      : 'not available';
    setText(
      [
        `[${wallClock(clockStart, simTime, false)}] EVENT NOTE`,
        `Vitals: ${vitalsLine}`,
        `Active infusions: ${infusions}`,
        '',
        'Events: ',
        'Assessment / plan: ',
      ].join('\n'),
    );
  };

  return (
    <div className="notes">
      <section>
        <h3>New note</h3>
        <textarea
          className="input"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          placeholder="Free text… or insert the event-note template."
          aria-label="Note text"
        />
        <div className="notes-actions">
          <button className="btn" onClick={insertTemplate}>
            Insert event note template
          </button>
          <button className="btn acc" onClick={sign} disabled={text.trim().length === 0}>
            Sign note
          </button>
        </div>
      </section>

      <section>
        <h3>Signed notes</h3>
        {notes.length === 0 && <p className="empty">No notes written yet.</p>}
        {[...notes].reverse().map((n) => (
          <div key={n.id} className="notecard">
            <div className="when mono">{wallClock(clockStart, n.t, false)}</div>
            <p>{n.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
