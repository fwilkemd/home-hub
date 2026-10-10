import * as THREE from 'three'
import { heightAt } from '../world/terrain.js'
import { Character } from './rig.js'

export class Jay {
  constructor(scene, rig) {
    this.fig = new Character(rig, { body: '#2d6fb0', joints: '#17395c', scale: 1.02 })
    this.obj = this.fig.root
    scene.add(this.obj)
    this.pos = new THREE.Vector3(); this.yaw = 0
    this.path = null; this.speed = 2; this.resolve = null
    this.faceTarget = null
    this.club = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.05, 6), new THREE.MeshStandardMaterial({ color: '#bfbfbf', metalness: 0.7, roughness: 0.35 }))
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: '#333' })); head.position.y = -0.52; this.club.add(head)
    this.club.position.set(0, -0.45, 0.02); this.club.visible = false
    this.fig.handR.add(this.club)
    this.held = null
  }
  set visible(v) { this.obj.visible = v }
  get visible() { return this.obj.visible }
  place(x, z, yaw = 0) { this.pos.set(x, heightAt(x, z), z); this.yaw = yaw; this.obj.position.copy(this.pos); this.obj.rotation.y = yaw; this.obj.rotation.set(0, yaw, 0) }
  face(target) { this.faceTarget = target }
  hold(obj) { if (this.held) this.fig.handL.remove(this.held); this.held = obj; if (obj) { obj.position.set(0.05, -0.05, 0.1); this.fig.handL.add(obj) } }
  goTo(points, speed = 2.2) {
    this.path = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], 0, p[1])))
    this.speed = speed
    return new Promise((res) => { this.resolve = res })
  }
  // one golf swing: returns a promise resolved at the moment of contact
  swing() {
    return new Promise((res) => { this.swingT = 0; this.swingRes = res })
  }
  update(dt) {
    let moving = 0
    if (this.path && this.path.length) {
      const t = this.path[0]
      const d = new THREE.Vector3(t.x - this.pos.x, 0, t.z - this.pos.z)
      const dist = d.length()
      if (dist < 0.25) { this.path.shift(); if (!this.path.length) { this.path = null; const r = this.resolve; this.resolve = null; r && r() } }
      else {
        d.normalize(); this.pos.addScaledVector(d, Math.min(dist, this.speed * dt))
        const dy = Math.atan2(d.x, d.z); let dd = dy - this.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); this.yaw += dd * Math.min(1, dt * 9)
        moving = this.speed
      }
    } else if (this.faceTarget) {
      const dy = Math.atan2(this.faceTarget.x - this.pos.x, this.faceTarget.z - this.pos.z)
      let dd = dy - this.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); this.yaw += dd * Math.min(1, dt * 5)
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z)
    this.obj.position.copy(this.pos)
    if (this.fig.pose !== 'spin') this.obj.rotation.y = this.yaw
    if (moving) this.fig.setPose(this.speed > 3.4 ? 'run' : 'walk')
    else if (this.pose) this.fig.setPose(this.pose)
    else this.fig.setPose('idle')
    if (this.fig.pose === 'golf') {
      this.club.visible = true
      if (this.swingT !== undefined && this.swingT !== null) {
        this.swingT += dt
        // backswing 0..0.7, downswing 0.7..0.9 (contact), follow-through to 1.6
        const t = this.swingT
        this.fig.swing = t < 0.7 ? -t / 0.7 : t < 0.9 ? -1 + ((t - 0.7) / 0.2) * 2 : 1 - Math.max(0, (t - 1.2)) * 1.2
        if (t >= 0.85 && this.swingRes) { const r = this.swingRes; this.swingRes = null; r() }
        if (t > 2.0) { this.swingT = null; this.fig.swing = 0 }
      } else this.fig.swing = 0
    } else this.club.visible = false
    this.fig.update(dt, moving)
  }
}
