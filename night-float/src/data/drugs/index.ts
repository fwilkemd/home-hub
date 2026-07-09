/**
 * Drug registry — pure data (SPEC §5.3). All entries pass defineDrug (zod).
 * TODO(MEDICAL): every drug in here ships with placeholder kinetics/effects.
 */
import type { DrugDefinition } from '../../contracts/content';
import { norepinephrine } from './norepinephrine';
import { lactatedRingers } from './lactated-ringers';
import { propofol } from './propofol';
import { rocuronium } from './rocuronium';
import { amiodarone } from './amiodarone';
import { fentanyl } from './fentanyl';

export const drugs: DrugDefinition[] = [
  norepinephrine,
  lactatedRingers,
  propofol,
  rocuronium,
  amiodarone,
  fentanyl,
];

export function getDrug(id: string): DrugDefinition | undefined {
  return drugs.find((d) => d.id === id);
}
