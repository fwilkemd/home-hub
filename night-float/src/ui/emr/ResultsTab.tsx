/**
 * Results tab: pending labs, then resulted panels newest-first with abnormal
 * flags, crit pills, ref ranges, and per-test trend sparklines.
 */
import { useHub } from '../../bridge/store';
import type { LabResult } from '../../contracts/events';
import type { ResultedPanel } from '../../contracts/runtime';
import { fmtNum, wallClock } from '../format';
import { IconArrowDown, IconArrowUp } from '../icons';

function seriesFor(history: ResultedPanel[], panel: ResultedPanel, testId: string): number[] {
  return history
    .filter((p) => p.panelId === panel.panelId && p.t <= panel.t)
    .sort((a, b) => a.t - b.t)
    .map((p) => p.results.find((r) => r.testId === testId)?.value)
    .filter((v): v is number => v !== undefined && Number.isFinite(v));
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 64;
  const h = 18;
  const pad = 2.5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pt = (v: number, i: number): [number, number] => [
    pad + (i / (values.length - 1)) * (w - pad * 2),
    h - pad - ((v - min) / span) * (h - pad * 2),
  ];
  const pts = values.map((v, i) => pt(v, i));
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="spark" aria-hidden="true">
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="1.8" fill="currentColor" />
    </svg>
  );
}

function ResultRow({ r, series }: { r: LabResult; series: number[] }) {
  const crit = r.flag === 'crit_high' || r.flag === 'crit_low';
  const up = r.flag === 'high' || r.flag === 'crit_high';
  const down = r.flag === 'low' || r.flag === 'crit_low';
  const abnormal = r.flag !== 'normal';
  return (
    <tr>
      <td>{r.name}</td>
      <td className={`val mono ${abnormal ? 'abn' : ''} ${crit ? 'critval' : ''}`}>
        {fmtNum(r.value)} <span className="unit dim">{r.unit}</span>
        {up && <IconArrowUp />}
        {down && <IconArrowDown />}
        {crit && <span className="pillcrit">CRIT</span>}
      </td>
      <td className="dim mono ref">
        {fmtNum(r.refLo)}–{fmtNum(r.refHi)}
      </td>
      <td>
        <Sparkline values={series} />
      </td>
    </tr>
  );
}

export function ResultsTab() {
  const labResults = useHub((s) => s.labResults);
  const pending = useHub((s) => s.pendingLabs);
  const clockStart = useHub((s) => s.clockStart);

  const newestFirst = [...labResults].sort((a, b) => b.t - a.t);

  return (
    <div>
      {pending.length > 0 && (
        <div className="pendingrow">
          {pending.map((p) => (
            <span key={p.orderId} className={`chip ${p.stat ? 'warn' : ''}`}>
              {p.panelName}
              {p.stat ? ' STAT' : ''} — pending, back ~{wallClock(clockStart, p.resultsAt, false)}
            </span>
          ))}
        </div>
      )}

      {newestFirst.length === 0 && pending.length === 0 && (
        <p className="empty">No results yet — order labs from the Orders tab.</p>
      )}

      {newestFirst.map((panel) => (
        <section key={panel.id} className="panelcard">
          <header>
            <strong>{panel.panelName}</strong>
            {panel.stat && <span className="chip warn">STAT</span>}
            <span className="mono dim small">{wallClock(clockStart, panel.t, false)}</span>
          </header>
          <table className="table">
            <tbody>
              {panel.results.map((r) => (
                <ResultRow key={r.testId} r={r} series={seriesFor(labResults, panel, r.testId)} />
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
