/**
 * Scenario registry. Content workstreams add scenarios here; everything must
 * pass defineScenario (zod). SPEC §5.5 ships: stable-night, crashing.
 */
import type { ScenarioFile } from '../../contracts/content';
import { stableNight } from './stable-night';
import { crashing } from './crashing';

export const scenarios: ScenarioFile[] = [stableNight, crashing];

export function getScenario(id: string): ScenarioFile | undefined {
  return scenarios.find((s) => s.id === id);
}
