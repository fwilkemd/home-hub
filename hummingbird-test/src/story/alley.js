import * as THREE from 'three'
import { Figure } from '../chars/figure.js'

// The white alleyway: a vision that arrives with the episodes.
export class Alley {
  constructor(world) {
    this.w = world
    const s = new THREE.Scene(); this.scene = s
    const white = new THREE.Color('#f7f3ec')
    s.background = white; s.fog = new THREE.Fog(white, 4, 48)
    this.cam = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
    const mat = new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 1 })
    const stone = new THREE.MeshStandardMaterial({ color: '#d9d2c6', roughness: 1 })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; s.add(ground)
    for (const x of [-2.2, 2.2]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 60), mat); wall.position.set(x, 4.5, -20); wall.castShadow = true; s.add(wall)
      for (let i = 0; i < 6; i++) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.9), stone); win.position.set(x * 0.5, 2 + (i % 2) * 2.5, -4 - i * 8); s.add(win) }
    }
    // the square: fountain ringed around a saintly statue, and the stone steps
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.7, 32), stone); basin.position.set(0, 0.35, -62); s.add(basin)
    const water = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 0.1, 32), new THREE.MeshStandardMaterial({ color: '#dfe6ea', roughness: 0.2, metalness: 0.3 })); water.position.set(0, 0.68, -62); s.add(water)
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 2.4, 12), stone); column.position.set(0, 1.9, -62); s.add(column)
    const saint = new Figure({ skin: '#dcd5c8', hair: '#dcd5c8', top: '#dcd5c8', bottom: '#dcd5c8', shoes: '#dcd5c8', dress: '#d6cfc2', scale: 1.5 })
    saint.root.position.set(0, 3.1, -62); saint.fig = saint; s.add(saint.root); this.saint = saint
    saint.update(0.1); saint.armL.rotation.set(-2.4, 0, -0.5); saint.armR.rotation.set(-2.4, 0, 0.5)
    const wingMat = new THREE.MeshStandardMaterial({ color: '#e9e4da', roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    for (const sgn of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6, 6, 8), wingMat)
      const p = wing.geometry.attributes.position
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 2 + y) * 0.15); if (Math.abs(x) > 1.0 && (Math.floor((y + 1.8) * 2.5) % 2 === 0)) p.setX(i, x * 0.8) }
      wing.geometry.computeVertexNormals()
      wing.position.set(sgn * 1.1, 1.2, -0.3); wing.rotation.set(0.1, sgn * 0.6, sgn * -0.4)
      saint.hips.add(wing)
    }
    for (let i = 0; i < 30; i++) { const step = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 1.2), stone); step.position.set(16 + i * 0.6, 0.2 + i * 0.4, -62 - i * 1.0); step.castShadow = true; s.add(step) }
    const hemi = new THREE.HemisphereLight('#ffffff', '#e8e2d8', 1.6); s.add(hemi)
    const sun = new THREE.DirectionalLight('#fff6e6', 1.8); sun.position.set(20, 40, 10); sun.castShadow = true
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.mapSize.set(2048, 2048); s.add(sun)
    this.t = 0
  }
  start() {
    const w = this.w
    this.t = 0
    w.ui.hud(false)
    w.override = { scene: this.scene, camera: this.cam, update: (dt) => this.update(dt) }
    this.cam.position.set(0, 1.5, 6); this.cam.lookAt(0, 1.6, -62)
  }
  stop() { this.w.override = null; this.w.ui.hud(true) }
  update(dt) {
    this.t += dt
    // a slow, inevitable walk toward the square
    const z = 6 - Math.min(52, this.t * 1.2)
    this.cam.position.set(Math.sin(this.t * 0.9) * 0.05, 1.5 + Math.sin(this.t * 1.8) * 0.02, z)
    this.cam.lookAt(Math.sin(this.t * 0.2) * 0.6, 1.9, -62)
  }
}
