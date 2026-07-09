/**
 * PHASE 0/2 STUB — the audio workstream (Phase 3) replaces this module with
 * the real alarm manager cadences, ambience, vent whoosh, SpO2-pitched QRS
 * beep and auscultation synths (SPEC §12).
 */
import type { EngineHandle, WorldHandle } from '../contracts/runtime';
import type { AudioHandle } from '../bridge/modules';

export function createAudio(_engine: EngineHandle, _world: WorldHandle | null): AudioHandle {
  return {
    update(_realDtS: number) {},
    unlock() {},
    dispose() {},
  };
}
