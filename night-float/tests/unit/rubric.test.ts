import { describe, expect, it } from 'vitest';
import { EventLog } from '../../src/engine/log';
import { evaluateRubric } from '../../src/engine/scenario/rubric';

function buildLog(): EventLog {
  const log = new EventLog();
  log.append(10, {
    type: 'AlarmRaised',
    alarmId: 'map-low',
    source: 'monitor',
    priority: 'crisis',
    label: 'MAP low',
  });
  log.append(100, {
    type: 'InfusionStarted',
    infusion: {
      id: 'inf-1',
      drugId: 'norepi',
      doseRate: 0.05,
      doseUnit: 'mcg/kg/min',
      channelId: 'ch1',
      startedAt: 100,
    },
    label: 'norepinephrine gtt',
  });
  log.append(500, { type: 'ScenarioEnded', outcome: 'success', summary: 'Stabilized.' });
  return log;
}

describe('rubric engine', () => {
  it('evaluates eventOccurred / eventWithin / never / outcome', () => {
    const log = buildLog();
    const results = evaluateRubric(
      {
        items: [
          {
            id: 'a',
            label: 'Pressor started',
            points: 5,
            condition: { type: 'eventOccurred', eventType: 'InfusionStarted' },
          },
          {
            id: 'b',
            label: 'Pressor within 5 min of alarm',
            points: 10,
            condition: {
              type: 'eventWithin',
              eventType: 'InfusionStarted',
              afterEventType: 'AlarmRaised',
              afterWhere: { alarmId: 'map-low' },
              windowS: 300,
            },
          },
          {
            id: 'c',
            label: 'No contamination',
            points: 3,
            condition: { type: 'never', eventType: 'SterileFieldContaminated' },
          },
          {
            id: 'd',
            label: 'Survived',
            points: 20,
            condition: { type: 'outcome', outcome: 'success' },
          },
          {
            id: 'e',
            label: 'Pressor within 60s of alarm (should fail)',
            points: 5,
            condition: {
              type: 'eventWithin',
              eventType: 'InfusionStarted',
              afterEventType: 'AlarmRaised',
              windowS: 60,
            },
          },
        ],
      },
      log.all(),
    );
    expect(results.map((r) => r.pass)).toEqual([true, true, true, true, false]);
    expect(results.reduce((a, r) => a + r.earned, 0)).toBe(38);
  });
});
