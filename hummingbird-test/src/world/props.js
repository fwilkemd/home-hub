import * as THREE from 'three'
import { heightAt, L } from './terrain.js'
import { tex } from './textures.js'

export function buildCar(scene) {
  const g = new THREE.Group()
  const paint = new THREE.MeshPhysicalMaterial({ color: '#1c2e22', roughness: 0.6, metalness: 0.08, clearcoat: 0.25, clearcoatRoughness: 0.5 })
  const dark = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 })
  const rubber = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 1 })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#9fc0d4', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.5, transmission: 0.2 })
  const chrome = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.7, metalness: 0.2 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.5), paint); body.position.y = 0.65
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.6), paint); hood.position.set(0, 0.99, -1.3)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.3), glass); cabin.position.set(0, 1.25, 0.25)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 2.1), paint); roof.position.set(0, 1.58, 0.25)
  const pillars = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.6, 0.1), paint); pillars.position.set(0, 1.25, 1.4)
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.18, 0.12), chrome); bumperF.position.set(0, 0.45, -2.28)
  const bumperB = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.18, 0.12), chrome); bumperB.position.set(0, 0.45, 2.28)
  ;[body, hood, cabin, roof, pillars, bumperF, bumperB].forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m) })
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18); wheelGeo.rotateZ(Math.PI / 2)
  const hubGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.26, 12); hubGeo.rotateZ(Math.PI / 2)
  for (const [x, z] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, rubber); w.position.set(x, 0.34, z); w.castShadow = true; g.add(w)
    const h = new THREE.Mesh(hubGeo, chrome); h.position.set(x, 0.34, z); g.add(h)
  }
  for (const x of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: '#fff3c0', emissive: '#ffe08a', emissiveIntensity: 1.2 }))
    hl.position.set(x, 0.72, -2.26); g.add(hl)
  }
  const mess = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 }))
  mess.position.set(0.1, 1.05, 1.0); g.add(mess)
  const seats = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.5), dark); seats.position.set(0, 1.15, 0.0); g.add(seats)
  g.position.copy(L.car); g.position.y = heightAt(L.car.x, L.car.z)
  scene.add(g)
  return g
}

export function buildGolfBag(scene, at) {
  const g = new THREE.Group()
  const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.95, 12), new THREE.MeshStandardMaterial({ color: '#6e655c', roughness: 0.95 }))
  bag.position.y = 0.5; bag.rotation.z = 0.35; bag.castShadow = true
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: '#e5a3b8', roughness: 1 }))
  logo.position.set(0.17, 0.25, 0.02); logo.rotation.y = Math.PI / 2
  bag.add(logo)
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), new THREE.MeshStandardMaterial({ color: '#c8c8c8', metalness: 0.9, roughness: 0.3 }))
    c.position.set((i - 1.5) * 0.06, 0.55 + 0.1 * Math.random(), 0); bag.add(c)
  }
  g.add(bag)
  g.position.set(at.x, heightAt(at.x, at.z), at.z)
  scene.add(g)
  return g
}

export function makeGolfBall() {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: 0.5 }))
  b.castShadow = true
  return b
}

export function makeFrog() {
  const f = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshStandardMaterial({ color: '#7bf23a', emissive: '#3bd01a', emissiveIntensity: 0.8, roughness: 0.35 }))
  body.scale.set(1, 0.7, 1.2); f.add(body)
  const light = new THREE.PointLight('#8dff4a', 1.2, 2.5); f.add(light)
  return f
}

export function makeLeaf(at) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshStandardMaterial({ map: tex('leaves.png', { wrap: false }), alphaTest: 0.45, side: THREE.DoubleSide, color: '#c9a24a', roughness: 0.9 }))
  m.rotation.x = -Math.PI / 2; m.rotation.z = 0.7
  m.position.set(at.x, heightAt(at.x, at.z) + 0.04, at.z)
  return m
}
