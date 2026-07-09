/**
 * Freestanding room furniture: code cart, supply cart (interactable kit
 * drawers + stethoscope), sink corner (towel, sharps bin), and the computer
 * workstation that opens the EMR.
 */
import * as THREE from 'three';
import type { WorldCtx, Updater } from '../types';
import type { ContextAction } from '../../contracts/runtime';
import type { ToolId } from '../../contracts/ids';
import { hubStore } from '../../bridge/store';
import { CODE_CART, DESK, HALF_D, SINK, SUPPLY_CART } from '../layout';
import {
  canvasTexture,
  makeCanvas,
  mergedBoxes,
  paintCodeCartFront,
  paintKeyboard,
  paintWorkstationScreen,
} from '../lib';

export function buildFurniture(ctx: WorldCtx): Updater {
  buildCodeCart(ctx);
  const supplyUpdate = buildSupplyCart(ctx);
  buildSinkCorner(ctx);
  buildWorkstation(ctx);
  return supplyUpdate;
}

// ---------------------------------------------------------------- code cart
function buildCodeCart(ctx: WorldCtx): void {
  const g = new THREE.Group();
  g.position.copy(CODE_CART.pos);
  g.rotation.y = CODE_CART.yaw;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.92, 0.48),
    new THREE.MeshStandardMaterial({ color: 0x7c1f2a, roughness: 0.5 }),
  );
  body.position.y = 0.55;
  body.castShadow = true;

  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.86),
    new THREE.MeshStandardMaterial({ map: paintCodeCartFront(), roughness: 0.55 }),
  );
  front.position.set(0, 0.55, 0.245);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.03, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.4 }),
  );
  top.position.y = 1.025;
  // defib block on top
  const defib = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.18, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x2a4239, roughness: 0.55 }),
  );
  defib.position.set(-0.12, 1.13, 0);
  const handleBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x9aa1ab, metalness: 0.8, roughness: 0.3 }),
  );
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0, 0.98, -0.27);
  g.add(body, front, top, defib, handleBar);
  addCasters(g, 0.3, 0.19);
  ctx.scene.add(g);

  ctx.reg.add({
    id: 'code_cart',
    label: 'Code cart',
    colliders: [body],
    highlights: [front],
    getActions: () => [{ id: 'open', label: 'Open drawer', ui: { type: 'openDrawer', drawerId: 'code_cart' } }],
  });
}

// ---------------------------------------------------------------- supply cart
function drawerFrontTexture(text: string): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 96);
  if (ctx) {
    ctx.fillStyle = '#59606b';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = 'rgba(18,20,26,0.9)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 92);
    ctx.fillStyle = '#e9edf2';
    ctx.fillRect(58, 14, 140, 26);
    ctx.fillStyle = '#242830';
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), 128, 28);
    ctx.fillStyle = 'rgba(20,22,28,0.95)';
    ctx.fillRect(78, 62, 100, 10); // handle
  }
  return canvasTexture(canvas);
}

interface DrawerDef {
  label: string;
  text: string;
  tool: ToolId | null;
  take: string;
}
const DRAWERS: DrawerDef[] = [
  { label: 'CVC kit drawer', text: 'CVC KIT', tool: 'cvl_kit', take: 'Take central line kit' },
  { label: 'Arterial line drawer', text: 'ART LINE', tool: 'aline_kit', take: 'Take arterial line kit' },
  { label: 'Airway drawer', text: 'AIRWAY', tool: 'ett_kit', take: 'Take airway kit' },
  { label: 'Ultrasound gel drawer', text: 'US GEL', tool: null, take: 'Take gel' },
];

function buildSupplyCart(ctx: WorldCtx): Updater {
  const g = new THREE.Group();
  g.position.copy(SUPPLY_CART.pos);
  g.rotation.y = SUPPLY_CART.yaw;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 1.02, 0.52),
    new THREE.MeshStandardMaterial({ color: 0x646b76, roughness: 0.55 }),
  );
  body.position.y = 0.6;
  body.castShadow = true;
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.03, 0.54),
    new THREE.MeshStandardMaterial({ color: 0x393e46, roughness: 0.4 }),
  );
  top.position.y = 1.125;
  g.add(body, top);
  addCasters(g, 0.3, 0.21);

  DRAWERS.forEach((d, i) => {
    const front = new THREE.Mesh(
      new THREE.PlaneGeometry(0.64, 0.19),
      new THREE.MeshStandardMaterial({ map: drawerFrontTexture(d.text), roughness: 0.6 }),
    );
    front.position.set(0, 0.965 - i * 0.225, 0.262);
    g.add(front);
    ctx.reg.add({
      id: `supply_drawer_${i}`,
      label: d.label,
      colliders: [front],
      highlights: [front],
      getActions: (): ContextAction[] => {
        if (!d.tool) return [{ id: 'gel', label: d.take, ui: { type: 'openDrawer', drawerId: 'us_gel' } }];
        const held = hubStore.getState().heldTool;
        return held === d.tool
          ? [{ id: 'return', label: 'Put kit back', ui: { type: 'equipTool', tool: null } }]
          : [{ id: 'take', label: d.take, ui: { type: 'equipTool', tool: d.tool } }];
      },
    });
  });

  // stethoscope resting on the cart top (hidden while held)
  const steth = new THREE.Group();
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.5 });
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 20, Math.PI * 1.6), tubeMat);
  loop.rotation.x = -Math.PI / 2;
  const bell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.028, 0.012, 14),
    new THREE.MeshStandardMaterial({ color: 0xaeb6c0, metalness: 0.85, roughness: 0.25 }),
  );
  bell.position.set(0.07, 0.006, 0.02);
  steth.add(loop, bell);
  steth.position.set(0.12, 1.15, 0.05);
  g.add(steth);
  ctx.reg.add({
    id: 'stethoscope_prop',
    label: 'Stethoscope',
    colliders: [loop, bell],
    highlights: [bell],
    getActions: () =>
      hubStore.getState().heldTool === 'stethoscope'
        ? [{ id: 'return', label: 'Put back stethoscope', ui: { type: 'equipTool', tool: null } }]
        : [{ id: 'take', label: 'Take stethoscope', ui: { type: 'equipTool', tool: 'stethoscope' } }],
  });

  ctx.scene.add(g);
  return () => {
    steth.visible = hubStore.getState().heldTool !== 'stethoscope';
  };
}

// ---------------------------------------------------------------- sink corner
function buildSinkCorner(ctx: WorldCtx): void {
  const { scene } = ctx;
  const counter = new THREE.Mesh(
    mergedBoxes([
      { size: [0.82, 0.85, 0.48], pos: [SINK.pos.x, 0.425, HALF_D - 0.26] },
      { size: [0.86, 0.04, 0.52], pos: [SINK.pos.x, 0.87, HALF_D - 0.27] },
    ]),
    new THREE.MeshStandardMaterial({ color: 0x5a5f68, roughness: 0.5 }),
  );
  scene.add(counter);
  // basin inset
  const basin = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.02, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.25, metalness: 0.6 }),
  );
  basin.position.set(SINK.pos.x, 0.885, HALF_D - 0.27);
  scene.add(basin);
  // gooseneck faucet
  const faucet = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(SINK.pos.x, 0.89, HALF_D - 0.1),
        new THREE.Vector3(SINK.pos.x, 1.14, HALF_D - 0.12),
        new THREE.Vector3(SINK.pos.x, 1.16, HALF_D - 0.24),
        new THREE.Vector3(SINK.pos.x, 1.1, HALF_D - 0.28),
      ]),
      16,
      0.012,
      8,
    ),
    new THREE.MeshStandardMaterial({ color: 0xa9b0ba, metalness: 0.9, roughness: 0.25 }),
  );
  scene.add(faucet);

  // paper towel dispenser above the sink
  const towel = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.34, 0.11),
    new THREE.MeshStandardMaterial({ color: 0x767d87, roughness: 0.5 }),
  );
  towel.position.set(SINK.pos.x - 0.05, 1.42, HALF_D - 0.09);
  const towelSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.07),
    new THREE.MeshStandardMaterial({ color: 0xd9d6cd, roughness: 1, side: THREE.DoubleSide }),
  );
  towelSheet.position.set(SINK.pos.x - 0.05, 1.22, HALF_D - 0.1);
  towelSheet.rotation.x = -0.25;
  scene.add(towel, towelSheet);

  // sharps bin — red wall box with a dark slot
  const sharps = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.3, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xa8232e, roughness: 0.5 }),
  );
  sharps.position.set(-0.15, 1.25, HALF_D - 0.11);
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.035, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.8 }),
  );
  slot.position.set(-0.15, 1.38, HALF_D - 0.195);
  scene.add(sharps, slot);
}

// ---------------------------------------------------------------- workstation
function buildWorkstation(ctx: WorldCtx): void {
  const g = new THREE.Group();
  g.position.copy(DESK.pos);
  g.rotation.y = DESK.yaw; // front faces +x into the room

  const deskMat = new THREE.MeshStandardMaterial({ color: 0x555b64, roughness: 0.55 });
  const desk = new THREE.Mesh(
    mergedBoxes([
      { size: [1.15, 0.04, 0.55], pos: [0, 0.74, 0.12] }, // top
      { size: [1.05, 0.06, 0.4], pos: [0, 0.2, 0.08] }, // base shelf
      { size: [0.05, 0.72, 0.45], pos: [-0.52, 0.38, 0.1] },
      { size: [0.05, 0.72, 0.45], pos: [0.52, 0.38, 0.1] },
    ]),
    deskMat,
  );
  desk.castShadow = true;
  g.add(desk);

  // monitor bezel + stand behind the (world-positioned) screen plane
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.37, 0.045),
    new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.45 }),
  );
  bezel.position.set(0, 1.24, 0.075); // just behind the screen plane (+z local = +x world)
  const stand = new THREE.Mesh(
    mergedBoxes([
      { size: [0.05, 0.32, 0.05], pos: [0, 0.92, 0.06] },
      { size: [0.26, 0.02, 0.18], pos: [0, 0.77, 0.07] },
    ]),
    deskMat,
  );
  const keyboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.018, 0.15),
    new THREE.MeshStandardMaterial({ map: paintKeyboard(), roughness: 0.6 }),
  );
  keyboard.position.set(0, 0.77, 0.2);
  keyboard.rotation.y = -0.06;
  const stool = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.19, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.7 }),
  );
  stool.position.set(0.1, 0.62, 0.72);
  const stoolPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.16, 0.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.5, metalness: 0.4 }),
  );
  stoolPost.position.set(0.1, 0.3, 0.72);
  g.add(bezel, stand, keyboard, stool, stoolPost);
  ctx.scene.add(g);

  // screen plane positioned from layout (idle chart glow; EMR is an overlay)
  const screen = ctx.screens.createScreen(ctx.scene, 'workstation', {
    staticTexture: paintWorkstationScreen(),
  });

  ctx.reg.add({
    id: 'workstation',
    label: 'Workstation',
    colliders: [screen, bezel, keyboard],
    highlights: [bezel],
    getActions: () => [{ id: 'chart', label: 'Open chart', ui: { type: 'openWorkstation' } }],
  });
}

function addCasters(g: THREE.Group, dx: number, dz: number): void {
  const geo = new THREE.SphereGeometry(0.035, 8, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.6 });
  for (const [sx, sz] of [
    [-dx, -dz],
    [dx, -dz],
    [-dx, dz],
    [dx, dz],
  ]) {
    const c = new THREE.Mesh(geo, mat);
    c.position.set(sx, 0.045, sz);
    g.add(c);
  }
}
