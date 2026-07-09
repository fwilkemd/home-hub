/**
 * Shared world-internal context passed to every builder. Builders add meshes
 * to ctx.scene, register interactables, and return per-frame updaters.
 */
import type * as THREE from 'three';
import type { WorldDeps } from '../contracts/runtime';
import type { InteractableRegistry } from './interact/interactables';
import type { ScreenRig } from './devices/screens';

export type Updater = (dt: number) => void;

export interface WorldCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  deps: WorldDeps;
  reg: InteractableRegistry;
  screens: ScreenRig;
  /** accumulated real seconds since world creation — deterministic anim driver */
  clock: { t: number };
}
