/**
 * Chart tab: scenario briefing (read straight from the scenario registry —
 * read-only data import) + current lines/devices summary.
 */
import { useHub } from '../../bridge/store';
import { getScenario } from '../../data/scenarios';

export function ChartTab() {
  const scenarioId = useHub((s) => s.scenarioId);
  const patient = useHub((s) => s.patient);
  const scenario = scenarioId ? getScenario(scenarioId) : undefined;
  const vent = patient?.devices.vent;

  return (
    <div>
      {scenario ? (
        <>
          <h2 className="chart-oneliner">{scenario.briefing.oneLiner}</h2>
          <section>
            <h3>HPI</h3>
            <p className="prose">{scenario.briefing.hpi}</p>
          </section>
          <section>
            <h3>Background</h3>
            <p className="prose">{scenario.briefing.background}</p>
          </section>
        </>
      ) : (
        <p className="empty">No scenario briefing available.</p>
      )}

      <section>
        <h3>Lines &amp; devices</h3>
        {patient ? (
          <ul className="linelist">
            {patient.lines.length === 0 && <li className="dim">No lines documented.</li>}
            {patient.lines.map((l) => (
              <li key={l.id}>
                <span className="chip acc">{l.type.toUpperCase()}</span>
                <span>{l.site}</span>
              </li>
            ))}
            <li>
              <span className={`chip ${vent?.connected ? 'warn' : ''}`}>VENT</span>
              <span>
                {vent?.connected
                  ? `${vent.mode} · RR ${vent.setRr} · Vt ${vent.setVtMl} mL · PEEP ${vent.peep} · FiO2 ${Math.round(vent.fio2 * 100)}%`
                  : 'not connected'}
              </span>
            </li>
            {patient.devices.pumps.length > 0 && (
              <li>
                <span className="chip">PUMPS</span>
                <span className="dim">
                  {patient.devices.pumps
                    .map((p) => (p.drugId ? `${p.label || p.drugId} ${p.rateMlHr} mL/h` : 'free'))
                    .join(' · ')}
                </span>
              </li>
            )}
          </ul>
        ) : (
          <p className="dim">Loading patient…</p>
        )}
      </section>
    </div>
  );
}
