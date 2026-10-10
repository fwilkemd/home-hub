import * as THREE from 'three'

// A simple, readable stand-in human. Everything is a primitive so it can be
// swapped for a real rigged model later without changing the game logic.
export class Figure {
  constructor(opts) {
    const { skin = '#c9a383', hair = '#2a1d16', top = '#2b2b2f', bottom = '#5c5a3c', shoes = '#222', dress = null, barefoot = false, hairLong = false, scale = 1 } = opts
    const mat = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r })
    this.root = new THREE.Group()
    this.root.scale.setScalar(scale)
    this.hips = new THREE.Group(); this.hips.position.y = 0.92; this.root.add(this.hips)
    const torsoH = 0.52
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, torsoH - 0.32, 4, 10), mat(dress || top)); this.torso.position.y = torsoH / 2 + 0.02
    this.torso.scale.set(1.15, 1, 0.75); this.hips.add(this.torso)
    if (dress) {
      const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.62, 12, 1, true), mat(dress)); skirt.position.y = -0.2; skirt.scale.set(1, 1, 0.8)
      skirt.material.side = THREE.DoubleSide; this.hips.add(skirt)
    } else {
      const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.26, 10), mat(bottom)); shorts.position.y = -0.1; shorts.scale.set(1, 1, 0.75); this.hips.add(shorts)
    }
    this.neck = new THREE.Group(); this.neck.position.y = torsoH + 0.06; this.hips.add(this.neck)
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), mat(skin, 0.8)); this.head.position.y = 0.12; this.neck.add(this.head)
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hair)); hairCap.position.y = 0.015; this.head.add(hairCap)
    if (hairLong) { const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 3, 8), mat(hair)); back.position.set(0, -0.12, 0.07); this.head.add(back) }
    const limb = (len, r, c) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - r * 2, 3, 8), mat(c, 0.85)); m.position.y = -len / 2; m.castShadow = true; g.add(m); return g }
    this.armL = limb(0.3, 0.045, dress ? skin : top); this.armL.position.set(-0.21, torsoH - 0.02, 0); this.hips.add(this.armL)
    this.armR = limb(0.3, 0.045, dress ? skin : top); this.armR.position.set(0.21, torsoH - 0.02, 0); this.hips.add(this.armR)
    this.foreL = limb(0.28, 0.04, skin); this.foreL.position.y = -0.3; this.armL.add(this.foreL)
    this.foreR = limb(0.28, 0.04, skin); this.foreR.position.y = -0.3; this.armR.add(this.foreR)
    this.handL = new THREE.Group(); this.handL.position.y = -0.3; this.foreL.add(this.handL)
    this.handR = new THREE.Group(); this.handR.position.y = -0.3; this.foreR.add(this.handR)
    this.legL = limb(0.46, 0.065, skin); this.legL.position.set(-0.1, -0.02, 0); this.hips.add(this.legL)
    this.legR = limb(0.46, 0.065, skin); this.legR.position.set(0.1, -0.02, 0); this.hips.add(this.legR)
    this.shinL = limb(0.44, 0.05, skin); this.shinL.position.y = -0.46; this.legL.add(this.shinL)
    this.shinR = limb(0.44, 0.05, skin); this.shinR.position.y = -0.46; this.legR.add(this.shinR)
    const foot = () => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.2), mat(barefoot ? skin : shoes, 0.95)); f.position.set(0, -0.44, 0.05); return f }
    this.shinL.add(foot()); this.shinR.add(foot())
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true })
    this.pose = 'idle'; this.phase = 0; this.t = 0
    this.lean = 0
    this.poseT = 0
  }
  setPose(p) { if (p !== this.pose) { this.pose = p; this.poseT = 0 } }
  // speed: metres per second of ground motion, used to drive the walk cycle
  update(dt, speed = 0) {
    this.t += dt; this.poseT += dt
    const p = this.pose
    const s = (a, b, k) => a + (b - a) * Math.min(1, dt * k)
    const set = (g, x, z = 0) => { g.rotation.x = s(g.rotation.x, x, 10); g.rotation.z = s(g.rotation.z, z, 10) }
    const hipsY = (y) => { this.hips.position.y = s(this.hips.position.y, y, 8) }
    this.hips.rotation.y = s(this.hips.rotation.y, 0, 8)
    if (p === 'walk' || p === 'run') {
      const run = p === 'run'
      this.phase += dt * (run ? 11 : 7.2) * Math.max(0.35, speed / (run ? 5 : 2.5))
      const a = run ? 0.85 : 0.55, sw = Math.sin(this.phase)
      set(this.legL, sw * a); set(this.legR, -sw * a)
      set(this.shinL, Math.max(0, -sw) * a * 1.4 + 0.1); set(this.shinR, Math.max(0, sw) * a * 1.4 + 0.1)
      set(this.armL, -sw * a * 0.7); set(this.armR, sw * a * 0.7)
      set(this.foreL, -0.4 - (run ? 0.6 : 0)); set(this.foreR, -0.4 - (run ? 0.6 : 0))
      set(this.torso, run ? 0.22 : 0.05); set(this.neck, run ? -0.1 : 0)
      hipsY(0.92 + Math.abs(sw) * (run ? 0.05 : 0.025) - (run ? 0.03 : 0))
    } else if (p === 'sit') {
      set(this.legL, -1.5, -0.08); set(this.legR, -1.5, 0.08); set(this.shinL, 1.45); set(this.shinR, 1.1)
      set(this.armL, -0.25, -0.1); set(this.armR, -0.25, 0.1); set(this.foreL, -0.9); set(this.foreR, -0.9)
      set(this.torso, 0.08); set(this.neck, Math.sin(this.t * 0.8) * 0.06)
      hipsY(0.42)
    } else if (p === 'lie') {
      set(this.legL, 0, -0.04); set(this.legR, 0, 0.04); set(this.shinL, 0.05); set(this.shinR, 0.1)
      set(this.armL, 0.2, -0.25); set(this.armR, 0.4, 0.3); set(this.foreL, -0.3); set(this.foreR, -0.5)
      set(this.torso, 0); set(this.neck, -0.2)
      hipsY(0.92)
      this.hips.rotation.y = 0
      this.root.rotation.x = s(this.root.rotation.x, -Math.PI / 2 + 0.06, 6)
      return
    } else if (p === 'crouch') {
      set(this.legL, -1.9, -0.15); set(this.legR, -1.9, 0.15); set(this.shinL, 2.2); set(this.shinR, 2.2)
      set(this.armL, -1.1, -0.15); set(this.armR, -1.1, 0.15); set(this.foreL, -0.9); set(this.foreR, -0.9)
      set(this.torso, 0.35); set(this.neck, -0.3)
      hipsY(0.45)
    } else if (p === 'spin') {
      set(this.legL, 0.1, -0.1); set(this.legR, -0.1, 0.1); set(this.shinL, 0.1); set(this.shinR, 0.1)
      set(this.armL, -0.2, -1.4); set(this.armR, -0.2, 1.4); set(this.foreL, -0.1); set(this.foreR, -0.1)
      set(this.torso, -0.1); set(this.neck, -0.25)
      hipsY(0.95 + Math.sin(this.t * 6) * 0.02)
      this.root.rotation.y += dt * 4.2
    } else if (p === 'golf') {
      // bent at the waist, hands together low: "hunchback with a stick"
      const sw = this.swing || 0
      set(this.legL, 0.05, -0.12); set(this.legR, 0.05, 0.12); set(this.shinL, 0.15); set(this.shinR, 0.15)
      set(this.torso, 0.55, sw * 0.35); set(this.neck, -0.45)
      set(this.armL, -1.1 + sw * 1.2, 0.25 - sw * 0.8); set(this.armR, -1.1 + sw * 1.2, -0.25 - sw * 0.8); set(this.foreL, -0.2); set(this.foreR, -0.2)
      this.hips.rotation.y = s(this.hips.rotation.y, -sw * 0.9, 12)
      hipsY(0.86)
    } else if (p === 'kneel') {
      set(this.legL, -1.6, -0.1); set(this.legR, -1.6, 0.1); set(this.shinL, 2.3); set(this.shinR, 2.3)
      set(this.armL, -0.8, -0.3); set(this.armR, -0.8, 0.3); set(this.foreL, -0.5); set(this.foreR, -0.5)
      set(this.torso, 0.45); set(this.neck, 0.25)
      hipsY(0.55)
    } else if (p === 'lean') {
      // back against bark, standing, arms crossed-ish
      set(this.legL, 0.15, -0.1); set(this.legR, -0.1, 0.12); set(this.shinL, 0.05); set(this.shinR, 0.25)
      set(this.armL, -0.5, 0.35); set(this.armR, -0.5, -0.35); set(this.foreL, -1.4); set(this.foreR, -1.4)
      set(this.torso, -0.12); set(this.neck, 0.1)
      hipsY(0.88)
    } else {
      // idle: breathe
      const b = Math.sin(this.t * 1.6) * 0.012
      set(this.legL, 0, -0.03); set(this.legR, 0, 0.03); set(this.shinL, 0.04); set(this.shinR, 0.04)
      set(this.armL, 0.04 + b, -0.1); set(this.armR, 0.04 - b, 0.1); set(this.foreL, -0.25); set(this.foreR, -0.25)
      set(this.torso, 0.02 + b); set(this.neck, Math.sin(this.t * 0.7) * 0.05)
      hipsY(0.92 + b * 0.4)
    }
    this.root.rotation.x = s(this.root.rotation.x, 0, 6)
  }
}
