/**
 * Held-tool rig (SPEC §6.4): a simple mesh at the bottom-right of the
 * camera representing hubStore.heldTool, with a slow idle sway.
 */
import * as THREE from 'three';
import type { ToolId } from '../../contracts/ids';
import type { WorldCtx, Updater } from '../types';
import { hubStore } from '../../bridge/store';
import { buildProbeMesh } from '../devices/ultrasound';

export function createHeldTool(ctx: WorldCtx): Updater {
  const anchor = new THREE.Group();
  anchor.position.set(0.3, -0.27, -0.55);
  anchor.rotation.set(0.25, -0.5, 0.1);
  ctx.camera.add(anchor);

  const tools = new Map<ToolId, THREE.Object3D>();

  // stethoscope: tube arc + chest piece
  {
    const g = new THREE.Group();
    const tube = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.5 });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.007, 6, 22, Math.PI * 1.5), tube);
    arc.rotation.x = 0.6;
    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.03, 0.014, 14),
      new THREE.MeshStandardMaterial({ color: 0xb2bac4, metalness: 0.85, roughness: 0.25 }),
    );
    bell.position.set(0.075, -0.05, 0.03);
    g.add(arc, bell);
    tools.set('stethoscope', g);
  }
  // ultrasound probe (same silhouette as the holstered one)
  {
    const g = buildProbeMesh();
    g.rotation.x = -0.9;
    g.scale.setScalar(1.25);
    tools.set('us_probe', g);
  }
  // laryngoscope: L-shape, metallic
  {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x9ba3ad, metalness: 0.85, roughness: 0.3 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 10), metal);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.1), metal);
    blade.position.set(0, 0.06, -0.045);
    blade.rotation.x = -0.15;
    g.add(handle, blade);
    tools.set('laryngoscope', g);
  }
  // kits: small tray with a colored stripe per kit
  const kitStripe: Partial<Record<ToolId, number>> = {
    cvl_kit: 0x3e6ea8,
    aline_kit: 0xc84a4a,
    ett_kit: 0x3e8e5a,
  };
  for (const [tool, stripeColor] of Object.entries(kitStripe) as [ToolId, number][]) {
    const g = new THREE.Group();
    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.03, 0.11),
      new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.5 }),
    );
    const wrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.008, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xbcc7d4, roughness: 0.85 }),
    );
    wrap.position.y = 0.019;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.002, 0.028),
      new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.7 }),
    );
    stripe.position.y = 0.024;
    g.add(tray, wrap, stripe);
    g.rotation.z = 0.15;
    tools.set(tool, g);
  }

  for (const t of tools.values()) {
    t.visible = false;
    anchor.add(t);
  }

  let shown: ToolId | null = null;
  return () => {
    const held = hubStore.getState().heldTool;
    if (held !== shown) {
      if (shown) tools.get(shown)!.visible = false;
      if (held && tools.has(held)) tools.get(held)!.visible = true;
      shown = held && tools.has(held) ? held : null;
    }
    anchor.position.y = -0.27 + Math.sin(ctx.clock.t * 1.7) * 0.006;
    anchor.rotation.z = 0.1 + Math.sin(ctx.clock.t * 1.3) * 0.012;
  };
}
