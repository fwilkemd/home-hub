/**
 * Ultrasound machine on a rolling cart near the foot of the bed: body,
 * screen, and a probe holster whose probe mesh hides while the probe is
 * held (SPEC §6.1, §8.1).
 */
import * as THREE from 'three';
import type { WorldCtx, Updater } from '../types';
import type { ContextAction } from '../../contracts/runtime';
import { hubStore } from '../../bridge/store';
import { SCREENS, US_CART, screenNormal } from '../layout';
import { mergedBoxes, tubeBetween } from '../lib';

export function buildUltrasound(ctx: WorldCtx): Updater {
  const { scene } = ctx;
  const spec = SCREENS.us_machine;

  const g = new THREE.Group();
  g.position.copy(US_CART.pos);
  g.rotation.y = US_CART.yaw;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5d6470, roughness: 0.5 });
  const body = new THREE.Mesh(
    mergedBoxes([
      { size: [0.5, 0.09, 0.5], pos: [0, 0.09, 0] }, // base
      { size: [0.09, 0.62, 0.09], pos: [0, 0.45, -0.02] }, // column
      { size: [0.44, 0.06, 0.34], pos: [0, 0.78, 0.05] }, // keyboard shelf
      { size: [0.4, 0.3, 0.24], pos: [0, 1.0, -0.02] }, // console
    ]),
    bodyMat,
  );
  body.castShadow = true;
  g.add(body);

  // control panel hint on the shelf
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x2e333c, roughness: 0.65 }),
  );
  panel.rotation.x = -Math.PI / 2 + 0.12;
  panel.position.set(0, 0.815, 0.06);
  g.add(panel);

  for (const [sx, sz] of [
    [-0.19, -0.19],
    [0.19, -0.19],
    [-0.19, 0.19],
    [0.19, 0.19],
  ]) {
    const caster = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.6 }),
    );
    caster.position.set(sx, 0.05, sz);
    g.add(caster);
  }

  // probe holster on the cart's bed-facing flank + the probe itself
  const holster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.028, 0.1, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.6, side: THREE.DoubleSide }),
  );
  holster.position.set(0.25, 0.86, 0.08);
  g.add(holster);
  const probe = buildProbeMesh();
  probe.position.set(0.25, 0.92, 0.08);
  probe.rotation.z = 0.12;
  g.add(probe);
  // coiled cable hint
  const cable = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.006, 6, 16, Math.PI * 1.5),
    new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.6 }),
  );
  cable.position.set(0.25, 0.7, 0.06);
  g.add(cable);
  scene.add(g);

  // screen + housing + support stub (world coords from layout)
  const n = screenNormal(spec);
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w + 0.05, spec.h + 0.05, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x272b33, roughness: 0.5 }),
  );
  housing.position.copy(spec.pos).addScaledVector(n, -0.028);
  housing.rotation.set(spec.pitch, spec.yaw, 0, 'YXZ');
  scene.add(housing);
  scene.add(
    tubeBetween(
      new THREE.Vector3(US_CART.pos.x - 0.01, 1.12, US_CART.pos.z - 0.02),
      spec.pos.clone().addScaledVector(n, -0.05),
      0.018,
      bodyMat,
    ),
  );
  const screen = ctx.screens.createScreen(scene, 'us_machine');

  ctx.reg.add({
    id: 'us_machine',
    label: 'Ultrasound',
    colliders: [screen, housing, body],
    highlights: [housing],
    getActions: (): ContextAction[] => {
      const held = hubStore.getState().heldTool;
      return [
        { id: 'zoom', label: 'View ultrasound', ui: { type: 'openZoom', device: 'us_machine' } },
        held === 'us_probe'
          ? { id: 'probe', label: 'Return probe', ui: { type: 'equipTool', tool: null } }
          : { id: 'probe', label: 'Take probe', ui: { type: 'equipTool', tool: 'us_probe' } },
      ];
    },
  });

  return () => {
    const held = hubStore.getState().heldTool === 'us_probe';
    if (probe.visible === held) probe.visible = !held;
  };
}

/** Rounded-wedge probe silhouette, reused by the held-tool rig. */
export function buildProbeMesh(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.45 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.03, 0.055, 12), mat);
  head.scale.z = 0.55;
  head.position.y = -0.03;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.07, 10), mat);
  grip.scale.z = 0.7;
  grip.position.y = 0.028;
  g.add(head, grip);
  return g;
}
