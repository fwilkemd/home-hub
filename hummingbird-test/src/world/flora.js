import * as THREE from 'three'
import { heightAt, L, distToCreek } from './terrain.js'
import { QUALITY } from '../quality.js'

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

export function buildOak(scene) {
  const g = new THREE.Group()
  const bark = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 1, flatShading: true })
  const trunk = new THREE.Mesh(roughen(new THREE.CylinderGeometry(1.0, 2.1, 7.5, 12, 6), 0.35, 1.2), bark)
  trunk.position.y = 3.6; trunk.castShadow = true; trunk.receiveShadow = true
  g.add(trunk)
  const leaf = new THREE.MeshStandardMaterial({ color: '#3f6b24', roughness: 0.95, flatShading: true })
  const leafB = new THREE.MeshStandardMaterial({ color: '#557f2b', roughness: 0.95, flatShading: true })
  const branchCount = 7
  for (let i = 0; i < branchCount; i++) {
    const az = (i / branchCount) * Math.PI * 2 + hash(i, 1, 2) * 0.8
    const tilt = 0.75 + hash(i, 3, 4) * 0.5
    const len = 7 + hash(i, 5, 6) * 4
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.6, len, 7, 3), bark)
    b.geometry.translate(0, len / 2, 0)
    roughen(b.geometry, 0.25, 0.9)
    b.position.set(Math.cos(az) * 0.8, 5.2 + hash(i, 7, 8) * 1.8, Math.sin(az) * 0.8)
    b.rotation.set(0, -az, -tilt)
    b.rotateOnAxis(new THREE.Vector3(1, 0, 0), (hash(i, 9, 9) - 0.5) * 0.6)
    b.castShadow = true
    g.add(b)
    // witchy gnarl: a second, crooked segment
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.24, len * 0.7, 6, 2), bark)
    b2.geometry.translate(0, len * 0.35, 0)
    b2.position.set(0, len * 0.95, 0)
    b2.rotation.set((hash(i, 2, 2) - 0.5) * 1.2, 0, (hash(i, 4, 4) - 0.2) * 0.9)
    b2.castShadow = true
    b.add(b2)
    // leaf cluster at the end of each branch
    const end = new THREE.Vector3(0, len * 0.9, 0).applyEuler(b.rotation).add(b.position)
    const cl = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(4.2 + hash(i, 6, 1) * 2, 2), 0.9, 0.5), i % 2 ? leaf : leafB)
    cl.position.copy(end).add(new THREE.Vector3(0, 1.5, 0))
    cl.scale.y = 0.72
    cl.castShadow = true
    g.add(cl)
  }
  const crown = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(6.5, 2), 1.1, 0.5), leaf)
  crown.position.set(0, 15.5, 0); crown.scale.y = 0.7; crown.castShadow = true
  g.add(crown)
  g.position.copy(L.oak); g.position.y = heightAt(L.oak.x, L.oak.z) - 0.3
  scene.add(g)
  return g
}

export function buildWoods(scene) {
  const pineMat = new THREE.MeshStandardMaterial({ color: '#223b22', roughness: 1, flatShading: true })
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#3b2d22', roughness: 1 })
  const leafMat = new THREE.MeshStandardMaterial({ color: '#2f5120', roughness: 1, flatShading: true })
  const pine = new THREE.ConeGeometry(2.4, 11, 7); pine.translate(0, 8.5, 0)
  const trunk = new THREE.CylinderGeometry(0.25, 0.4, 4, 6); trunk.translate(0, 2, 0)
  const blob = roughen(new THREE.IcosahedronGeometry(3.4, 1), 0.7, 0.6); blob.translate(0, 7.5, 0)
  const spots = []
  const near = (x, z) => Math.hypot(x - L.car.x, z - L.car.z) < 4.5
  // the wood, south of the meadow
  for (let k = 0; k < 2200; k++) {
    const x = -420 + Math.random() * 840, z = L.woodEdgeZ + Math.random() * 180
    if (near(x, z)) continue
    if (z < L.woodEdgeZ + 30 && Math.random() < 0.25) continue
    spots.push([x, z, Math.random() < 0.65 ? 'pine' : 'blob'])
  }
  // dark scatter on the hills north, thinning toward the mountains
  for (let k = 0; k < 900; k++) {
    const x = -500 + Math.random() * 1000, z = -520 + Math.random() * 340
    if (heightAt(x, z) < 6 || distToCreek(x, z) < 8) continue
    spots.push([x, z, 'pine'])
  }
  // sparse treeline east and west
  for (let k = 0; k < 500; k++) {
    const side = Math.random() < 0.5 ? -1 : 1
    const x = side * (240 + Math.random() * 200), z = -200 + Math.random() * 340
    spots.push([x, z, Math.random() < 0.5 ? 'pine' : 'blob'])
  }
  const kept = spots.filter(() => Math.random() < QUALITY.woodDensity)
  const pines = kept.filter((s) => s[2] === 'pine'), blobs = kept.filter((s) => s[2] === 'blob')
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3()
  const place = (geo, mat, list, scaleBase) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length)
    list.forEach(([x, z], i) => {
      const sc = scaleBase * (0.7 + Math.random() * 0.8)
      p.set(x, heightAt(x, z) - 0.3, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28); s.set(sc, sc * (0.85 + Math.random() * 0.4), sc)
      m.compose(p, q, s); im.setMatrixAt(i, m)
    })
    im.castShadow = true; im.receiveShadow = true
    scene.add(im)
    return im
  }
  place(pine, pineMat, pines, 1)
  place(trunk, trunkMat, pines, 1)
  place(blob, leafMat, blobs, 1)
  place(trunk, trunkMat, blobs, 1.4)
}

export function buildMountains(scene) {
  const rock = new THREE.MeshStandardMaterial({ color: '#59607a', roughness: 1, flatShading: true })
  const hill = new THREE.MeshStandardMaterial({ color: '#3f5a3a', roughness: 1, flatShading: true })
  const g = new THREE.Group()
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + hash(i, 0, 0) * 0.2
    const r = 820 + hash(i, 1, 1) * 260
    const h = 220 + hash(i, 2, 2) * 260, w = 260 + hash(i, 3, 3) * 220
    const cone = new THREE.Mesh(roughen(new THREE.ConeGeometry(w, h, 9, 4), 24, 0.02), rock)
    cone.position.set(Math.cos(a) * r, h / 2 - 60, Math.sin(a) * r)
    g.add(cone)
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + hash(i, 4, 4) * 0.3
    const r = 470 + hash(i, 5, 5) * 160
    const h = 50 + hash(i, 6, 6) * 90, w = 150 + hash(i, 7, 7) * 140
    const cone = new THREE.Mesh(roughen(new THREE.ConeGeometry(w, h, 8, 3), 10, 0.03), hill)
    cone.position.set(Math.cos(a) * r, h / 2 - 18, Math.sin(a) * r)
    g.add(cone)
  }
  scene.add(g)
  return g
}

// The bramble on the far side of the pond: a thorny wall with lying holes in it.
export function buildBramble(scene) {
  const mat = new THREE.MeshStandardMaterial({ color: '#3a3a1e', roughness: 1, flatShading: true })
  const twig = new THREE.MeshStandardMaterial({ color: '#4a3b28', roughness: 1 })
  const ball = roughen(new THREE.IcosahedronGeometry(0.9, 1), 0.5, 1)
  const stick = new THREE.CylinderGeometry(0.03, 0.06, 2.2, 4)
  const n = 1400
  const balls = new THREE.InstancedMesh(ball, mat, n), sticks = new THREE.InstancedMesh(stick, twig, n)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler()
  const box = { x0: -104, x1: -52, z0: 16, z1: 32 }
  for (let i = 0; i < n; i++) {
    const x = box.x0 + Math.random() * (box.x1 - box.x0), z = box.z0 + Math.random() * (box.z1 - box.z0)
    const h = heightAt(x, z)
    const sc = 0.7 + Math.random() * 1.1
    p.set(x, h + 0.3 + Math.random() * 1.6, z); q.setFromEuler(e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)); s.set(sc, sc * 0.8, sc)
    m.compose(p, q, s); balls.setMatrixAt(i, m)
    p.set(x + (Math.random() - 0.5) * 1.5, h + 0.8, z + (Math.random() - 0.5) * 1.5)
    q.setFromEuler(e.set((Math.random() - 0.5) * 1.6, Math.random() * 6, (Math.random() - 0.5) * 1.6)); s.set(1, 1 + Math.random(), 1)
    m.compose(p, q, s); sticks.setMatrixAt(i, m)
  }
  balls.castShadow = true; sticks.castShadow = true
  scene.add(balls, sticks)
  return { box, inside: (x, z) => x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1 }
}
