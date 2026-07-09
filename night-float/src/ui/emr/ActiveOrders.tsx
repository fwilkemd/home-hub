/**
 * Active-orders table: status chips, D/C, and infusion titrate/stop controls
 * bound to the live infusion (matched via drugId).
 */
import { useHub } from '../../bridge/store';
import { dispatch } from '../../bridge/session';
import type { DrugDefinition } from '../../contracts/content';
import type { Infusion } from '../../contracts/patient';
import { getDrug } from '../../data/drugs';
import { fmtNum, wallClock } from '../format';
import { IconChevDown, IconChevUp } from '../icons';

function titrate(inf: Infusion, drug: DrugDefinition, dir: 1 | -1): void {
  const spec = drug.infusion;
  if (!spec) return;
  const raw = inf.doseRate + dir * spec.step;
  const next = Math.round(Math.min(spec.max, Math.max(spec.min, raw)) * 1000) / 1000;
  if (next !== inf.doseRate) {
    dispatch({ type: 'ModifyInfusion', infusionId: inf.id, doseRate: next });
  }
}

export function ActiveOrders() {
  const orders = useHub((s) => s.orders);
  const patient = useHub((s) => s.patient);
  const clockStart = useHub((s) => s.clockStart);

  const rows = [...orders].reverse();
  return (
    <div className="ordgroup">
      <h4>Orders</h4>
      {rows.length === 0 && <p className="empty">Nothing ordered yet.</p>}
      {rows.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Order</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const active = o.status === 'active' || o.status === 'in_progress';
              const infusion =
                o.kind === 'med' && o.mode === 'infusion'
                  ? (patient?.infusions.find((i) => i.drugId === o.drugId) ?? null)
                  : null;
              const drug = o.kind === 'med' ? getDrug(o.drugId) : undefined;
              return (
                <tr key={o.id} className={o.status}>
                  <td className="mono">{wallClock(clockStart, o.t, false)}</td>
                  <td>
                    {o.label}
                    {infusion && active && (
                      <span className="dim">
                        {' '}
                        · at {fmtNum(infusion.doseRate)} {infusion.doseUnit}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`chip st-${o.status}`}>{o.status.replace('_', ' ')}</span>
                  </td>
                  <td className="ordactions">
                    {infusion && active && drug?.infusion && (
                      <>
                        <button
                          className="iconbtn"
                          onClick={() => titrate(infusion, drug, 1)}
                          aria-label={`Titrate ${drug.name} up`}
                          title={`+${fmtNum(drug.infusion.step)} ${drug.infusion.doseUnit}`}
                        >
                          <IconChevUp />
                        </button>
                        <button
                          className="iconbtn"
                          onClick={() => titrate(infusion, drug, -1)}
                          aria-label={`Titrate ${drug.name} down`}
                          title={`-${fmtNum(drug.infusion.step)} ${drug.infusion.doseUnit}`}
                        >
                          <IconChevDown />
                        </button>
                        <button
                          className="btn sm"
                          onClick={() => dispatch({ type: 'StopInfusion', infusionId: infusion.id })}
                        >
                          Stop
                        </button>
                      </>
                    )}
                    {active && (
                      <button
                        className="btn sm"
                        onClick={() => dispatch({ type: 'DiscontinueOrder', orderId: o.id })}
                        title="Discontinue"
                      >
                        D/C
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
