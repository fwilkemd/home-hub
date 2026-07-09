/**
 * Main menu: title treatment, scenario cards, resume-save card, controls,
 * settings.
 */
import { useState } from 'react';
import {
  clearSavedGame,
  getSavedGame,
  listScenarios,
  loadSavedGame,
  startScenario,
} from '../bridge/session';
import { hubActions } from '../bridge/store';
import { wallClock } from './format';

const MENU_CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['WASD', 'move'],
  ['Mouse', 'look'],
  ['E', 'interact'],
  ['Tab', 'chart'],
  ['Q', 'verbal orders'],
  ['1-6', 'tools'],
  ['Space', 'pause'],
  ['+/-', 'speed'],
];

function start(id: string): void {
  startScenario(id).catch((err: unknown) => {
    hubActions.toast(
      `Could not start scenario: ${err instanceof Error ? err.message : String(err)}`,
      'alarm',
      7000,
    );
  });
}

export function MainMenu() {
  const items = listScenarios();
  const [save, setSave] = useState(() => getSavedGame());
  return (
    <div className="menu">
      <div className="menu-inner">
        <h1 className="menu-title">NIGHT FLOAT</h1>
        <p className="menu-sub">first-person ICU simulation</p>

        {save && (
          <div className="menu-resume">
            <button
              className="menu-card menu-card-resume"
              onClick={() => {
                loadSavedGame().catch(() => {
                  hubActions.toast('Could not load the save.', 'alarm', 6000);
                });
              }}
            >
              <span className="menu-card-title">Resume — {save.title}</span>
              <span className="menu-card-line">
                saved at {wallClock(save.clockStart, save.savedAtSim)}
              </span>
            </button>
            <button
              className="btn btn-quiet"
              onClick={() => {
                clearSavedGame();
                setSave(null);
              }}
            >
              Discard
            </button>
          </div>
        )}

        <div className="menu-cards">
          {items.length === 0 && (
            <div className="menu-empty">
              <strong>No scenarios registered yet.</strong>
              <span>
                Scenario content is being authored in a parallel workstream — once it lands in
                src/data/scenarios, cases will appear here.
              </span>
            </div>
          )}
          {items.map((s) => (
            <button key={s.id} className="menu-card" onClick={() => start(s.id)}>
              <span className="menu-card-title">{s.title}</span>
              {s.subtitle && <span className="menu-card-subtitle">{s.subtitle}</span>}
              <span className="menu-card-line">{s.oneLiner}</span>
            </button>
          ))}
        </div>

        <div className="menu-controls" aria-label="Controls">
          {MENU_CONTROLS.map(([key, what]) => (
            <span key={key} className="pair">
              <span className="kc">{key}</span> {what}
            </span>
          ))}
        </div>

        <button className="btn" onClick={() => hubActions.setSettingsOpen(true)}>
          Settings
        </button>
      </div>
    </div>
  );
}
