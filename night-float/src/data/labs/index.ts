/**
 * Lab panel registry — pure data (SPEC §5.4). All entries pass defineLabPanel.
 * Value generation lives in src/engine/labs/generators.ts (TODO(MEDICAL)).
 */
import type { LabPanelDefinition } from '../../contracts/content';

export const labPanels: LabPanelDefinition[] = [];

export function getLabPanel(id: string): LabPanelDefinition | undefined {
  return labPanels.find((p) => p.id === id);
}
