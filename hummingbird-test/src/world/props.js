import * as THREE from 'three'
import { heightAt, L } from './terrain.js'

export function buildCar(scene) {
  const g = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial({ color: '#3b4a3a', roughness: 0.55, metalness: 0.35 })
  const dark = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 })
  const glass = new THREE.MeshStandardMaterial({ color: '#8fb3c8', roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.55 })
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.5), paint); body.position.y = 0.65
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.3), glass); cabin.position.set(0, 1.25, 0.25)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 2.1), paint); roof.position.set(0, 1.58, 0.25)
  const pillars = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.6, 0.1), paint); pillars.position.set(0, 1.25, 1.4)
  ;[body, cabin, roof, pillars].forEach((m) => { m.castShadow = true; g.add(m) })
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14); wheelGeo.rotateZ(Math.PI / 2)
  for (const [x, z] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, dark); w.position.set(x, 0.34, z); w.castShadow = true; g.add(w)
  }
  for (const x of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.05), new THREE.MeshStandardMaterial({ color: '#fff3c0', emissive: '#ffe08a', emissiveIntensity: 0.6 }))
    hl.position.set(x, 0.72, -2.26); g.add(hl)
  }
  // a wake of the stuff inside: a sleeping bag lump and boxes behind the glass
  const mess = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 1 }))
  mess.position.set(0.1, 1.05, 1.0); g.add(mess)
  g.position.copy(L.car); g.position.y = heightAt(L.car.x, L.car.z)
  g.rotation.y = 0 // nose toward -Z
  scene.add(g)
  return g
}

export function buildGolfBag(scene, at) {
  const g = new THREE.Group()
  const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.95, 10), new THREE.MeshStandardMaterial({ color: '#7a6f66', roughness: 1 }))
  bag.position.y = 0.5; bag.rotation.z = 0.35; bag.castShadow = true
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ color: '#e5a3b8', roughness: 1 }))
  logo.position.set(0.17, 0.25, 0.02); logo.rotation.y = Math.PI / 2
  bag.add(logo)
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 5), new THREE.MeshStandardMaterial({ color: '#b9b9b9', metalness: 0.7, roughness: 0.4 }))
    c.position.set((i - 1.5) * 0.06, 0.55 + 0.1 * Math.random(), 0); bag.add(c)
  }
  g.add(bag)
  g.position.set(at.x, heightAt(at.x, at.z), at.z)
  scene.add(g)
  return g
}

export function makeGolfBall() {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: 0.6 }))
  b.castShadow = true
  return b
}

export function makeFrog() {
  const f = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: '#7bf23a', emissive: '#3bd01a', emissiveIntensity: 0.6, roughness: 0.4 }))
  body.scale.set(1, 0.7, 1.2); f.add(body)
  const light = new THREE.PointLight('#8dff4a', 0.8, 2.5); f.add(light)
  return f
}

// A fallen oak leaf you can trace into the journal.
export function makeLeaf(at) {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = '#a88a3a'
  g.beginPath(); g.moveTo(32, 4)
  for (let i = 0; i < 7; i++) { const t = i / 6; const w = 10 + 12 * Math.sin(t * Math.PI); g.lineTo(32 + w * (i % 2 ? 1 : 0.55), 6 + t * 54) }
  for (let i = 6; i >= 0; i--) { const t = i / 6; const w = 10 + 12 * Math.sin(t * Math.PI); g.lineTo(32 - w * (i % 2 ? 1 : 0.55), 6 + t * 54) }
  g.closePath(); g.fill()
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }))
  m.rotation.x = -Math.PI / 2; m.rotation.z = 0.7
  m.position.set(at.x, heightAt(at.x, at.z) + 0.05, at.z)
  return m
}
