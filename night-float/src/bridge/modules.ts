/**
 * Integration point for the heavy modules (world / screens / audio / ai).
 * Phase-1/3 workstreams export documented factories from their directories;
 * the integration owner wires them here (Phase 2). Keeping this indirection
 * means the app boots at every phase regardless of module progress.
 */
import type { EngineHandle, ScreensHandle, WorldDeps, WorldHandle } from '../contracts/runtime';

export interface AudioHandle {
  /** call every frame with real dt */
  update(realDtS: number): void;
  /** resume AudioContext after a user gesture */
  unlock(): void;
  dispose(): void;
}

export interface AppModules {
  createWorld?: (deps: WorldDeps) => WorldHandle;
  createScreens?: (engine: EngineHandle) => ScreensHandle;
  createAudio?: (engine: EngineHandle, world: WorldHandle | null) => AudioHandle;
}

export async function loadModules(): Promise<AppModules> {
  // Phase 2 wires:
  //   const { createWorld } = await import('../world');
  //   const { createScreens } = await import('../screens');
  //   const { createAudio } = await import('../audio');
  return {};
}
