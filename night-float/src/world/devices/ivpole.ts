/**
 * IV pole right of the bed: two hanging bags, drip lines, and a 3-channel
 * pump stack sharing one small screen.
 */
import * as THREE from 'three';
import type { WorldCtx } from '../types';
import { IV_POLE, SCREENS, screenNormal } from '../layout';
import { mergedBoxes, tubeBetween } from '../lib';

export function buildIvPole(ctx: WorldCtx): void {
  const { scene } = ctx;
  const px = IV_POLE.pos.x;
  const pz = IV_POLE.pos.z;

  const chrome = new THREE.MeshStandardMaterial({ color: 0x99a0aa, roughness: 0.3, metalness: 0.85 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.05, 10), chrome);
  pole.position.set(px, 1.05, pz);
  pole.castShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.035, 5), chrome);
  base.position.set(px, 0.02, pz);
  // hanger crossbar with upturned hooks
  const hanger = new THREE.Mesh(
    mergedBoxes([
      { size: [0.4, 0.016, 0.016], pos: [px, 2.06, pz] },
      { size: [0.014, 0.05, 0.014], pos: [px - 0.19, 2.04, pz] },
      { size: [0.014, 0.05, 0.014], pos: [px + 0.19, 2.04, pz] },
    ]),
    chrome,
  );
  scene.add(pole, base, hanger);

  // two IV bags (slightly translucent) + drip chambers + lines to the pumps
  const bagMat = new THREE.MeshStandardMaterial({
    color: 0xcfd8de,
    roughness: 0.35,
    transparent: true,
    opacity: 0.8,
  });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xc4cad2, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const bx = px + side * 0.19;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.045), bagMat);
    bag.position.set(bx, 1.92, pz);
    bag.rotation.y = side * 0.15;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.11),
      new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.9 }),
    );
    label.position.set(bx, 1.91, pz + 0.024);
    label.rotation.y = side * 0.15;
    const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 8), bagMat);
    chamber.position.set(bx, 1.77, pz);
    scene.add(bag, label, chamber);
    scene.add(
      tubeBetween(
        new THREE.Vector3(bx, 1.75, pz),
        new THREE.Vector3(px + side * 0.05, 1.42, pz + 0.06),
        0.004,
        lineMat,
      ),
    );
  }

  // pump stack: 3 channel boxes clamped to the pole, one shared screen
  const spec = SCREENS.pump;
  const stackMat = new THREE.MeshStandardMaterial({ color: 0x596069, roughness: 0.5 });
  const stack = new THREE.Mesh(
    mergedBoxes([
      { size: [0.3, 0.125, 0.17], pos: [px, 1.42, pz + 0.09] },
      { size: [0.3, 0.125, 0.17], pos: [px, 1.285, pz + 0.09] },
      { size: [0.3, 0.125, 0.17], pos: [px, 1.15, pz + 0.09] },
      { size: [0.05, 0.42, 0.05], pos: [px, 1.28, pz] }, // clamp block
    ]),
    stackMat,
  );
  stack.castShadow = true;
  scene.add(stack);
  // channel status LEDs (one strip, dedicated material)
  const leds = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.36, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x0a0c10, emissive: 0xd9a544, emissiveIntensity: 1.2 }),
  );
  const n = screenNormal(spec);
  leds.position.set(px - 0.12, 1.28, pz + 0.176);
  scene.add(leds);

  const screen = ctx.screens.createScreen(scene, 'pump');
  // small bezel so the screen isn't floating
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w + 0.03, spec.h + 0.03, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.5 }),
  );
  bezel.position.copy(spec.pos).addScaledVector(n, -0.017);
  bezel.rotation.set(spec.pitch, spec.yaw, 0, 'YXZ');
  scene.add(bezel);

  ctx.reg.add({
    id: 'pump',
    label: 'Infusion pumps',
    colliders: [screen, stack, bezel],
    highlights: [bezel],
    getActions: () => [{ id: 'zoom', label: 'View pumps', ui: { type: 'openZoom', device: 'pump' } }],
  });
}
