/**
 * Full-screen debrief (post-scenario): DebriefCore + export / back / re-run.
 */
import { hubActions, useHub } from '../bridge/store';
import { backToMenu, startScenario } from '../bridge/session';
import { downloadLog } from './format';
import { DebriefCore } from './debrief/DebriefCore';

export function DebriefScreen() {
  const debrief = useHub((s) => s.debrief);
  const clockStart = useHub((s) => s.clockStart);

  if (!debrief) {
    return (
      <div className="debrief-screen">
        <div className="debrief-inner">
          <p className="empty">No debrief data.</p>
          <button className="btn" onClick={() => backToMenu()}>
            Back to menu
          </button>
        </div>
      </div>
    );
  }

  const runAgain = () => {
    startScenario(debrief.scenarioId).catch(() =>
      hubActions.toast('Could not restart the scenario', 'alarm', 6000),
    );
  };

  return (
    <div className="debrief-screen">
      <div className="debrief-inner">
        <DebriefCore debrief={debrief} clockStart={clockStart} />
        <div className="debrief-actions">
          <button className="btn" onClick={downloadLog}>
            Export JSON
          </button>
          <button className="btn" onClick={() => backToMenu()}>
            Back to menu
          </button>
          <button className="btn acc" onClick={runAgain}>
            Run again
          </button>
        </div>
      </div>
    </div>
  );
}
