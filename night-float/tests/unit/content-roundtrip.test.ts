import { describe, expect, it } from 'vitest';
import {
  drugDefinitionSchema,
  labPanelDefinitionSchema,
  procedureDefinitionSchema,
  scenarioFileSchema,
} from '../../src/contracts/content';
import { drugs } from '../../src/data/drugs';
import { labPanels } from '../../src/data/labs';
import { procedures } from '../../src/data/procedures';
import { scenarios } from '../../src/data/scenarios';
import { labGenerators } from '../../src/engine/labs/generators';

function uniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((i) => i.id)).size === items.length;
}

describe('content round-trips', () => {
  it('registries are populated with unique ids', () => {
    expect(drugs.length).toBeGreaterThanOrEqual(6);
    expect(labPanels.length).toBeGreaterThanOrEqual(6);
    expect(procedures.length).toBeGreaterThanOrEqual(3);
    expect(scenarios.map((s) => s.id).sort()).toEqual(['crashing', 'stable-night']);
    expect(uniqueIds(drugs)).toBe(true);
    expect(uniqueIds(labPanels)).toBe(true);
    expect(uniqueIds(procedures)).toBe(true);
    expect(uniqueIds(scenarios)).toBe(true);
  });

  it('every drug parses and survives JSON round-trip', () => {
    for (const d of drugs) {
      const again = drugDefinitionSchema.parse(JSON.parse(JSON.stringify(d)));
      expect(again).toEqual(d);
      expect(d.todoMedical.length).toBeGreaterThan(10);
    }
  });

  it('every lab panel parses, round-trips, and only uses known generators', () => {
    for (const p of labPanels) {
      const again = labPanelDefinitionSchema.parse(JSON.parse(JSON.stringify(p)));
      expect(again).toEqual(p);
      for (const t of p.tests) {
        expect(labGenerators[t.generator], `generator '${t.generator}' (${p.id}/${t.id})`).toBeTypeOf(
          'function',
        );
      }
    }
  });

  it('every procedure parses, round-trips, and skip-multipliers reference real steps', () => {
    for (const proc of procedures) {
      const again = procedureDefinitionSchema.parse(JSON.parse(JSON.stringify(proc)));
      expect(again).toEqual(proc);
      const stepIds = new Set(proc.steps.map((s) => s.id));
      for (const step of proc.steps) {
        for (const comp of step.complications) {
          for (const mod of comp.probIfSkipped) {
            expect(stepIds.has(mod.stepId), `${proc.id}/${comp.id} references ${mod.stepId}`).toBe(true);
          }
        }
      }
    }
  });

  it('every scenario parses and survives JSON round-trip', () => {
    for (const s of scenarios) {
      const again = scenarioFileSchema.parse(JSON.parse(JSON.stringify(s)));
      expect(again).toEqual(s);
      expect(s.endConditions.length).toBeGreaterThan(0);
      expect(s.rubric.items.length).toBeGreaterThan(0);
    }
  });

  it('crashing scenario wires the demo arc content it depends on', () => {
    const crashing = scenarios.find((s) => s.id === 'crashing');
    expect(crashing).toBeDefined();
    if (!crashing) return;
    // drugs the rubric expects exist in the registry
    expect(drugs.some((d) => d.id === 'norepinephrine')).toBe(true);
    expect(drugs.some((d) => d.id === 'lactated-ringers')).toBe(true);
    // vent pre-set + standby so intubation connects a sensible circuit
    expect(crashing.initialPatient.devices.vent.standby).toBe(true);
    expect(crashing.initialPatient.devices.vent.connected).toBe(false);
    // both death and success paths authored
    const outcomes = new Set(crashing.endConditions.map((e) => e.outcome));
    expect(outcomes.has('death')).toBe(true);
    expect(outcomes.has('success')).toBe(true);
  });
});
