/**
 * MAR tab: every med administration grouped by drug.
 */
import { useMemo } from 'react';
import { useHub } from '../../bridge/store';
import type { MarEntry } from '../../contracts/orders';
import { getDrug } from '../../data/drugs';
import { wallClock } from '../format';

export function MarTab() {
  const mar = useHub((s) => s.mar);
  const clockStart = useHub((s) => s.clockStart);

  const groups = useMemo(() => {
    const map = new Map<string, MarEntry[]>();
    for (const e of mar) {
      const arr = map.get(e.drugId);
      if (arr) arr.push(e);
      else map.set(e.drugId, [e]);
    }
    return [...map.entries()];
  }, [mar]);

  if (mar.length === 0) {
    return <p className="empty">No medications administered yet.</p>;
  }

  return (
    <div>
      {groups.map(([drugId, entries]) => (
        <section key={drugId}>
          <h3>{getDrug(drugId)?.name ?? drugId}</h3>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Time</th>
                <th>Entry</th>
                <th style={{ width: 130 }}>Kind</th>
                <th style={{ width: 70 }}>By</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{wallClock(clockStart, e.t, false)}</td>
                  <td>{e.label}</td>
                  <td>
                    <span className="chip">{e.kind.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="dim">{e.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
