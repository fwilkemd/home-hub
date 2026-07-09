/**
 * Single source of truth for the room layout (meters, y-up, floor at y=0).
 * Origin = room center on the floor. Back wall (headwall) at z=-DEPTH/2.
 * Everything — builders, collision, nurse stations, viewpoints, audio
 * placements — reads these constants so the world stays self-consistent.
 */
import * as THREE from 'three';
import type { DeviceId, NurseStation, ViewpointId } from '../contracts/ids';

export const ROOM = { width: 6.4, depth: 5.2, height: 3.0 } as const;
export const HALF_W = ROOM.width / 2; // 3.2
export const HALF_D = ROOM.depth / 2; // 2.6

// ---------------------------------------------------------------- bed & patient
export const BED = {
  center: new THREE.Vector3(0.85, 0, -1.35),
  width: 1.02,
  length: 2.15,
  deckY: 0.62,
  mattressTopY: 0.78,
  headZ: -2.42, // head end (against headwall)
};
/** Hip pivot of the patient; upper body inclines from here toward -z. */
export const PATIENT = {
  hip: new THREE.Vector3(0.85, 0.8, -1.42),
  inclineRad: 0.436, // ~25 deg head-up
  /** where the lips land after the incline — ETT + vent circuit meet here */
  mouthWorld: new THREE.Vector3(0.85, 1.22, -1.95),
};

// ---------------------------------------------------------------- screens
export interface ScreenSpec {
  pos: THREE.Vector3;
  /** yaw about Y then pitch about X applied to a +z-normal plane */
  yaw: number;
  pitch: number;
  w: number;
  h: number;
}
export const SCREENS: Record<DeviceId, ScreenSpec> = {
  monitor: { pos: new THREE.Vector3(1.83, 1.72, -2.14), yaw: -0.24, pitch: -0.06, w: 0.55, h: 0.34 },
  vent: { pos: new THREE.Vector3(-0.6, 1.26, -1.84), yaw: 0.42, pitch: -0.2, w: 0.4, h: 0.28 },
  pump: { pos: new THREE.Vector3(1.72, 1.28, -1.345), yaw: -0.15, pitch: -0.08, w: 0.19, h: 0.12 },
  us_machine: { pos: new THREE.Vector3(1.71, 1.34, 0.66), yaw: -2.6, pitch: -0.18, w: 0.34, h: 0.24 },
  workstation: { pos: new THREE.Vector3(-2.82, 1.24, 0.5), yaw: Math.PI / 2, pitch: -0.05, w: 0.5, h: 0.31 },
};

/** Outward normal of a screen (direction a viewer stands in). */
export function screenNormal(s: ScreenSpec): THREE.Vector3 {
  const e = new THREE.Euler(s.pitch, s.yaw, 0, 'YXZ');
  return new THREE.Vector3(0, 0, 1).applyEuler(e).normalize();
}
export function orientScreen(obj: THREE.Object3D, s: ScreenSpec): void {
  obj.position.copy(s.pos);
  obj.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
}

// ---------------------------------------------------------------- furniture anchors
export const VENT_CART = { pos: new THREE.Vector3(-0.62, 0, -2.02), yaw: 0.42 };
export const IV_POLE = { pos: new THREE.Vector3(1.72, 0, -1.55) };
export const US_CART = { pos: new THREE.Vector3(1.82, 0, 0.82), yaw: -2.6 };
export const CODE_CART = { pos: new THREE.Vector3(2.84, 0, 0.35), yaw: -Math.PI / 2 };
export const SUPPLY_CART = { pos: new THREE.Vector3(2.84, 0, 1.58), yaw: -Math.PI / 2 };
export const DESK = { pos: new THREE.Vector3(-2.92, 0, 0.5), yaw: Math.PI / 2 };
export const SINK = { pos: new THREE.Vector3(-0.85, 0, 2.38) };
export const DOOR = { centerX: -2.1, width: 0.98, height: 2.08 };
export const WINDOW = { centerZ: -1.3, width: 1.9, sillY: 0.95, height: 1.15 };
export const CURTAIN = { z: 1.95, x0: -2.56, x1: -1.15, topY: 2.62, botY: 0.4 };
export const HEADWALL = { x0: 0.05, x1: 1.95, y0: 0.85, y1: 2.2 };
export const NIGHT_LIGHT = new THREE.Vector3(-1.55, 0.2, 2.42);
export const CEILING_PANEL = { pos: new THREE.Vector3(-0.9, ROOM.height - 0.015, 0.3), w: 0.62, l: 1.22 };

// ---------------------------------------------------------------- collision
export interface Aabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
/** Static obstacles the player is pushed out of (SPEC §6.3 simple collision). */
export const OBSTACLES: readonly Aabb[] = [
  { minX: 0.3, maxX: 1.4, minZ: -2.48, maxZ: -0.25 }, // bed
  { minX: -1.0, maxX: -0.2, minZ: -2.48, maxZ: -1.62 }, // vent cart
  { minX: 1.5, maxX: 1.95, minZ: -1.8, maxZ: -1.28 }, // IV pole + pumps
  { minX: 1.42, maxX: 2.25, minZ: 0.42, maxZ: 1.2 }, // US cart
  { minX: 2.4, maxX: 3.2, minZ: -0.05, maxZ: 0.75 }, // code cart
  { minX: 2.4, maxX: 3.2, minZ: 1.15, maxZ: 2.0 }, // supply cart
  { minX: -3.2, maxX: -2.55, minZ: -0.15, maxZ: 1.15 }, // desk
  { minX: -1.28, maxX: -0.42, minZ: 2.1, maxZ: 2.6 }, // sink
];
export const PLAYER = { eyeY: 1.68, radius: 0.32, speed: 1.6, margin: 0.35 };

// ---------------------------------------------------------------- nurse stations
export const NURSE_STATIONS: Record<NurseStation, { pos: THREE.Vector3; yaw: number }> = {
  station: { pos: new THREE.Vector3(-2.3, 0, 1.62), yaw: 2.2 },
  supply: { pos: new THREE.Vector3(2.28, 0, 1.58), yaw: Math.PI / 2 },
  pump: { pos: new THREE.Vector3(2.2, 0, -1.5), yaw: -Math.PI / 2 },
  bedside_left: { pos: new THREE.Vector3(-0.05, 0, -1.4), yaw: Math.PI / 2 },
  bedside_right: { pos: new THREE.Vector3(1.86, 0, -0.82), yaw: -2.3 },
  workstation: { pos: new THREE.Vector3(-2.4, 0, 0.5), yaw: -Math.PI / 2 },
  door: { pos: new THREE.Vector3(-2.1, 0, 2.14), yaw: 0 },
};

// ---------------------------------------------------------------- viewpoints
export interface Viewpoint {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}
function screenViewpoint(device: DeviceId, dist: number): Viewpoint {
  const s = SCREENS[device];
  const n = screenNormal(s);
  return { pos: s.pos.clone().addScaledVector(n, dist), look: s.pos.clone() };
}
/** Tuned so ?debugcam screenshots read instantly (SPEC §6.3, §15). */
export function getViewpoint(v: ViewpointId): Viewpoint {
  switch (v) {
    case 'bedside':
      return { pos: new THREE.Vector3(-0.32, 1.62, -0.95), look: new THREE.Vector3(0.88, 1.05, -1.92) };
    case 'monitor':
      return screenViewpoint('monitor', 0.48);
    case 'vent':
      return screenViewpoint('vent', 0.5);
    case 'ultrasound':
      return screenViewpoint('us_machine', 0.45);
    case 'wide':
      // front-right corner, clear of the curtain: bed + headwall + monitor
      // glow + window all in frame
      return { pos: new THREE.Vector3(2.35, 2.0, 2.42), look: new THREE.Vector3(-0.85, 0.85, -1.45) };
  }
}
