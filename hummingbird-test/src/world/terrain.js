import * as THREE from 'three'
import { QUALITY } from '../quality.js'

// ---- World layout (metres). -Z is "north", the way the car faces into the meadow. ----
export const L = {
  car: new THREE.Vector3(0, 0, 140),          // nosed into the wood edge, facing north (-Z)
  woodEdgeZ: 146,                              // z beyond which the wood begins
  oak: new THREE.Vector3(30, 0, 20),
  oakRest: new THREE.Vector3(27, 0, 27),
  pond: new THREE.Vector3(-75, 0, 50),
  pondR: 22,
  pondRest: new THREE.Vector3(-64, 0, 70),     // near-side bank (south)
  bramble: new THREE.Vector3(-78, 0, 24),      // far (north) side of the pond
  brambleExit: new THREE.Vector3(-80, 0, 2),
  creekEnd: new THREE.Vector3(-84, 0, -40),    // "water's moonstruck"
  weed: new THREE.Vector3(12, 0, 62),          // butterfly weed, where Jay spins
  golf: new THREE.Vector3(58, 0, 42),
  riparian: new THREE.Vector3(-86, 0, -18),
}

// Jay's zig-zag trail from the car to the pond and on to the oak.
export const TRAIL = [
  new THREE.Vector3(2, 0, 134), new THREE.Vector3(-12, 0, 122), new THREE.Vector3(-4, 0, 108),
  new THREE.Vector3(-22, 0, 96), new THREE.Vector3(-30, 0, 100), new THREE.Vector3(-44, 0, 86),
  new THREE.Vector3(-40, 0, 76), new THREE.Vector3(-62, 0, 72), new THREE.Vector3(-50, 0, 66),
  new THREE.Vector3(-30, 0, 70), new THREE.Vector3(-10, 0, 66), new THREE.Vector3(6, 0, 64),
  new THREE.Vector3(12, 0, 62),
]

// Creek polyline, flowing from the hills down into the pond.
export const CREEK = [
  new THREE.Vector3(-130, 0, -260), new THREE.Vector3(-104, 0, -190), new THREE.Vector3(-96, 0, -130),
  new THREE.Vector3(-84, 0, -70), new THREE.Vector3(-86, 0, -30), new THREE.Vector3(-80, 0, -4),
  new THREE.Vector3(-78, 0, 18), new THREE.Vector3(-75, 0, 36),
]

function distToPolyline(x, z, pts) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const abx = b.x - a.x, abz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)))
    const dx = x - (a.x + abx * t), dz = z - (a.z + abz * t)
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d < best) best = d
  }
  return best
}
export const distToTrail = (x, z) => distToPolyline(x, z, TRAIL)
export const distToCreek = (x, z) => distToPolyline(x, z, CREEK)

const smooth = (t) => t * t * (3 - 2 * t)
const clamp01 = (v) => Math.max(0, Math.min(1, v))

// Rolling base ground, no water features.
function base(x, z) {
  let h = 0.9 * Math.sin(x * 0.021 + 0.4) * Math.cos(z * 0.027)
  h += 0.5 * Math.sin(x * 0.053 + 1.3) * Math.sin(z * 0.041 + 0.7)
  h += 0.25 * Math.sin(x * 0.11) * Math.cos(z * 0.13 + 2)
  // hill country rising to the north and east, then mountains
  const n = clamp01((-z - 160) / 260)
  h += smooth(n) * 38 + n * n * 30
  const e = clamp01((x - 200) / 260)
  h += smooth(e) * 30
  const w = clamp01((-x - 240) / 260)
  h += smooth(w) * 26
  return h
}

export const POND_WATER_Y = base(L.pond.x, L.pond.z) - 1.1

export function heightAt(x, z) {
  let h = base(x, z)
  // pond bowl
  const dp = Math.hypot(x - L.pond.x, z - L.pond.z)
  if (dp < L.pondR + 14) {
    const t = clamp01(1 - (dp - 2) / (L.pondR + 12))
    h -= smooth(t) * 3.4
  }
  // creek channel
  const dc = distToCreek(x, z)
  if (dc < 7) h -= smooth(clamp01(1 - dc / 7)) * 1.6
  return h
}

export const CREEK_WATER_Y_OFFSET = -0.9 // water sits this far below base along the channel

export function groundNormal(x, z) {
  const e = 0.6
  const hx = heightAt(x + e, z) - heightAt(x - e, z)
  const hz = heightAt(x, z + e) - heightAt(x, z - e)
  return new THREE.Vector3(-hx, 2 * e, -hz).normalize()
}

export function buildTerrain() {
  const size = 1400, seg = QUALITY.terrainSegments
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const cGrass = new THREE.Color('#6a8a38'), cDry = new THREE.Color('#8a8a4a'), cClay = new THREE.Color('#9b7d58')
  const cSand = new THREE.Color('#c9b78a'), cWood = new THREE.Color('#2f3a22'), cRock = new THREE.Color('#6e6a66')
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const h = heightAt(x, z)
    pos.setY(i, h)
    c.copy(cGrass)
    const dp = Math.hypot(x - L.pond.x, z - L.pond.z)
    if (dp < L.pondR + 10) {
      const t = clamp01((L.pondR + 10 - dp) / 10)
      c.lerp(cClay, smooth(t))
      if (dp < L.pondR + 3) c.lerp(cSand, clamp01((L.pondR + 3 - dp) / 3))
    }
    const dc = distToCreek(x, z)
    if (dc < 6) c.lerp(cSand, smooth(clamp01(1 - dc / 6)) * 0.8)
    if (z > L.woodEdgeZ - 6) c.lerp(cWood, clamp01((z - L.woodEdgeZ + 6) / 8))
    if (h > 30) c.lerp(cRock, clamp01((h - 30) / 30))
    const v = 0.9 + 0.2 * Math.sin(x * 0.37) * Math.cos(z * 0.41)
    c.lerp(cDry, 0.12 + 0.1 * Math.sin(x * 0.05) * Math.cos(z * 0.07))
    colors[i * 3] = c.r * v; colors[i * 3 + 1] = c.g * v; colors[i * 3 + 2] = c.b * v
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.name = 'terrain'
  return mesh
}
