/**
 * Workstation overlay (Tab, SPEC §10): centered EMR window with header,
 * left tab rail, and the tab bodies.
 */
import { hubActions, useHub } from '../../bridge/store';
import type { EmrTab } from '../../contracts/ids';
import { wallClock } from '../format';
import { IconX } from '../icons';
import { ChartTab } from './ChartTab';
import { OrdersTab } from './OrdersTab';
import { MarTab } from './MarTab';
import { ResultsTab } from './ResultsTab';
import { FlowsheetTab } from './FlowsheetTab';
import { MediaTab } from './MediaTab';
import { NotesTab } from './NotesTab';
import { DebriefCore } from '../debrief/DebriefCore';

const BASE_TABS: { id: EmrTab; label: string }[] = [
  { id: 'chart', label: 'Chart' },
  { id: 'orders', label: 'Orders' },
  { id: 'mar', label: 'MAR' },
  { id: 'results', label: 'Results' },
  { id: 'flowsheet', label: 'Flowsheet' },
  { id: 'media', label: 'Media' },
  { id: 'notes', label: 'Notes' },
];

export function Workstation() {
  const tab = useHub((s) => s.emrTab);
  const patient = useHub((s) => s.patient);
  const simTime = useHub((s) => s.simTime);
  const clockStart = useHub((s) => s.clockStart);
  const debrief = useHub((s) => s.debrief);

  const tabs = debrief ? [...BASE_TABS, { id: 'debrief' as EmrTab, label: 'Debrief' }] : BASE_TABS;
  const d = patient?.demographics;

  return (
    <div className="ws-veil">
      <div className="ws" role="dialog" aria-label="Workstation">
        <header className="ws-head">
          <div className="ws-patient">
            <strong>{d?.name ?? 'No patient'}</strong>
            {d && (
              <span className="dim">
                {'  '}
                {d.age} {d.sex} · {d.weightKg} kg · ICU 07
              </span>
            )}
          </div>
          <div className="ws-clock mono">{wallClock(clockStart, simTime)}</div>
          <button
            className="iconbtn"
            onClick={() => hubActions.closeWorkstation()}
            aria-label="Close workstation (Tab)"
          >
            <IconX />
          </button>
        </header>

        <div className="ws-body">
          <nav className="ws-rail" aria-label="Chart tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`ws-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => hubActions.setEmrTab(t.id)}
                aria-current={tab === t.id}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <main className="ws-main scroll">
            {tab === 'chart' && <ChartTab />}
            {tab === 'orders' && <OrdersTab />}
            {tab === 'mar' && <MarTab />}
            {tab === 'results' && <ResultsTab />}
            {tab === 'flowsheet' && <FlowsheetTab />}
            {tab === 'media' && <MediaTab />}
            {tab === 'notes' && <NotesTab />}
            {tab === 'debrief' &&
              (debrief ? (
                <DebriefCore debrief={debrief} clockStart={clockStart} />
              ) : (
                <p className="empty">No debrief yet.</p>
              ))}
          </main>
        </div>
      </div>
    </div>
  );
}
