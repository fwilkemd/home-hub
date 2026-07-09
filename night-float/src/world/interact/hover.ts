/**
 * Center-screen raycast each frame (max 2.4 m, SPEC §6.4): resolves the
 * hovered interactable, publishes HoverInfo via deps.onHover, and pulses a
 * gentle highlight (emissive on solid meshes, soft additive glow on the
 * invisible patient zones).
 */
import * as THREE from 'three';
import type { ContextAction } from '../../contracts/runtime';
import type { WorldCtx, Updater } from '../types';
import type { Interactable } from './interactables';

const CENTER = new THREE.Vector2(0, 0);
const HILITE = 0x86b8e8;

interface SavedEmissive {
  mat: THREE.MeshStandardMaterial;
  hex: number;
  intensity: number;
}

export interface HoverSystem {
  update: Updater;
  /** restore + report null (used when pointer unlocks / world disposes) */
  clear(): void;
  /** fresh action at hotkey index, from the currently hovered target */
  actionAt(index: number): ContextAction | null;
}

export function createHover(ctx: WorldCtx): HoverSystem {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 2.4;

  let current: Interactable | null = null;
  let lastSig = '';
  let saved: SavedEmissive[] = [];
  let glows: THREE.Mesh[] = [];

  const applyHighlight = (item: Interactable): void => {
    for (const mesh of item.highlights) {
      if (mesh.userData.nfGlow) {
        mesh.visible = true;
        glows.push(mesh);
      } else {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          saved.push({ mat, hex: mat.emissive.getHex(), intensity: mat.emissiveIntensity });
          mat.emissive.setHex(HILITE);
        }
      }
    }
  };

  const restoreHighlight = (): void => {
    for (const s of saved) {
      s.mat.emissive.setHex(s.hex);
      s.mat.emissiveIntensity = s.intensity;
    }
    saved = [];
    for (const g of glows) g.visible = false;
    glows = [];
  };

  const publish = (item: Interactable | null, actions: ContextAction[]): void => {
    // null-first so same-target action changes survive the store's
    // targetId+label dedupe in hubActions.setHover
    ctx.deps.onHover(null);
    if (item) ctx.deps.onHover({ targetId: item.id, label: item.label, actions });
  };

  const update: Updater = () => {
    ctx.camera.updateMatrixWorld();
    raycaster.setFromCamera(CENTER, ctx.camera);
    const hits = raycaster.intersectObjects(ctx.reg.colliders, false);
    const item = hits.length > 0 ? (ctx.reg.resolve(hits[0].object) ?? null) : null;
    const actions = item ? item.getActions() : [];
    const sig = item ? `${item.id}|${actions.map((a) => `${a.id}:${a.label}`).join(',')}` : '';

    if (sig !== lastSig) {
      lastSig = sig;
      if (item !== current) {
        restoreHighlight();
        current = item;
        if (item) applyHighlight(item);
      }
      publish(item, actions);
    }

    // gentle pulse
    const pulse = 0.22 + 0.1 * Math.sin(ctx.clock.t * 4.5);
    for (const s of saved) s.mat.emissiveIntensity = pulse;
    const gPulse = 0.055 + 0.03 * Math.sin(ctx.clock.t * 4.5);
    for (const g of glows) {
      (g.material as THREE.MeshBasicMaterial).opacity = gPulse;
    }
  };

  const clear = (): void => {
    if (!current && lastSig === '') return;
    restoreHighlight();
    current = null;
    lastSig = '';
    ctx.deps.onHover(null);
  };

  const actionAt = (index: number): ContextAction | null => {
    if (!current) return null;
    const actions = current.getActions();
    return actions[index] ?? null;
  };

  return { update, clear, actionAt };
}
