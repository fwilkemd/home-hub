/**
 * PHASE 0 PLACEHOLDER UI — the EMR/HUD workstream (Phase 1D) replaces this
 * file with the real overlay (menu, HUD, workstation, dialogs, debrief).
 */
import { listScenarios, startScenario } from '../bridge/session';
import { useHub } from '../bridge/store';

export function App() {
  const phase = useHub((s) => s.phase);
  if (phase === 'menu') return <Menu />;
  return <RunningHud />;
}

function Menu() {
  const items = listScenarios();
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#cfd6e4',
        background: 'radial-gradient(ellipse at 50% 40%, #10131c 0%, #06070a 70%)',
        pointerEvents: 'auto',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontWeight: 300, letterSpacing: '0.35em', fontSize: 42 }}>NIGHT FLOAT</h1>
      <p style={{ opacity: 0.6 }}>first-person ICU simulation</p>
      <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 && <em style={{ opacity: 0.5 }}>No scenarios registered yet.</em>}
        {items.map((s) => (
          <button
            key={s.id}
            onClick={() => void startScenario(s.id)}
            style={{
              background: '#151a26',
              color: '#dfe6f2',
              border: '1px solid #2a3348',
              borderRadius: 8,
              padding: '14px 22px',
              cursor: 'pointer',
              minWidth: 420,
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 16 }}>{s.title}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{s.oneLiner}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RunningHud() {
  const simTime = useHub((s) => s.simTime);
  return (
    <div style={{ position: 'absolute', top: 12, left: 12, color: '#9fb0cc', fontFamily: 'monospace' }}>
      t = {simTime.toFixed(1)}s
    </div>
  );
}
