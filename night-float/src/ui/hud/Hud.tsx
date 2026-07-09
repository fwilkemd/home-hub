/**
 * HUD composition (running phase). The container is pointer-events:none;
 * individual widgets opt back in where they're interactive.
 */
import { PatientRibbon, ClockSpeed, AlarmsStrip } from './TopHud';
import { CrosshairHover } from './HoverPrompt';
import { Hotbar } from './Hotbar';
import { NurseLine } from './NurseLine';
import { ExamCard, TutorialBanner } from './Cards';
import { ProcedurePanel } from './ProcedurePanel';

export function Hud() {
  return (
    <div className="hud">
      <PatientRibbon />
      <TutorialBanner />
      <ClockSpeed />
      <AlarmsStrip />
      <CrosshairHover />
      <ExamCard />
      <ProcedurePanel />
      <NurseLine />
      <Hotbar />
    </div>
  );
}
