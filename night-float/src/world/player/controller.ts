/**
 * First-person controller (SPEC §6.3): pointer-lock look + WASD at walking
 * speed, simple AABB push-out collision, plus the ?debugcam free-fly mode
 * (drag-to-look, no pointer lock) used by tests and screenshots.
 *
 * Key ownership: ONLY WASD + E/F/C/V while pointer-locked (E/F/C/V fire
 * hover actions 0..3). Tab/Q/Esc/digits belong to the UI layer.
 */
import * as THREE from 'three';
import type { ViewpointId } from '../../contracts/ids';
import type { WorldCtx } from '../types';
import { hubActions, hubStore } from '../../bridge/store';
import { HALF_D, HALF_W, OBSTACLES, PLAYER, getViewpoint } from '../layout';
import { clamp } from '../lib';

const LOOK_SPEED = 0.0023;
const DRAG_SPEED = 0.005;
const PITCH_LIMIT = 1.45;
const FLY_SPEED = 2.6;

export interface PlayerController {
  bind(canvas: HTMLCanvasElement): void;
  update(dt: number): void;
  teleport(v: ViewpointId): void;
  setDebugCam(on: boolean): void;
  requestPointerLock(): void;
  exitPointerLock(): void;
  isLocked(): boolean;
  dispose(): void;
}

export function createPlayer(ctx: WorldCtx, onActionKey: (index: number) => void): PlayerController {
  const { camera, deps } = ctx;
  const pos = new THREE.Vector3(-1.9, PLAYER.eyeY, 1.85);
  let yaw = -0.7;
  let pitch = -0.06;
  let locked = false;
  let debugOn = false;
  let dragging = false;
  let bobPhase = 0;
  let bob = 0;
  let canvas: HTMLElement & { requestPointerLock?: () => unknown } = null as never;
  const pressed = new Set<string>();

  const applyCamera = (): void => {
    camera.position.set(pos.x, pos.y + bob, pos.z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  };
  applyCamera();

  // ------------------------------------------------------------ listeners
  const setLocked = (v: boolean): void => {
    if (locked === v) return;
    locked = v;
    deps.onPointerLock(v);
    hubActions.setPointerLocked(v);
  };

  const onLockChange = (): void => {
    setLocked(!!canvas && document.pointerLockElement === canvas);
  };
  const onLockError = (): void => setLocked(false);

  const canLock = (): boolean => {
    if (debugOn) return false;
    const s = hubStore.getState();
    return (
      !s.workstationOpen &&
      !s.zoomDevice &&
      !s.radialOpen &&
      !s.settingsOpen &&
      s.phase === 'running' &&
      !s.debugCam
    );
  };

  const onClick = (): void => {
    if (!locked && canLock()) requestPointerLock();
  };

  const onMouseMove = (e: MouseEvent): void => {
    if (locked && !debugOn) {
      yaw -= e.movementX * LOOK_SPEED;
      pitch = clamp(pitch - e.movementY * LOOK_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
    } else if (debugOn && dragging) {
      yaw -= e.movementX * DRAG_SPEED;
      pitch = clamp(pitch - e.movementY * DRAG_SPEED, -PITCH_LIMIT, PITCH_LIMIT);
    }
  };
  const onMouseDown = (e: MouseEvent): void => {
    if (debugOn && e.button === 0) dragging = true;
  };
  const onMouseUp = (): void => {
    dragging = false;
  };

  const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF']);
  const onKeyDown = (e: KeyboardEvent): void => {
    if (MOVE_CODES.has(e.code)) pressed.add(e.code);
    if (locked && !debugOn) {
      if (e.code === 'KeyE') onActionKey(0);
      else if (e.code === 'KeyF') onActionKey(1);
      else if (e.code === 'KeyC') onActionKey(2);
      else if (e.code === 'KeyV') onActionKey(3);
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    pressed.delete(e.code);
  };
  const onBlur = (): void => {
    pressed.clear();
    dragging = false;
  };

  function bind(el: HTMLCanvasElement): void {
    canvas = el;
    el.addEventListener('click', onClick);
    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
  }

  function requestPointerLock(): void {
    if (!canvas || typeof canvas.requestPointerLock !== 'function') return;
    try {
      const r = canvas.requestPointerLock();
      if (r instanceof Promise) r.catch(() => setLocked(false));
    } catch {
      setLocked(false);
    }
  }
  function exitPointerLock(): void {
    if (typeof document === 'undefined' || typeof document.exitPointerLock !== 'function') return;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ------------------------------------------------------------ movement
  const collide = (p: THREE.Vector3): void => {
    p.x = clamp(p.x, -(HALF_W - PLAYER.margin), HALF_W - PLAYER.margin);
    p.z = clamp(p.z, -(HALF_D - PLAYER.margin), HALF_D - PLAYER.margin);
    for (const b of OBSTACLES) {
      const minX = b.minX - PLAYER.radius;
      const maxX = b.maxX + PLAYER.radius;
      const minZ = b.minZ - PLAYER.radius;
      const maxZ = b.maxZ + PLAYER.radius;
      if (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ) {
        const dxl = p.x - minX;
        const dxr = maxX - p.x;
        const dzl = p.z - minZ;
        const dzr = maxZ - p.z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) p.x = minX;
        else if (m === dxr) p.x = maxX;
        else if (m === dzl) p.z = minZ;
        else p.z = maxZ;
      }
    }
  };

  const walk = (dt: number): void => {
    let mx = 0;
    let mz = 0;
    if (pressed.has('KeyW')) mz += 1;
    if (pressed.has('KeyS')) mz -= 1;
    if (pressed.has('KeyA')) mx -= 1;
    if (pressed.has('KeyD')) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const inv = 1 / Math.hypot(mx, mz);
      mx *= inv;
      mz *= inv;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      // camera forward at yaw is (-sin, 0, -cos); right is (cos, 0, -sin)
      const dx = (-sin * mz + cos * mx) * PLAYER.speed * dt;
      const dz = (-cos * mz - sin * mx) * PLAYER.speed * dt;
      pos.x += dx;
      pos.z += dz;
      collide(pos);
      bobPhase += dt * 8.5;
      bob = Math.sin(bobPhase) * 0.014;
    } else {
      bob *= Math.max(0, 1 - dt * 8);
    }
    pos.y = PLAYER.eyeY;
  };

  const fly = (dt: number): void => {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const v = new THREE.Vector3();
    if (pressed.has('KeyW')) v.add(dir);
    if (pressed.has('KeyS')) v.addScaledVector(dir, -1);
    if (pressed.has('KeyD')) v.add(right);
    if (pressed.has('KeyA')) v.addScaledVector(right, -1);
    if (pressed.has('KeyR')) v.y += 1;
    if (pressed.has('KeyF')) v.y -= 1;
    if (v.lengthSq() > 0) pos.addScaledVector(v.normalize(), FLY_SPEED * dt);
    bob = 0;
  };

  function update(dt: number): void {
    if (debugOn) fly(dt);
    else if (locked) walk(dt);
    else bob *= Math.max(0, 1 - dt * 8);
    applyCamera();
  }

  function teleport(v: ViewpointId): void {
    const vp = getViewpoint(v);
    pos.copy(vp.pos);
    const dir = vp.look.clone().sub(vp.pos);
    const len = dir.length() || 1;
    yaw = Math.atan2(-dir.x, -dir.z);
    pitch = clamp(Math.asin(dir.y / len), -PITCH_LIMIT, PITCH_LIMIT);
    if (!debugOn) {
      pos.y = PLAYER.eyeY;
      collide(pos);
    }
    bob = 0;
    applyCamera();
  }

  function setDebugCam(on: boolean): void {
    if (debugOn === on) return;
    debugOn = on;
    dragging = false;
    if (on) {
      exitPointerLock();
    } else {
      pos.y = PLAYER.eyeY;
      collide(pos);
    }
    applyCamera();
  }

  function dispose(): void {
    if (canvas) {
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousedown', onMouseDown);
    }
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('pointerlockchange', onLockChange);
    document.removeEventListener('pointerlockerror', onLockError);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    exitPointerLock();
  }

  return {
    bind,
    update,
    teleport,
    setDebugCam,
    requestPointerLock,
    exitPointerLock,
    isLocked: () => locked,
    dispose,
  };
}
