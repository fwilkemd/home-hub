/**
 * Room shell: floor, walls (wainscot rail + two-tone), ceiling with one
 * dimmed light panel, closed door with porthole, night-city window with
 * blinds, and the privacy curtain. Static geometry is merged per material.
 */
import * as THREE from 'three';
import type { WorldCtx } from '../types';
import { CURTAIN, DOOR, HALF_D, HALF_W, ROOM, WINDOW, CEILING_PANEL } from '../layout';
import {
  mergedBoxes,
  paintCeiling,
  paintCityNight,
  paintCurtain,
  paintFloor,
  paintWallNoise,
  type BoxSpec,
} from '../lib';

const T = 0.06; // wall thickness
const RAIL_Y = 0.98;

export function buildStructure(ctx: WorldCtx): void {
  const { scene } = ctx;

  // ---- floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    new THREE.MeshStandardMaterial({ map: paintFloor(), roughness: 0.3, metalness: 0.08 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- ceiling
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
    new THREE.MeshStandardMaterial({ map: paintCeiling(), roughness: 0.9 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.height;
  scene.add(ceiling);

  // one dimmed light panel (SPEC §6.1)
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(CEILING_PANEL.w, CEILING_PANEL.l),
    new THREE.MeshStandardMaterial({
      color: 0x11141c,
      emissive: 0x39435e,
      emissiveIntensity: 0.55,
      roughness: 0.6,
    }),
  );
  panel.rotation.x = Math.PI / 2;
  panel.position.copy(CEILING_PANEL.pos);
  scene.add(panel);

  buildWalls(ctx);
  buildDoor(ctx);
  buildWindow(ctx);
  buildCurtain(ctx);
}

function buildWalls(ctx: WorldCtx): void {
  const doorL = DOOR.centerX - DOOR.width / 2; // -2.59
  const doorR = DOOR.centerX + DOOR.width / 2; // -1.61
  const winL = WINDOW.centerZ - WINDOW.width / 2; // -2.25
  const winR = WINDOW.centerZ + WINDOW.width / 2; // -0.35
  const winTop = WINDOW.sillY + WINDOW.height; // 2.10

  const lower: BoxSpec[] = [
    { size: [ROOM.width + 2 * T, 0.95, T], pos: [0, 0.475, -HALF_D - T / 2] },
    { size: [T, 0.95, ROOM.depth], pos: [HALF_W + T / 2, 0.475, 0] },
    { size: [T, 0.95, ROOM.depth], pos: [-HALF_W - T / 2, 0.475, 0] },
    { size: [doorL + HALF_W + T, 0.95, T], pos: [(doorL - HALF_W - T) / 2, 0.475, HALF_D + T / 2] },
    { size: [HALF_W + T - doorR, 0.95, T], pos: [(doorR + HALF_W + T) / 2, 0.475, HALF_D + T / 2] },
  ];
  const upper: BoxSpec[] = [
    { size: [ROOM.width + 2 * T, ROOM.height - 0.95, T], pos: [0, (ROOM.height + 0.95) / 2, -HALF_D - T / 2] },
    { size: [T, ROOM.height - 0.95, ROOM.depth], pos: [HALF_W + T / 2, (ROOM.height + 0.95) / 2, 0] },
    // left wall around the window opening
    { size: [T, winTop - 0.95, winL + HALF_D], pos: [-HALF_W - T / 2, (winTop + 0.95) / 2, (winL - HALF_D) / 2] },
    { size: [T, winTop - 0.95, HALF_D - winR], pos: [-HALF_W - T / 2, (winTop + 0.95) / 2, (winR + HALF_D) / 2] },
    { size: [T, ROOM.height - winTop, ROOM.depth], pos: [-HALF_W - T / 2, (ROOM.height + winTop) / 2, 0] },
    // front wall around the door opening
    { size: [doorL + HALF_W + T, ROOM.height - 0.95, T], pos: [(doorL - HALF_W - T) / 2, (ROOM.height + 0.95) / 2, HALF_D + T / 2] },
    { size: [HALF_W + T - doorR, ROOM.height - 0.95, T], pos: [(doorR + HALF_W + T) / 2, (ROOM.height + 0.95) / 2, HALF_D + T / 2] },
    { size: [DOOR.width, ROOM.height - DOOR.height, T], pos: [DOOR.centerX, (ROOM.height + DOOR.height) / 2, HALF_D + T / 2] },
  ];

  const noise = paintWallNoise(3);
  const lowerMesh = new THREE.Mesh(
    mergedBoxes(lower),
    new THREE.MeshStandardMaterial({ color: 0x4d5560, map: noise, roughness: 0.85 }),
  );
  const upperMesh = new THREE.Mesh(
    mergedBoxes(upper),
    new THREE.MeshStandardMaterial({ color: 0x5b636f, map: noise, roughness: 0.9 }),
  );
  ctx.scene.add(lowerMesh, upperMesh);

  // wainscot bumper rail + baseboard (merged strips, skipping door/window)
  const railSpecs: BoxSpec[] = [
    { size: [ROOM.width, 0.12, 0.05], pos: [0, RAIL_Y, -HALF_D + 0.025] },
    { size: [0.05, 0.12, ROOM.depth], pos: [HALF_W - 0.025, RAIL_Y, 0] },
    { size: [0.05, 0.12, ROOM.depth], pos: [-HALF_W + 0.025, RAIL_Y, 0] },
    { size: [doorL + HALF_W, 0.12, 0.05], pos: [(doorL - HALF_W) / 2, RAIL_Y, HALF_D - 0.025] },
    { size: [HALF_W - doorR, 0.12, 0.05], pos: [(doorR + HALF_W) / 2, RAIL_Y, HALF_D - 0.025] },
  ];
  const rail = new THREE.Mesh(
    mergedBoxes(railSpecs),
    new THREE.MeshStandardMaterial({ color: 0x757d8a, roughness: 0.55 }),
  );
  const baseSpecs: BoxSpec[] = [
    { size: [ROOM.width, 0.12, 0.03], pos: [0, 0.06, -HALF_D + 0.015] },
    { size: [0.03, 0.12, ROOM.depth], pos: [HALF_W - 0.015, 0.06, 0] },
    { size: [0.03, 0.12, ROOM.depth], pos: [-HALF_W + 0.015, 0.06, 0] },
    { size: [doorL + HALF_W, 0.12, 0.03], pos: [(doorL - HALF_W) / 2, 0.06, HALF_D - 0.015] },
    { size: [HALF_W - doorR, 0.12, 0.03], pos: [(doorR + HALF_W) / 2, 0.06, HALF_D - 0.015] },
  ];
  const base = new THREE.Mesh(
    mergedBoxes(baseSpecs),
    new THREE.MeshStandardMaterial({ color: 0x2f343c, roughness: 0.8 }),
  );
  ctx.scene.add(rail, base);
}

function buildDoor(ctx: WorldCtx): void {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR.width - 0.04, DOOR.height - 0.03, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x5c5248, roughness: 0.7 }),
  );
  slab.position.set(DOOR.centerX, (DOOR.height - 0.03) / 2, HALF_D - 0.02);
  // small porthole window
  const port = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.52),
    new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.2, metalness: 0.4, emissive: 0x0e1622, emissiveIntensity: 0.5 }),
  );
  port.position.set(DOOR.centerX + 0.12, 1.55, HALF_D - 0.045);
  port.rotation.y = Math.PI;
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8),
    new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.3, metalness: 0.8 }),
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(DOOR.centerX - 0.36, 1.02, HALF_D - 0.06);
  const kick = new THREE.Mesh(
    new THREE.BoxGeometry(DOOR.width - 0.06, 0.24, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x6d747e, roughness: 0.35, metalness: 0.7 }),
  );
  kick.position.set(DOOR.centerX, 0.13, HALF_D - 0.048);
  g.add(slab, port, handle, kick);
  ctx.scene.add(g);
}

function buildWindow(ctx: WorldCtx): void {
  const { scene } = ctx;
  const x = -HALF_W + 0.005;
  const cy = WINDOW.sillY + WINDOW.height / 2;

  const city = new THREE.Mesh(
    new THREE.PlaneGeometry(WINDOW.width, WINDOW.height),
    new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveMap: paintCityNight(),
      emissiveIntensity: 0.5,
      roughness: 1,
    }),
  );
  city.rotation.y = Math.PI / 2;
  city.position.set(x - 0.02, cy, WINDOW.centerZ);
  scene.add(city);

  // frame
  const fw = 0.05;
  const frame = new THREE.Mesh(
    mergedBoxes([
      { size: [0.06, fw, WINDOW.width + 2 * fw], pos: [x, WINDOW.sillY - fw / 2, WINDOW.centerZ] },
      { size: [0.06, fw, WINDOW.width + 2 * fw], pos: [x, WINDOW.sillY + WINDOW.height + fw / 2, WINDOW.centerZ] },
      { size: [0.06, WINDOW.height, fw], pos: [x, cy, WINDOW.centerZ - WINDOW.width / 2 - fw / 2] },
      { size: [0.06, WINDOW.height, fw], pos: [x, cy, WINDOW.centerZ + WINDOW.width / 2 + fw / 2] },
      // sill ledge
      { size: [0.14, 0.03, WINDOW.width + 0.16], pos: [x + 0.05, WINDOW.sillY - 0.015, WINDOW.centerZ] },
    ]),
    new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.6 }),
  );
  scene.add(frame);

  // blinds partially down over the upper ~55% (thin merged slats)
  const slats: BoxSpec[] = [];
  const top = WINDOW.sillY + WINDOW.height - 0.05;
  for (let i = 0; i < 11; i++) {
    slats.push({ size: [0.05, 0.018, WINDOW.width - 0.06], pos: [x + 0.07, top - i * 0.058, WINDOW.centerZ] });
  }
  slats.push({ size: [0.06, 0.04, WINDOW.width - 0.04], pos: [x + 0.07, top - 10 * 0.058 - 0.04, WINDOW.centerZ] });
  const blinds = new THREE.Mesh(
    mergedBoxes(slats),
    new THREE.MeshStandardMaterial({ color: 0x646c78, roughness: 0.75 }),
  );
  scene.add(blinds);
}

function buildCurtain(ctx: WorldCtx): void {
  const { scene } = ctx;
  const w = CURTAIN.x1 - CURTAIN.x0;
  const h = CURTAIN.topY - CURTAIN.botY;
  const geo = new THREE.PlaneGeometry(w, h, 28, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, Math.sin((pos.getX(i) / w) * Math.PI * 16) * 0.035);
  }
  geo.computeVertexNormals();
  const curtain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: paintCurtain(),
      roughness: 0.95,
      side: THREE.DoubleSide,
    }),
  );
  curtain.position.set((CURTAIN.x0 + CURTAIN.x1) / 2, (CURTAIN.topY + CURTAIN.botY) / 2, CURTAIN.z);
  scene.add(curtain);

  // ceiling track extends past the drawn portion
  const track = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.03, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.5 }),
  );
  track.position.set(CURTAIN.x0 + 1.2, CURTAIN.topY + 0.02, CURTAIN.z);
  scene.add(track);

  const hem = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.025, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x8b95a0, roughness: 0.8 }),
  );
  hem.position.set((CURTAIN.x0 + CURTAIN.x1) / 2, CURTAIN.topY - 0.01, CURTAIN.z);
  scene.add(hem);
}
