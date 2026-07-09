/**
 * Procedure registry — pure data + generic interaction types (SPEC §9).
 * All entries pass defineProcedure. TODO(MEDICAL): step lists are
 * placeholders for the medical pass; the machinery must not care.
 */
import type { ProcedureDefinition } from '../../contracts/content';
import { cvl } from './cvl';
import { aline } from './aline';
import { ett } from './ett';

export const procedures: ProcedureDefinition[] = [cvl, aline, ett];

export function getProcedure(id: string): ProcedureDefinition | undefined {
  return procedures.find((p) => p.id === id);
}
