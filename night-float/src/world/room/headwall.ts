/**
 * Headwall behind the bed: panel, gas outlets (O2 / air / vacuum with tiny
 * labels), suction canister, and the dim warm strip light whose glow the
 * shadow spot in lighting.ts represents.
 */
import * as THREE from 'three';
import type { WorldCtx } from '../types';
import { HALF_D, HEADWALL } from '../layout';
import { paintLabel } from '../lib';

const Z = -HALF_D + 0.035; // proud of the back wall

export function buildHeadwall(ctx: WorldCtx): void {
  const { scene } = ctx;
  const cx = (HEADWALL.x0 + HEADWALL.x1) / 2;
  const w = HEADWALL.x1 - HEADWALL.x0;
  const h = HEADWALL.y1 - HEADWALL.y0;

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x3d434e, roughness: 0.6 }),
  );
  panel.position.set(cx, (HEADWALL.y0 + HEADWALL.y1) / 2, Z - 0.01);
  scene.add(panel);

  // warm strip light along the top of the panel (emissive; the actual
  // illumination is the shadow spot in lighting.ts)
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.2, 0.05, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x201a12,
      emissive: 0xffd2a0,
      emissiveIntensity: 1.5,
      roughness: 0.4,
    }),
  );
  strip.position.set(cx, HEADWALL.y1 - 0.06, Z + 0.02);
  scene.add(strip);

  buildGasOutlets(ctx);
  buildSuction(ctx);
}

function buildGasOutlets(ctx: WorldCtx): void {
  const outlets: { x: number; color: number; label: string }[] = [
    { x: 1.06, color: 0x3d9e5f, label: 'O2' },
    { x: 1.32, color: 0xd8c24a, label: 'AIR' },
    { x: 1.58, color: 0xd6d9de, label: 'VAC' },
  ];
  const y = 1.5;
  for (const o of outlets) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.03, 20),
      new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.45 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(o.x, y, Z + 0.03);
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.035, 12),
      new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.3, metalness: 0.6 }),
    );
    core.rotation.x = Math.PI / 2;
    core.position.set(o.x, y, Z + 0.035);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.075, 0.024),
      new THREE.MeshStandardMaterial({
        map: paintLabel(o.label, { w: 96, h: 32, bg: '#23262c', fg: '#cfd5dd' }),
        roughness: 0.8,
      }),
    );
    label.position.set(o.x, y - 0.075, Z + 0.032);
    ctx.scene.add(ring, core, label);
  }
}

function buildSuction(ctx: WorldCtx): void {
  const g = new THREE.Group();
  // canister
  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.2, 14),
    new THREE.MeshStandardMaterial({
      color: 0x9fb2b8,
      roughness: 0.15,
      metalness: 0.05,
      transparent: true,
      opacity: 0.55,
    }),
  );
  jar.position.set(0.42, 1.28, Z + 0.07);
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.03, 14),
    new THREE.MeshStandardMaterial({ color: 0x2e6ea8, roughness: 0.5 }),
  );
  lid.position.set(0.42, 1.39, Z + 0.07);
  // wall gauge + tubing loop
  const gauge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16),
    new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.4 }),
  );
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0.42, 1.62, Z + 0.03);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.42, 1.6, Z + 0.05),
        new THREE.Vector3(0.5, 1.5, Z + 0.09),
        new THREE.Vector3(0.45, 1.41, Z + 0.08),
      ]),
      12,
      0.006,
      6,
    ),
    new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.6 }),
  );
  g.add(jar, lid, gauge, tube);
  ctx.scene.add(g);
}
