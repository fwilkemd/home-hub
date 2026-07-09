import { describe, expect, it } from 'vitest';
import {
  defineScenario,
  predicateSchema,
  scenarioFileSchema,
  type Predicate,
} from '../../src/contracts/content';
import { PHYSIOLOGY_DEFAULTS, patientStateSchema } from '../../src/contracts/patient';

function minimalPatient() {
  return patientStateSchema.parse({
    id: 'pt-1',
    demographics: { name: 'Test Patient', age: 60, sex: 'M', weightKg: 80 },
    vitals: {
      hr: 80,
      rhythm: 'sinus',
      spo2: 97,
      rr: 16,
      map: 82,
      sbp: 118,
      dbp: 64,
      tempC: 37,
    },
    physiology: { ...PHYSIOLOGY_DEFAULTS },
    devices: {
      monitor: {},
      vent: {},
      pumps: [],
    },
  });
}

describe('contracts schemas', () => {
  it('patient state parses with defaults and round-trips JSON', () => {
    const p = minimalPatient();
    expect(p.devices.vent.mode).toBe('VC');
    expect(p.devices.monitor.nibpIntervalMin).toBe(5);
    const again = patientStateSchema.parse(JSON.parse(JSON.stringify(p)));
    expect(again).toEqual(p);
  });

  it('scenario file round-trips through zod', () => {
    const scenario = defineScenario({
      id: 'test',
      title: 'Test',
      seed: 7,
      briefing: { oneLiner: 'x', hpi: 'y', background: 'z' },
      initialPatient: minimalPatient(),
      scriptedEvents: [
        {
          id: 'ev1',
          at: 60,
          actions: [
            { type: 'rampPhysiology', param: 'svr', to: 0.2, overS: 120 },
            { type: 'nurseSay', text: 'Pressure is soft.' },
          ],
          dropToRealtime: true,
        },
      ],
      endConditions: [
        {
          id: 'death',
          outcome: 'death',
          when: { type: 'sustained', path: 'map', op: 'lt', value: 40, seconds: 180 },
          summary: 'Lost the patient.',
        },
      ],
      rubric: {
        items: [
          {
            id: 'r1',
            label: 'Started a pressor',
            points: 10,
            condition: { type: 'eventOccurred', eventType: 'InfusionStarted' },
          },
        ],
      },
    });
    const parsed = scenarioFileSchema.parse(JSON.parse(JSON.stringify(scenario)));
    expect(parsed.scriptedEvents[0].actions.length).toBe(2);
    expect(parsed.rubric.items[0].points).toBe(10);
  });

  it('recursive predicates parse', () => {
    const p: Predicate = {
      type: 'and',
      conditions: [
        { type: 'vital', path: 'map', op: 'lt', value: 65 },
        {
          type: 'not',
          condition: { type: 'eventOccurred', eventType: 'InfusionStarted' },
        },
      ],
    };
    expect(predicateSchema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});
