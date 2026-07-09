/**
 * Procedure registry — pure data + generic interaction types (SPEC §9).
 * All entries pass defineProcedure. Step lists are placeholders for the
 * medical pass; the machinery must not care.
 */
import type { ProcedureDefinition } from '../../contracts/content';

export const procedures: ProcedureDefinition[] = [];

export function getProcedure(id: string): ProcedureDefinition | undefined {
  return procedures.find((p) => p.id === id);
}
