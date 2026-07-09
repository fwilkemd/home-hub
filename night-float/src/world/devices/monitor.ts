/**
 * Patient monitor on an articulating arm off the headwall, screen facing the
 * room (~55 cm wide at ~1.7 m). Context actions per SPEC §6.4.
 */
import * as THREE from 'three';
import type { WorldCtx } from '../types';
import { SCREENS, screenNormal, HALF_D } from '../layout';
import { tubeBetween } from '../lib';

export function buildMonitor(ctx: WorldCtx): void {
  const { scene } = ctx;
  const spec = SCREENS.monitor;
  const n = screenNormal(spec);

  const metal = new THREE.MeshStandardMaterial({ color: 0x596170, roughness: 0.4, metalness: 0.6 });

  // articulating arm: wall plate -> elbow -> screen back
  const mount = new THREE.Vector3(2.15, 2.0, -HALF_D + 0.03);
  const elbow = new THREE.Vector3(2.02, 1.88, -2.34);
  const back = spec.pos.clone().addScaledVector(n, -0.06);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.04), metal);
  plate.position.copy(mount);
  scene.add(plate);
  scene.add(tubeBetween(mount, elbow, 0.022, metal));
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), metal);
  joint.position.copy(elbow);
  scene.add(joint);
  scene.add(tubeBetween(elbow, back, 0.022, metal));

  // housing behind the screen plane
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(spec.w + 0.05, spec.h + 0.06, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x272b33, roughness: 0.5 }),
  );
  housing.position.copy(spec.pos).addScaledVector(n, -0.032);
  housing.rotation.set(spec.pitch, spec.yaw, 0, 'YXZ');
  housing.castShadow = true;
  scene.add(housing);

  const screen = ctx.screens.createScreen(scene, 'monitor');

  ctx.reg.add({
    id: 'monitor',
    label: 'Patient monitor',
    colliders: [screen, housing],
    highlights: [housing],
    getActions: () => [
      { id: 'zoom', label: 'View monitor', ui: { type: 'openZoom', device: 'monitor' } },
      { id: 'silence', label: 'Silence alarms', command: { type: 'SilenceAllAlarms' } },
      { id: 'nibp', label: 'Cycle NIBP', command: { type: 'CycleNibp' } },
    ],
  });
}
