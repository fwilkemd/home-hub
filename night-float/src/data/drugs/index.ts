/**
 * Drug registry — pure data (SPEC §5.3). All entries pass defineDrug (zod).
 * TODO(MEDICAL): every drug in here ships with placeholder kinetics/effects.
 */
import type { DrugDefinition } from '../../contracts/content';

export const drugs: DrugDefinition[] = [];

export function getDrug(id: string): DrugDefinition | undefined {
  return drugs.find((d) => d.id === id);
}
