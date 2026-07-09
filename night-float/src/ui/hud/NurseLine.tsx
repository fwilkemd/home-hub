/**
 * Bottom-left nurse line: her current task, a speech bubble while fresh, and
 * a fading 4-line ticker of recent notable sim events.
 */
import { useMemo } from 'react';
import { useHub } from '../../bridge/store';
import type { SimEvent, SimEventType } from '../../contracts/events';
import { describeEvent } from '../format';
import { useNow } from '../useNow';

const TICKER_TYPES = new Set<SimEventType>([
  'MedAdministered',
  'InfusionStarted',
  'InfusionRateChanged',
  'InfusionStopped',
  'LabResulted',
  'ImagingResulted',
  'AlarmRaised',
  'ProcedureCompleted',
  'ProcedureComplication',
  'LinePlaced',
  'ScenarioScriptedEvent',
  'RhythmChanged',
]);

function tickerRows(events: readonly SimEvent[]): { seq: number; text: string }[] {
  const out: { seq: number; text: string }[] = [];
  const floor = Math.max(0, events.length - 100);
  for (let i = events.length - 1; i >= floor && out.length < 4; i--) {
    const e = events[i];
    if (!TICKER_TYPES.has(e.type)) continue;
    const text = describeEvent(e);
    if (text) out.push({ seq: e.seq, text });
  }
  return out.reverse();
}

export function NurseLine() {
  const nurse = useHub((s) => s.nurse);
  const events = useHub((s) => s.events);
  const now = useNow(500);

  const rows = useMemo(() => tickerRows(events), [events]);
  const saying = nurse.say && nurse.sayUntilReal > now ? nurse.say : null;

  return (
    <div className="nurseline">
      {rows.length > 0 && (
        <div className="ticker" aria-hidden="true">
          {rows.map((row, i) => (
            <div
              key={row.seq}
              className="ticker-row"
              style={{ opacity: 0.3 + (0.7 * (i + 1)) / rows.length }}
            >
              {row.text}
            </div>
          ))}
        </div>
      )}
      {saying && <div className="nurse-bubble">&ldquo;{saying}&rdquo;</div>}
      <div className="nurse-task">
        <span className="nurse-dot" aria-hidden="true" />
        <span>Nurse — {nurse.busyWith ?? 'standing by'}</span>
      </div>
    </div>
  );
}
