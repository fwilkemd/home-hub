import * as THREE from 'three'

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,230,150,1)'); r.addColorStop(0.35, 'rgba(255,200,90,0.55)'); r.addColorStop(1, 'rgba(255,180,60,0)')
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

export class Hummingbird {
  constructor(scene) {
    this.obj = new THREE.Group()
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: '#d9b84a', emissive: '#8c6a10', emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.5 }))
    body.scale.set(1, 0.8, 1.9); this.obj.add(body)
    const throat = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshStandardMaterial({ color: '#3fbf6a', emissive: '#1f7f3a', emissiveIntensity: 1.5 }))
    throat.position.set(0, -0.015, 0.07); this.obj.add(throat)
    const wing = new THREE.PlaneGeometry(0.08, 0.035)
    const wm = new THREE.MeshBasicMaterial({ color: '#f0d680', transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    this.wL = new THREE.Mesh(wing, wm); this.wL.position.set(-0.05, 0.01, 0); this.obj.add(this.wL)
    this.wR = new THREE.Mesh(wing, wm); this.wR.position.set(0.05, 0.01, 0); this.obj.add(this.wR)
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0.9, depthWrite: false }))
    this.halo.scale.setScalar(0.5); this.obj.add(this.halo)
    this.light = new THREE.PointLight('#ffd27a', 1.2, 4); this.obj.add(this.light)
    this.obj.visible = false
    scene.add(this.obj)
    this.mode = 'hidden'; this.t = 0
  }
  dart(from, to, dur = 1.1) {
    this.mode = 'dart'; this.from = from.clone(); this.to = to.clone(); this.dur = dur; this.t = 0; this.obj.visible = true
    return new Promise((res) => { this.res = res })
  }
  hover(center) { this.mode = 'hover'; this.center = center.clone(); this.obj.visible = true; this.t = 0 }
  hide() { this.mode = 'hidden'; this.obj.visible = false }
  update(dt, time) {
    if (!this.obj.visible) return
    this.t += dt
    this.wL.rotation.z = Math.sin(time * 90) * 0.9; this.wR.rotation.z = -Math.sin(time * 90) * 0.9
    this.halo.material.opacity = 0.6 + 0.3 * Math.sin(time * 23)
    if (this.mode === 'dart') {
      const k = Math.min(1, this.t / this.dur)
      const e = k * k * (3 - 2 * k)
      this.obj.position.lerpVectors(this.from, this.to, e)
      this.obj.position.y += Math.sin(k * Math.PI) * 0.6 + Math.sin(time * 30) * 0.03
      if (k >= 1) { this.hide(); const r = this.res; this.res = null; r && r() }
    } else if (this.mode === 'hover') {
      // a hummingbird's flight: sharp little relocations, then stillness
      const seg = Math.floor(this.t / 1.4), f = (this.t % 1.4) / 1.4
      const h = (n) => { const s = Math.sin(n * 127.1 + seg * 311.7) * 43758.5; return s - Math.floor(s) }
      const a = new THREE.Vector3((h(1) - 0.5) * 3, h(2) * 1.4 + 0.8, (h(3) - 0.5) * 3)
      const b = new THREE.Vector3((h(4) - 0.5) * 3, h(5) * 1.4 + 0.8, (h(6) - 0.5) * 3)
      const e = f < 0.25 ? (f / 0.25) * (f / 0.25) * (3 - 2 * f / 0.25) : 1
      this.obj.position.copy(this.center).add(a.lerp(b, e))
      this.obj.position.y += Math.sin(time * 28) * 0.02
    }
  }
}
