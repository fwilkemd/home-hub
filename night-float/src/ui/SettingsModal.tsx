/**
 * Settings modal: audio sliders, optional LLM module config, controls
 * reference, event-log export, quit to menu.
 */
import { useEffect, useState } from 'react';
import { hubActions, useHub } from '../bridge/store';
import { backToMenu, saveGame } from '../bridge/session';
import { CONTROLS, downloadLog } from './format';
import { IconX } from './icons';

function VolRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(value * 100);
  return (
    <label className="vol-row">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.currentTarget.value) / 100)}
      />
      <span className="mono dim">{pct}</span>
    </label>
  );
}

export function SettingsModal() {
  const settings = useHub((s) => s.settings);
  const phase = useHub((s) => s.phase);
  const procedureActive = useHub((s) => s.procedure !== null);
  const [showControls, setShowControls] = useState(false);

  // While running, the global handler owns Esc; cover the other phases here.
  useEffect(() => {
    if (phase === 'running') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hubActions.setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const quit = () => {
    if (window.confirm('Quit to menu? The current scenario will be lost.')) {
      hubActions.setSettingsOpen(false);
      backToMenu();
    }
  };

  return (
    <div className="veil" role="presentation">
      <div className="dialog" role="dialog" aria-label="Settings" style={{ width: 460 }}>
        <div className="dialog-head">
          <span>Settings</span>
          <button
            className="iconbtn"
            onClick={() => hubActions.setSettingsOpen(false)}
            aria-label="Close settings"
          >
            <IconX />
          </button>
        </div>

        <div className="dialog-body">
          <section>
            <h3 className="dim small" style={{ margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Audio
            </h3>
            <VolRow label="Master" value={settings.masterVol} onChange={(v) => hubActions.updateSettings({ masterVol: v })} />
            <VolRow label="Effects" value={settings.sfxVol} onChange={(v) => hubActions.updateSettings({ sfxVol: v })} />
            <VolRow label="Ambience" value={settings.ambienceVol} onChange={(v) => hubActions.updateSettings({ ambienceVol: v })} />
          </section>

          <section>
            <h3 className="dim small" style={{ margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              AI voice chat (optional)
            </h3>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.llmEnabled}
                onChange={(e) => hubActions.updateSettings({ llmEnabled: e.currentTarget.checked })}
              />
              Enable free-text chat with nurse / consultant / family
            </label>
            <label className="field" style={{ marginTop: 8 }}>
              Anthropic API key
              <input
                className="input"
                type="password"
                autoComplete="off"
                placeholder="sk-ant-..."
                value={settings.llmKey}
                onChange={(e) => hubActions.updateSettings({ llmKey: e.currentTarget.value })}
              />
            </label>
            <p className="dim small" style={{ margin: '6px 0 0' }}>
              Model claude-sonnet-5, called directly from this browser. The key is stored only in
              this browser&rsquo;s localStorage. Everything works with this off.
            </p>
          </section>

          {showControls && (
            <section>
              <h3 className="dim small" style={{ margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Controls
              </h3>
              <div className="controls-list">
                {CONTROLS.map(([key, what]) => (
                  <span key={key} style={{ display: 'contents' }}>
                    <span className="kc">{key}</span>
                    <span>{what}</span>
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="dialog-foot">
          <button className="btn" onClick={() => setShowControls((v) => !v)}>
            {showControls ? 'Hide controls' : 'Controls reference'}
          </button>
          <button className="btn" onClick={downloadLog}>
            Export event log
          </button>
          {phase === 'running' && (
            <button
              className="btn"
              disabled={procedureActive}
              title={procedureActive ? 'Finish or abort the procedure first' : undefined}
              onClick={() => {
                const result = saveGame();
                hubActions.toast(
                  result === 'saved'
                    ? 'Game saved — resume from the main menu.'
                    : result === 'blocked'
                      ? 'Cannot save mid-procedure.'
                      : 'Save failed (storage unavailable).',
                  result === 'saved' ? 'success' : 'alarm',
                  4000,
                );
              }}
            >
              Save game
            </button>
          )}
          {phase !== 'menu' && (
            <button className="btn danger" onClick={quit}>
              Quit to menu
            </button>
          )}
          <button className="btn acc" onClick={() => hubActions.setSettingsOpen(false)}>
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}
