import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Low-poly ICU bay. All static geometry is merged into one mesh per material
 * color to stay well under the Quest 2 draw-call budget. Only Lambert/Basic
 * materials, no shadows.
 *
 * Layout (meters, +y up): room 5.2 × 5.2, bed head against the north wall
 * (-z), monitor on the wall above the bed head.
 */

export const ROOM = { width: 5.2, depth: 5.2, height: 2.7 }
export const MONITOR_POS = new THREE.Vector3(0, 1.9, -ROOM.depth / 2 + 0.06)
export const CLOCK_POS = new THREE.Vector3(-ROOM.width / 2 + 0.05, 2.0, 0.6)
/** Bed reference coords other modules hang things on (exam colliders, panels). */
export const BED = { x: 0, headZ: -ROOM.depth / 2 + 0.35, centerZ: -ROOM.depth / 2 + 0.35 + 1.05 }
export const TABLET_POS = new THREE.Vector3(1.15, 1.05, BED.centerZ + 0.45)

const PALETTE = {
  floor: 0x36414a,
  wall: 0x8fa3ad,
  ceiling: 0xb6c2c9,
  trim: 0x5a6b75,
  bedFrame: 0x707a82,
  mattress: 0xe8e4dc,
  blanket: 0x4a8a96,
  pillow: 0xf2efe8,
  skin: 0xd9b08c,
  equipment: 0x3d4b56,
  equipmentLight: 0x6f8291,
  screenOff: 0x0a0e12,
  door: 0x62727c,
  clockFace: 0xf2efe8,
}

export function buildRoom(scene: THREE.Scene): { monitorScreen: THREE.Mesh; tabletScreen: THREE.Mesh } {
  const buckets = new Map<number, THREE.BufferGeometry[]>()

  const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, ry = 0) => {
    if (ry) geo.rotateY(ry)
    geo.translate(x, y, z)
    let list = buckets.get(color)
    if (!list) buckets.set(color, (list = []))
    list.push(geo)
  }
  const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, ry = 0) =>
    add(new THREE.BoxGeometry(w, h, d), color, x, y, z, ry)

  const { width: RW, depth: RD, height: RH } = ROOM

  // Shell
  box(RW, 0.1, RD, PALETTE.floor, 0, -0.05, 0)
  box(RW, 0.1, RD, PALETTE.ceiling, 0, RH + 0.05, 0)
  box(RW, RH, 0.1, PALETTE.wall, 0, RH / 2, -RD / 2 - 0.05) // north (bed head)
  box(RW, RH, 0.1, PALETTE.wall, 0, RH / 2, RD / 2 + 0.05) // south
  box(0.1, RH, RD, PALETTE.wall, -RW / 2 - 0.05, RH / 2, 0) // west
  box(0.1, RH, RD, PALETTE.wall, RW / 2 + 0.05, RH / 2, 0) // east
  // Wainscot trim strip around the walls
  box(RW - 0.02, 0.12, 0.04, PALETTE.trim, 0, 0.9, -RD / 2 + 0.02)
  box(0.04, 0.12, RD - 0.02, PALETTE.trim, -RW / 2 + 0.02, 0.9, 0)
  box(0.04, 0.12, RD - 0.02, PALETTE.trim, RW / 2 - 0.02, 0.9, 0)

  // Door on the south wall, east side
  box(0.95, 2.1, 0.06, PALETTE.door, 1.6, 1.05, RD / 2 - 0.02)
  box(0.05, 0.05, 0.16, PALETTE.equipmentLight, 1.22, 1.05, RD / 2 - 0.1)

  // Bed (head against north wall), centered on x = 0
  const bedX = 0
  const bedHeadZ = -RD / 2 + 0.35
  const bedCenterZ = bedHeadZ + 1.05
  box(0.95, 0.28, 2.1, PALETTE.bedFrame, bedX, 0.36, bedCenterZ)
  box(0.12, 0.5, 0.12, PALETTE.bedFrame, bedX - 0.4, 0.25, bedHeadZ + 0.1)
  box(0.12, 0.5, 0.12, PALETTE.bedFrame, bedX + 0.4, 0.25, bedHeadZ + 0.1)
  box(0.12, 0.5, 0.12, PALETTE.bedFrame, bedX - 0.4, 0.25, bedCenterZ + 0.95)
  box(0.12, 0.5, 0.12, PALETTE.bedFrame, bedX + 0.4, 0.25, bedCenterZ + 0.95)
  box(1.0, 0.18, 2.15, PALETTE.mattress, bedX, 0.59, bedCenterZ)
  // Headboard + footboard
  box(1.0, 0.45, 0.06, PALETTE.equipmentLight, bedX, 0.75, bedHeadZ - 0.05)
  box(1.0, 0.35, 0.06, PALETTE.equipmentLight, bedX, 0.7, bedCenterZ + 1.05)
  // Side rails
  box(0.05, 0.18, 1.2, PALETTE.equipmentLight, bedX - 0.5, 0.82, bedCenterZ - 0.2)
  box(0.05, 0.18, 1.2, PALETTE.equipmentLight, bedX + 0.5, 0.82, bedCenterZ - 0.2)

  // Patient: head + torso/legs raised under a blanket
  box(0.24, 0.2, 0.26, PALETTE.skin, bedX, 0.78, bedHeadZ + 0.3)
  box(0.5, 0.12, 0.35, PALETTE.pillow, bedX, 0.7, bedHeadZ + 0.28)
  box(0.62, 0.22, 0.85, PALETTE.blanket, bedX, 0.77, bedHeadZ + 0.95)
  box(0.5, 0.16, 0.85, PALETTE.blanket, bedX, 0.74, bedHeadZ + 1.75)

  // Wall-mounted monitor above the bed head (screen mesh added separately)
  box(1.16, 0.62, 0.1, PALETTE.equipment, MONITOR_POS.x, MONITOR_POS.y, MONITOR_POS.z)
  box(0.08, 0.08, 0.12, PALETTE.equipment, MONITOR_POS.x, MONITOR_POS.y - 0.38, MONITOR_POS.z)

  // IV pole with pump block, right (east) of the bed head
  add(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 8), PALETTE.equipmentLight, 0.85, 0.95, bedHeadZ + 0.25)
  add(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 10), PALETTE.equipment, 0.85, 0.03, bedHeadZ + 0.25)
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6).rotateZ(Math.PI / 2), PALETTE.equipmentLight, 0.85, 1.9, bedHeadZ + 0.25)
  box(0.26, 0.34, 0.18, PALETTE.equipment, 0.85, 1.25, bedHeadZ + 0.25)
  box(0.2, 0.08, 0.02, PALETTE.screenOff, 0.85, 1.33, bedHeadZ + 0.35)
  // Hanging bag
  box(0.12, 0.2, 0.05, PALETTE.mattress, 0.7, 1.72, bedHeadZ + 0.25)

  // Ventilator placeholder box on a cart, left (west) of the bed head
  box(0.5, 0.55, 0.45, PALETTE.equipment, -0.95, 0.85, bedHeadZ + 0.3)
  box(0.42, 0.2, 0.02, PALETTE.screenOff, -0.95, 0.98, bedHeadZ + 0.54)
  box(0.45, 0.5, 0.4, PALETTE.equipmentLight, -0.95, 0.29, bedHeadZ + 0.3)

  // Bedside tablet (the future order panel) on a stand, east of the bed
  add(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), PALETTE.equipmentLight, 1.15, 0.5, bedCenterZ + 0.45)
  add(new THREE.CylinderGeometry(0.16, 0.2, 0.04, 10), PALETTE.equipment, 1.15, 0.02, bedCenterZ + 0.45)
  const tablet = new THREE.BoxGeometry(0.34, 0.24, 0.02)
  tablet.rotateX(-0.5)
  add(tablet, PALETTE.equipment, 1.15, 1.05, bedCenterZ + 0.45, -0.6)

  // Wall clock face on the west wall (sim-time text is a troika Text added in main)
  const clockFace = new THREE.CylinderGeometry(0.16, 0.16, 0.03, 24)
  clockFace.rotateZ(Math.PI / 2)
  add(clockFace, PALETTE.clockFace, CLOCK_POS.x, CLOCK_POS.y, CLOCK_POS.z)

  // Merge each color bucket into a single mesh
  for (const [color, geos] of buckets) {
    const merged = mergeGeometries(geos, false)
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color }))
    scene.add(mesh)
  }

  // Monitor screen: the app's one dynamic texture goes here (MeshBasicMaterial
  // so it reads self-lit).
  const monitorScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 0.54),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  )
  monitorScreen.position.set(MONITOR_POS.x, MONITOR_POS.y, MONITOR_POS.z + 0.055)
  scene.add(monitorScreen)

  // Tablet screen stays its own mesh — it's the tap target that opens the
  // order panel and it highlights on hover.
  const tabletScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.2, 0.006),
    new THREE.MeshBasicMaterial({ color: 0x10222b }),
  )
  tabletScreen.name = 'tablet'
  tabletScreen.rotation.set(-0.5, -0.6, 0, 'YXZ')
  tabletScreen.position.set(TABLET_POS.x, TABLET_POS.y + 0.006, TABLET_POS.z + 0.012)
  scene.add(tabletScreen)

  // Lighting: hemisphere + one directional, no shadows
  scene.add(new THREE.HemisphereLight(0xdce8ef, 0x2c343a, 1.05))
  const sun = new THREE.DirectionalLight(0xfff4e0, 0.9)
  sun.position.set(2, 2.4, 1.5)
  scene.add(sun)

  scene.background = new THREE.Color(0x0b0e11)

  return { monitorScreen, tabletScreen }
}
