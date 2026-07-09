/**
 * Scenario registry. Content workstreams add scenarios here; everything must
 * pass defineScenario (zod). SPEC §5.5 ships: stable-night, crashing.
 */
import type { ScenarioFile } from '../../contracts/content';

export const scenarios: ScenarioFile[] = [];

export function getScenario(id: string): ScenarioFile | undefined {
  return scenarios.find((s) => s.id === id);
}
