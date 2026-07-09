import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine';
import { defineScenario } from '../../src/contracts/content';
import { PHYSIOLOGY_DEFAULTS } from '../../src/contracts/patient';
import { isEvent, type SimEvent } from '../../src/contracts/events';

function labOrder(panelId: string, stat: boolean) {
  return {
    type: 'PlaceOrder' as const,
    draft: { kind: 'lab' as const, panelId, stat, label: `${panelId}${stat ? ' — STAT' : ''}` },
  };
}

/** Quiet inline scenario with NO end conditions so long turnarounds resolve. */
function quietScenario(physiologyOverrides: Record<string, number> = {}) {
  return defineScenario({
    id: 'labs-test',
    title: 'Labs test',
    seed: 41,
    briefing: { oneLiner: 'x', hpi: 'y', background: 'z' },
    initialPatient: {
      id: 'pt-l',
      demographics: { name: 'L', age: 55, sex: 'F', weightKg: 70 },
      vitals: { hr: 80, rhythm: 'sinus', spo2: 97, rr: 15, map: 82, sbp: 118, dbp: 64, tempC: 37 },
      physiology: { ...PHYSIOLOGY_DEFAULTS, ...physiologyOverrides },
      devices: { monitor: {}, vent: {}, pumps: [{ id: 'ch-1' }] },
    },
  });
}

function ordered(log: readonly SimEvent[], type: 'LabOrdered' | 'LabResulted') {
  return log.filter((e) => e.type === type) as Array<Extract<SimEvent, { type: typeof type }>>;
}

describe('labs subsystem', () => {
  it('turnaround ordering: stat poc results before a routine send-out', () => {
    const engine = createEngine(quietScenario());
    engine.stepSim(1);
    engine.dispatch(labOrder('cbc', false));
    engine.dispatch(labOrder('bmp', false));
    engine.dispatch(labOrder('lactate', true));
    engine.stepSim(1400);

    const orderedEvents = ordered(engine.getLog(), 'LabOrdered');
    expect(orderedEvents.length).toBe(3);
    // all three land in the same tick, so the stat lactate jumps the whole
    // pending queue and is drawn first
    expect(orderedEvents.map((e) => (isEvent(e, 'LabOrdered') ? e.panelId : ''))).toEqual([
      'lactate',
      'cbc',
      'bmp',
    ]);

    const resulted = ordered(engine.getLog(), 'LabResulted');
    expect(resulted.length).toBe(3);
    expect(isEvent(resulted[0], 'LabResulted') && resulted[0].panelId).toBe('lactate');

    // stamped turnarounds: stat statTurnaroundS, routine turnaroundS
    for (const o of orderedEvents) {
      if (!isEvent(o, 'LabOrdered')) continue;
      const turnaround = o.resultsAt - o.t;
      if (o.panelId === 'lactate') expect(turnaround).toBe(120);
      if (o.panelId === 'cbc') expect(turnaround).toBe(900);
      if (o.panelId === 'bmp') expect(turnaround).toBe(1200);
    }

    // results resolve within one tick of their stamped time
    for (const r of resulted) {
      if (!isEvent(r, 'LabResulted')) continue;
      const o = orderedEvents.find((x) => isEvent(x, 'LabOrdered') && x.orderId === r.orderId);
      expect(o).toBeDefined();
      if (o && isEvent(o, 'LabOrdered')) {
        expect(r.t).toBeGreaterThanOrEqual(o.resultsAt);
        expect(r.t - o.resultsAt).toBeLessThan(0.2);
      }
    }
  });

  it('flags values against ref and critical ranges', () => {
    // extreme scenario-flavored anchors so flags are unambiguous
    const engine = createEngine(quietScenario({ kAnchor: 7.6, lactateAnchor: 9, hgbAnchor: 5 }));
    engine.stepSim(1);
    engine.dispatch(labOrder('bmp', true));
    engine.dispatch(labOrder('lactate', true));
    engine.dispatch(labOrder('cbc', true));
    engine.stepSim(1200);

    const resulted = ordered(engine.getLog(), 'LabResulted');
    expect(resulted.length).toBe(3);
    const byTest = new Map<string, { value: number; flag: string }>();
    for (const r of resulted) {
      if (!isEvent(r, 'LabResulted')) continue;
      for (const res of r.results) byTest.set(res.testId, { value: res.value, flag: res.flag });
    }
    expect(byTest.get('k')?.flag).toBe('crit_high');
    expect(byTest.get('lactate')?.flag).toBe('crit_high');
    expect(byTest.get('hgb')?.flag).toBe('crit_low');
  });

  it('imaging: cxr orders then results with findings text', () => {
    const engine = createEngine(quietScenario());
    engine.dispatch({
      type: 'PlaceOrder',
      draft: { kind: 'imaging', study: 'cxr', label: 'Portable CXR' },
    });
    engine.stepSim(300);
    const log = engine.getLog();
    const orderedImg = log.find((e) => isEvent(e, 'ImagingOrdered'));
    const resulted = log.find((e) => isEvent(e, 'ImagingResulted'));
    expect(orderedImg).toBeDefined();
    expect(resulted).toBeDefined();
    if (resulted && isEvent(resulted, 'ImagingResulted')) {
      expect(resulted.mediaId).toMatch(/^img-\d+$/);
      expect(resulted.findingsText).toContain('Lungs are clear');
    }
  });
});
