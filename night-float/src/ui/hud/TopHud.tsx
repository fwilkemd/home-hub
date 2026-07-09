/**
 * Top HUD row: patient ribbon (left), wall clock + sim-speed control and the
 * active-alarm strip (right).
 */
import { useHub } from '../../bridge/store';
import { dispatch, setTimeScale } from '../../bridge/session';
import { TIME_SCALES } from '../../contracts/ids';
import { fmtDur, wallClock } from '../format';
import { IconPause } from '../icons';

export function PatientRibbon() {
  const patient = useHub((s) => s.patient);
  const title = useHub((s) => s.scenarioTitle);
  const d = patient?.demographics;
  return (
    <div className="ribbon">
      <span className="ribbon-name">{d?.name ?? '—'}</span>
      {d && (
        <span className="ribbon-meta">
          {d.age} {d.sex} · {d.weightKg} kg
        </span>
      )}
      <span className="ribbon-room">ICU 07</span>
      <span className="ribbon-scenario">{title}</span>
    </div>
  );
}

export function ClockSpeed() {
  const simTime = useHub((s) => s.simTime);
  const clockStart = useHub((s) => s.clockStart);
  const timeScale = useHub((s) => s.timeScale);
  return (
    <div className="clockbox">
      <div className="clock mono">{wallClock(clockStart, simTime)}</div>
      <div className="speed" role="group" aria-label="Simulation speed">
        {TIME_SCALES.map((sc) => (
          <button
            key={sc}
            className={timeScale === sc ? 'cur' : ''}
            onClick={() => setTimeScale(sc)}
            aria-label={sc === 0 ? 'Pause' : `${sc}x speed`}
            aria-pressed={timeScale === sc}
          >
            {sc === 0 ? <IconPause /> : `${sc}×`}
          </button>
        ))}
      </div>
    </div>
  );
}

const PRIORITY_RANK = { crisis: 0, warning: 1, advisory: 2 } as const;

export function AlarmsStrip() {
  const alarms = useHub((s) => s.alarms);
  const simTime = useHub((s) => s.simTime);
  if (alarms.length === 0) return null;
  const sorted = [...alarms].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.raisedAt - b.raisedAt,
  );
  return (
    <div className="alarms" aria-label="Active alarms">
      {sorted.map((a) => {
        const silenced = a.silencedUntil > simTime;
        const cls = [
          'alarm',
          a.priority,
          silenced ? 'silenced' : '',
          a.priority === 'crisis' && !silenced ? 'pulse' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={a.id}
            className={cls}
            title="Silence for 120 s"
            onClick={() => dispatch({ type: 'SilenceAlarm', alarmId: a.id, durationS: 120 })}
          >
            <span className="pill">{a.priority}</span>
            <span className="alarm-label">{a.label}</span>
            <span className="alarm-time mono">
              {silenced ? `sil ${fmtDur(a.silencedUntil - simTime)}` : fmtDur(simTime - a.raisedAt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
