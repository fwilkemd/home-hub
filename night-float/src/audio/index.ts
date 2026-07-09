/**
 * /src/audio — Night Float's synthesized soundscape (SPEC §12).
 *
 * Mix architecture: one AudioContext with master -> { sfx, ambience->duck }
 * buses whose gains track the settings sliders live. Alarm cadences (state
 * from engine.getActiveAlarms(), highest priority per source), the
 * SpO2-pitched QRS beep and pump clicks route through per-device panner
 * buses positioned from the world (plain stereo when world is null); room
 * tone, hum and the breath-synced vent whoosh live on the ambience bus; the
 * stethoscope talks straight into sfx and ducks ambience while listening.
 * Everything is oscillators + deterministic hash01 noise buffers — no
 * samples, no Math.random — and every node is guarded so environments
 * without AudioContext (jsdom, headless smoke) stay silent and error-free.
 */
import type { EngineHandle, WorldHandle } from '../contracts/runtime';
import type { AudioHandle } from '../bridge/modules';
import { createAudioCore } from './context';
import { createAlarmSounds } from './alarms';
import { createCueSounds } from './beep';
import { createAmbience } from './ambience';
import { createSteth } from './steth';

export function createAudio(engine: EngineHandle, world: WorldHandle | null): AudioHandle {
  const core = createAudioCore(world !== null);
  const alarms = createAlarmSounds(core, engine);
  const cues = createCueSounds(core);
  const ambience = createAmbience(core, engine);
  const steth = createSteth(core, engine);
  let disposed = false;

  return {
    update(realDtS: number): void {
      if (disposed) return;
      try {
        core.updateSpatial(world, realDtS);
        alarms.update();
        ambience.update(realDtS);
        steth.update();
      } catch {
        /* never propagate into the frame loop */
      }
    },

    unlock(): void {
      core.unlock();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        steth.dispose();
        ambience.dispose();
        cues.dispose();
        alarms.dispose();
      } catch {
        /* keep going — core close below still runs */
      }
      core.dispose();
    },
  };
}
