/**
 * Integration point for the heavy modules (world / screens / audio / ai).
 * Factories load lazily so the menu boots instantly and each layer can ship
 * independently. Missing modules degrade gracefully (session tolerates null).
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

let cached: AppModules | null = null;

export async function loadModules(): Promise<AppModules> {
  if (cached) return cached;
  const [world, screens, audio] = await Promise.all([
    import('../world'),
    import('../screens'),
    import('../audio'),
  ]);
  cached = {
    createWorld: world.createWorld,
    createScreens: screens.createScreens,
    createAudio: audio.createAudio,
  };
  return cached;
}
