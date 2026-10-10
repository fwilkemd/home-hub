import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { heightAt, L, distToCreek } from './terrain.js'
import { QUALITY } from '../quality.js'
import { tex, withSway } from './textures.js'

const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s) }
function roughen(geo, amt, freq = 0.6) {
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const n = hash(Math.round(x * freq), Math.round(y * freq), Math.round(z * freq)) - 0.5
    const l = Math.hypot(x, y, z) || 1
    p.setXYZ(i, x + (x / l) * n * amt, y + (y / l) * n * amt, z + (z / l) * n * amt)
  }
  geo.computeVertexNormals()
  return geo
}

let barkMat, leafMat, needleMat
function mats() {
  if (barkMat) return
  barkMat = new THREE.MeshStandardMaterial({ map: tex('bark_diff.jpg', { repeat: 1 }), normalMap: tex('bark_nor.jpg', { srgb: false }), roughness: 0.95, normalScale: new THREE.Vector2(1.2, 1.2) })
  leafMat = withSway(new THREE.MeshStandardMaterial({ map: tex('leaves.png', { wrap: false }), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: '#cfd8c0' }), { strength: 0.09, minY: 2, maxY: 9 })
  needleMat = withSway(new THREE.MeshStandardMaterial({ map: tex('needles.png', { wrap: false }), alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9, color: '#b8c8b0' }), { strength: 0.05, minY: 2, maxY: 10 })
}

// A cloud of leaf cards: each card is a quad facing a random direction.
function cardCloud(points, size, seed = 1) {
  const list = []
  const e = new THREE.Euler(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1)
  points.forEach((p, i) => {
    const g = new THREE.PlaneGeometry(size, size)
    e.set(hash(i, seed, 1) * 6.28, hash(i, seed, 2) * 6.28, hash(i, seed, 3) * 6.28)
    q.setFromEuler(e); m.compose(p, q, s); g.applyMatrix4(m)
    list.push(g)
  })
  return mergeGeometries(list)
}

function pineGeometry() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.42, 9.5, 7); trunk.translate(0, 4.5, 0)
  const pts = []
  for (let layer = 0; layer < 7; layer++) {
    const y = 2.6 + layer * 1.25, r = 2.6 * (1 - layer / 7.5)
    const n = 4 + Math.round(r * 1.6)
    for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + layer * 0.7; pts.push(new THREE.Vector3(Math.cos(a) * r * 0.7, y + hash(layer, k, 9) * 0.6, Math.sin(a) * r * 0.7)) }
  }
  pts.push(new THREE.Vector3(0, 11.2, 0))
  return { trunk, cards: cardCloud(pts, 2.4, 3) }
}
function deciduousGeometry() {
  const trunk = new THREE.CylinderGeometry(0.2, 0.5, 6, 7); trunk.translate(0, 2.8, 0)
  const pts = []
  for (let k = 0; k < 42; k++) {
    const a = hash(k, 1, 1) * 6.28, e = Math.acos(2 * hash(k, 2, 2) - 1), r = 2.2 + hash(k, 3, 3) * 1.6
    pts.push(new THREE.Vector3(Math.cos(a) * Math.sin(e) * r, 7.2 + Math.cos(e) * r * 0.75, Math.sin(a) * Math.sin(e) * r))
  }
  return { trunk, cards: cardCloud(pts, 3.0, 5) }
}

export function buildWoods(scene) {
  mats()
  const spots = []
  const near = (x, z) => Math.hypot(x - L.car.x, z - L.car.z) < 4.5
  for (let k = 0; k < 2200; k++) {
    const x = -420 + Math.random() * 840, z = L.woodEdgeZ + Math.random() * 180
    if (near(x, z)) continue
    if (z < L.woodEdgeZ + 30 && Math.random() < 0.25) continue
    spots.push([x, z, Math.random() < 0.65 ? 'pine' : 'blob'])
  }
  for (let k = 0; k < 900; k++) {
    const x = -500 + Math.random() * 1000, z = -520 + Math.random() * 340
    if (heightAt(x, z) < 6 || distToCreek(x, z) < 8) continue
    spots.push([x, z, 'pine'])
  }
  for (let k = 0; k < 500; k++) {
    const side = Math.random() < 0.5 ? -1 : 1
    const x = side * (240 + Math.random() * 200), z = -200 + Math.random() * 340
    spots.push([x, z, Math.random() < 0.5 ? 'pine' : 'blob'])
  }
  // a few lone trees in the far meadow, never near the oak
  for (let k = 0; k < 18; k++) {
    const x = -200 + Math.random() * 400, z = -220 + Math.random() * 300
    if (Math.hypot(x - L.oak.x, z - L.oak.z) < 90 || Math.hypot(x - L.pond.x, z - L.pond.z) < 60 || distToCreek(x, z) < 10) continue
    spots.push([x, z, 'blob'])
  }
  const kept = spots.filter(() => Math.random() < QUALITY.woodDensity)
  const pines = kept.filter((s) => s[2] === 'pine'), blobs = kept.filter((s) => s[2] === 'blob')
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
  const place = (geo, mat, list, scaleBase, name) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length)
    list.forEach(([x, z, , sc, rot], i) => {
      p.set(x, heightAt(x, z) - 0.2, z); q.setFromAxisAngle(up, rot); s.set(sc, sc * (0.9 + hash(i, 1, 7) * 0.3), sc)
      m.compose(p, q, s); im.setMatrixAt(i, m)
    })
    im.castShadow = true; im.receiveShadow = true; im.name = name
    scene.add(im)
    return im
  }
  for (const list of [pines, blobs]) list.forEach((sp, i) => { sp[3] = 0.7 + hash(i, 5, 5) * 0.8; sp[4] = hash(i, 6, 6) * 6.28 })
  const pg = pineGeometry(), dg = deciduousGeometry()
  place(pg.trunk, barkMat, pines, 1, 'trunks'); place(pg.cards, needleMat, pines, 1, 'cards')
  place(dg.trunk, barkMat, blobs, 1.3, 'trunks'); place(dg.cards, leafMat, blobs, 1.3, 'cards')
}

export function buildOak(scene) {
  mats()
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(roughen(new THREE.CylinderGeometry(1.0, 2.2, 7.5, 14, 8), 0.3, 1.2), barkMat)
  trunk.position.y = 3.6; trunk.castShadow = true; trunk.receiveShadow = true
  g.add(trunk)
  const pts = []
  const branchCount = 7
  for (let i = 0; i < branchCount; i++) {
    const az = (i / branchCount) * Math.PI * 2 + hash(i, 1, 2) * 0.8
    const tilt = 0.75 + hash(i, 3, 4) * 0.5
    const len = 7 + hash(i, 5, 6) * 4
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.6, len, 7, 3), barkMat)
    b.geometry.translate(0, len / 2, 0); roughen(b.geometry, 0.2, 0.9)
    b.position.set(Math.cos(az) * 0.8, 5.2 + hash(i, 7, 8) * 1.8, Math.sin(az) * 0.8)
    b.rotation.set(0, -az, -tilt)
    b.rotateOnAxis(new THREE.Vector3(1, 0, 0), (hash(i, 9, 9) - 0.5) * 0.6)
    b.castShadow = true
    g.add(b)
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.24, len * 0.7, 6, 2), barkMat)
    b2.geometry.translate(0, len * 0.35, 0)
    b2.position.set(0, len * 0.95, 0)
    b2.rotation.set((hash(i, 2, 2) - 0.5) * 1.2, 0, (hash(i, 4, 4) - 0.2) * 0.9)
    b2.castShadow = true
    b.add(b2)
    // leaf cards clustered around the branch ends
    const end = new THREE.Vector3(0, len * 0.9, 0).applyEuler(b.rotation).add(b.position)
    const r = 4.2 + hash(i, 6, 1) * 2
    for (let k = 0; k < 52; k++) {
      const a = hash(k, i, 11) * 6.28, e = Math.acos(2 * hash(k, i, 12) - 1), rr = r * Math.cbrt(hash(k, i, 13))
      pts.push(new THREE.Vector3(end.x + Math.cos(a) * Math.sin(e) * rr, end.y + 1.5 + Math.cos(e) * rr * 0.7, end.z + Math.sin(a) * Math.sin(e) * rr))
    }
  }
  for (let k = 0; k < 90; k++) {
    const a = hash(k, 20, 1) * 6.28, e = Math.acos(2 * hash(k, 20, 2) - 1), rr = 6.5 * Math.cbrt(hash(k, 20, 3))
    pts.push(new THREE.Vector3(Math.cos(a) * Math.sin(e) * rr, 15.5 + Math.cos(e) * rr * 0.7, Math.sin(a) * Math.sin(e) * rr))
  }
  const canopy = new THREE.Mesh(cardCloud(pts, 3.6, 21), leafMat)
  canopy.castShadow = true; canopy.receiveShadow = true; canopy.name = 'cards'
  g.add(canopy)
  g.position.copy(L.oak); g.position.y = heightAt(L.oak.x, L.oak.z) - 0.3
  scene.add(g)
  return g
}

export function buildMountains(scene) {
  const rock = new THREE.MeshStandardMaterial({ map: tex('rock_diff.jpg', { repeat: 14 }), normalMap: tex('rock_nor.jpg', { srgb: false, repeat: 14 }), roughness: 1, color: '#9aa0b4' })
  const hill = new THREE.MeshStandardMaterial({ map: tex('grass_diff.jpg', { repeat: 40 }), roughness: 1, color: '#8fa078' })
  const g = new THREE.Group()
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + hash(i, 0, 0) * 0.2
    const r = 820 + hash(i, 1, 1) * 260
    const h = 220 + hash(i, 2, 2) * 260, w = 260 + hash(i, 3, 3) * 220
    const cone = new THREE.Mesh(roughen(new THREE.ConeGeometry(w, h, 11, 6), 26, 0.02), rock)
    cone.position.set(Math.cos(a) * r, h / 2 - 60, Math.sin(a) * r)
    g.add(cone)
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + hash(i, 4, 4) * 0.3
    const r = 470 + hash(i, 5, 5) * 160
    const h = 50 + hash(i, 6, 6) * 90, w = 150 + hash(i, 7, 7) * 140
    const cone = new THREE.Mesh(roughen(new THREE.ConeGeometry(w, h, 9, 4), 10, 0.03), hill)
    cone.position.set(Math.cos(a) * r, h / 2 - 18, Math.sin(a) * r)
    g.add(cone)
  }
  scene.add(g)
  return g
}

export function buildBramble(scene) {
  mats()
  const twig = new THREE.MeshStandardMaterial({ map: tex('bark_diff.jpg'), roughness: 1, color: '#8a7a68' })
  const cards = withSway(new THREE.MeshStandardMaterial({ map: tex('leaves.png', { wrap: false }), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, color: '#8a8a60' }), { strength: 0.03, minY: 0, maxY: 2 })
  const stick = new THREE.CylinderGeometry(0.025, 0.05, 2.4, 4)
  const card = new THREE.PlaneGeometry(1.4, 1.4)
  const n = 1400
  const leaves = new THREE.InstancedMesh(card, cards, n), sticks = new THREE.InstancedMesh(stick, twig, n)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler()
  const box = { x0: -104, x1: -52, z0: 16, z1: 32 }
  for (let i = 0; i < n; i++) {
    const x = box.x0 + Math.random() * (box.x1 - box.x0), z = box.z0 + Math.random() * (box.z1 - box.z0)
    const h = heightAt(x, z)
    const sc = 0.7 + Math.random() * 1.1
    p.set(x, h + 0.3 + Math.random() * 1.6, z); q.setFromEuler(e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)); s.set(sc, sc, sc)
    m.compose(p, q, s); leaves.setMatrixAt(i, m)
    p.set(x + (Math.random() - 0.5) * 1.5, h + 0.9, z + (Math.random() - 0.5) * 1.5)
    q.setFromEuler(e.set((Math.random() - 0.5) * 1.8, Math.random() * 6, (Math.random() - 0.5) * 1.8)); s.set(1, 1 + Math.random(), 1)
    m.compose(p, q, s); sticks.setMatrixAt(i, m)
  }
  leaves.castShadow = true; sticks.castShadow = true; leaves.name = 'cards'
  scene.add(leaves, sticks)
  return { box, inside: (x, z) => x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1 }
}
