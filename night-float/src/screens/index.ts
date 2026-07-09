/**
 * Screens workstream entry (SPEC §7, §8): offscreen-canvas device screens.
 * The session calls createScreens(engine) once per scenario; the world binds
 * each instance's canvas as an emissive texture and the UI zoom overlay blits
 * the same canvas fullscreen, forwarding pointer events via click(x, y) in
 * CANVAS coordinates.
 */
import type { DeviceScreenInstance, EngineHandle, ScreensHandle } from '../contracts/runtime';
import { registerCxrPainter } from '../bridge/media';
import { createMonitorScreen } from './monitor';
import { createVentScreen } from './vent';
import { createPumpScreen } from './pump';
import { createUsScreen } from './us';
import { makeCxrPainter } from './cxr';

export { createMonitorScreen } from './monitor';
export { createVentScreen } from './vent';
export { createPumpScreen } from './pump';
export { createUsScreen } from './us';
export { makeCxrPainter } from './cxr';

export function createScreens(engine: EngineHandle): ScreensHandle {
  const monitor = createMonitorScreen(engine);
  const vent = createVentScreen(engine);
  const pump = createPumpScreen(engine);
  const us = createUsScreen(engine);
  const all: DeviceScreenInstance[] = [monitor, vent, pump, us];

  registerCxrPainter(makeCxrPainter());

  let disposed = false;
  return {
    monitor,
    vent,
    pump,
    us,
    updateAll(realTimeS: number): void {
      if (disposed) return;
      for (const s of all) s.update(realTimeS); // each self-throttles to ~30 fps
    },
    dispose(): void {
      disposed = true;
      all.length = 0;
    },
  };
}
