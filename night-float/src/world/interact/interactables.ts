/**
 * Interactable registry — every hoverable thing in the room registers here.
 * Colliders may be invisible meshes (three's Raycaster does not cull by
 * `visible`, verified against r185 source). Highlight meshes MUST own their
 * material instance; the hover system mutates emissive/opacity on them.
 */
import type * as THREE from 'three';
import type { ContextAction } from '../../contracts/runtime';

export interface Interactable {
  id: string;
  label: string;
  /** raycast targets; userData.nfInteractId is stamped by add() */
  colliders: THREE.Object3D[];
  /**
   * meshes pulsed while hovered. userData.nfGlow === true → opacity pulse
   * (invisible zone boxes); otherwise emissive pulse on a dedicated material.
   */
  highlights: THREE.Mesh[];
  /** rebuilt every frame while hovered (actions depend on held tool etc.) */
  getActions: () => ContextAction[];
}

export class InteractableRegistry {
  private items = new Map<string, Interactable>();
  private colliderList: THREE.Object3D[] = [];

  add(item: Interactable): void {
    this.items.set(item.id, item);
    for (const c of item.colliders) {
      c.userData.nfInteractId = item.id;
      this.colliderList.push(c);
    }
  }

  get colliders(): THREE.Object3D[] {
    return this.colliderList;
  }

  byId(id: string): Interactable | undefined {
    return this.items.get(id);
  }

  /** Resolve a raycast hit back to its interactable. */
  resolve(obj: THREE.Object3D): Interactable | undefined {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      const id = cur.userData.nfInteractId as string | undefined;
      if (id) return this.items.get(id);
      cur = cur.parent;
    }
    return undefined;
  }

  clear(): void {
    this.items.clear();
    this.colliderList.length = 0;
  }
}
