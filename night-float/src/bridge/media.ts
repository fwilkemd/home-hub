/**
 * Media plumbing: procedural image painters register here (screens layer),
 * the event applier calls them. Keeps the engine canvas-free.
 */
import type { PatientState } from '../contracts/patient';

export type CxrPainter = (patient: PatientState, findingsText: string, seed: number) => string;

let cxrPainter: CxrPainter | null = null;

export function registerCxrPainter(fn: CxrPainter): void {
  cxrPainter = fn;
}

export function paintCxr(patient: PatientState, findingsText: string, seed: number): string {
  return cxrPainter ? cxrPainter(patient, findingsText, seed) : '';
}

/** UsSaveClip commands stash their dataUrl here just before dispatch. */
let pendingClipDataUrl: string | null = null;
export function stashClipDataUrl(url: string): void {
  pendingClipDataUrl = url;
}
export function takeClipDataUrl(): string | null {
  const u = pendingClipDataUrl;
  pendingClipDataUrl = null;
  return u;
}
