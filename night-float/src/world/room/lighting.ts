/**
 * Lighting & mood (SPEC §6.5) — this carries the game. 3am: deep blue-gray
 * ambient, one warm headwall wash (THE single shadow-casting light), faint
 * cool spill from the window, a night light near the floor. Screen point
 * lights live in devices/screens.ts. All constants centralized here so the
 * look can be tuned in one file.
 */
import * as THREE from 'three';
import type { WorldCtx } from '../types';
import { BED, NIGHT_LIGHT, WINDOW, HALF_W } from '../layout';

export const MOOD = {
  hemiSky: 0x2a3550,
  hemiGround: 0x141118,
  hemiIntensity: 0.62,
  spotColor: 0xffd2a0,
  spotIntensity: 18,
  windowColor: 0x51759e,
  windowIntensity: 3.4,
  nightColor: 0xff9a5c,
  nightIntensity: 0.85,
  exposure: 1.28,
} as const;

export function buildLighting(ctx: WorldCtx): void {
  const { scene } = ctx;

  const hemi = new THREE.HemisphereLight(MOOD.hemiSky, MOOD.hemiGround, MOOD.hemiIntensity);
  scene.add(hemi);

  // THE one shadow-casting light: soft warm wash from the headwall strip
  // down over the bed. Everything else casts no shadows (SPEC §14).
  const spot = new THREE.SpotLight(MOOD.spotColor, MOOD.spotIntensity, 7, 0.82, 0.65, 1.8);
  spot.position.set(1.0, 2.28, -2.42);
  spot.target.position.set(BED.center.x, BED.mattressTopY, -1.1);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  spot.shadow.camera.near = 0.4;
  spot.shadow.camera.far = 7;
  scene.add(spot, spot.target);

  // faint cool blue from the window
  const win = new THREE.PointLight(MOOD.windowColor, MOOD.windowIntensity, 5.5, 2);
  win.position.set(-HALF_W + 0.35, WINDOW.sillY + WINDOW.height * 0.6, WINDOW.centerZ);
  scene.add(win);

  // soft night light near the floor by the door/sink
  const night = new THREE.PointLight(MOOD.nightColor, MOOD.nightIntensity, 2.6, 2);
  night.position.copy(NIGHT_LIGHT);
  scene.add(night);
  const nightShade = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.13, 0.03),
    new THREE.MeshStandardMaterial({
      color: 0x22201e,
      emissive: 0xff9a5c,
      emissiveIntensity: 0.9,
      roughness: 0.6,
    }),
  );
  nightShade.position.set(NIGHT_LIGHT.x, NIGHT_LIGHT.y, NIGHT_LIGHT.z + 0.08);
  scene.add(nightShade);
}
