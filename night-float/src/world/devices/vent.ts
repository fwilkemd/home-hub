/**
 * Ventilator: cart-style body left of the bed head, its own screen, and a
 * corrugated circuit that visibly runs to the patient's head ONLY while
 * `patient.devices.vent.connected` (checked every frame).
 */
import * as THREE from 'three';
import type { WorldCtx, Updater } from '../types';
import { PATIENT, SCREENS, VENT_CART, screenNormal } from '../layout';
import { mergedBoxes, paintCorrugation } from '../lib';

export function buildVent(ctx: WorldCtx): Updater {
  const { scene, deps } = ctx;
  const spec = SCREENS.vent;

  const g = new THREE.Group();
  g.position.copy(VENT_CART.pos);
  g.rotation.y = VENT_CART.yaw;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4c545e, roughness: 0.5 });
  const body = new THREE.Mesh(
    mergedBoxes([
      { size: [0.52, 0.1, 0.5], pos: [0, 0.1, 0] }, // base
      { size: [0.1, 0.55, 0.1], pos: [0, 0.42, -0.05] }, // column
      { size: [0.48, 0.42, 0.42], pos: [0, 0.88, 0] }, // main unit
    ]),
    bodyMat,
  );
  body.castShadow = true;
  g.add(body);

  // front detail: knob + status LED bar (dedicated materials, cheap glow)
  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.03, 14),
    new THREE.MeshStandardMaterial({ color: 0xb7bdc6, metalness: 0.7, roughness: 0.3 }),
  );
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.14, 0.8, 0.222);
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.012, 0.005),
    new THREE.MeshStandardMaterial({ color: 0x0a0c10, emissive: 0x2fae62, emissiveIntensity: 1.4 }),
  );
  led.position.set(-0.1, 1.06, 0.212);
  g.add(knob, led);

  for (const [sx, sz] of [
    [-0.2, -0.18],
    [0.2, -0.18],
    [-0.2, 0.18],
    [0.2, 0.18],
  ]) {
    const caster = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.6 }),
    );
    caster.position.set(sx, 0.05, sz);
    g.add(caster);
  }
  scene.add(g);

  // screen (world-positioned from layout) + housing
  const n = screenNormal(spec);
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w + 0.05, spec.h + 0.05, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x272b33, roughness: 0.5 }),
  );
  housing.position.copy(spec.pos).addScaledVector(n, -0.03);
  housing.rotation.set(spec.pitch, spec.yaw, 0, 'YXZ');
  scene.add(housing);
  const screen = ctx.screens.createScreen(scene, 'vent');

  // corrugated circuit toward the patient's mouth
  const circuit = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(VENT_CART.pos.x + 0.18, 1.06, VENT_CART.pos.z + 0.12),
        new THREE.Vector3(-0.15, 1.22, -1.72),
        new THREE.Vector3(0.35, 1.28, -1.78),
        new THREE.Vector3(PATIENT.mouthWorld.x - 0.06, PATIENT.mouthWorld.y + 0.02, PATIENT.mouthWorld.z),
      ]),
      40,
      0.014,
      8,
    ),
    new THREE.MeshStandardMaterial({ map: paintCorrugation(), color: 0xaab4bd, roughness: 0.6 }),
  );
  circuit.visible = false;
  scene.add(circuit);

  ctx.reg.add({
    id: 'vent',
    label: 'Ventilator',
    colliders: [screen, housing, body],
    highlights: [housing],
    getActions: () => [{ id: 'zoom', label: 'View vent', ui: { type: 'openZoom', device: 'vent' } }],
  });

  return () => {
    const connected = deps.getPatient()?.devices.vent.connected ?? false;
    if (circuit.visible !== connected) circuit.visible = connected;
  };
}
