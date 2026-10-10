import * as THREE from 'three'
import { heightAt } from '../world/terrain.js'
import { Figure } from './figure.js'

const WALK = 2.3, RUN = 4.9, WINDED = 1.3

export class Player {
  constructor(scene, input, camera) {
    this.input = input; this.camera = camera
    this.fig = new Figure({ top: '#2e2a33', bottom: '#5e5a3e', hair: '#1c1512', skin: '#d2ad8c' })
    this.obj = this.fig.root
    scene.add(this.obj)
    this.pos = new THREE.Vector3(0, 0, 0)
    this.yaw = Math.PI
    this.vel = new THREE.Vector3()
    this.stamina = 1; this.burning = false
    this.locked = true
    this.slowZone = null
    this.speedMul = 1
    // camera
    this.camYaw = Math.PI; this.camPitch = 0.18
    this.camDist = 4.4
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3()
    this.cine = null // { pos, look, k }
    this.shake = 0
    this.mode = 'follow'
  }
  setPosition(x, z, yaw = this.yaw) {
    this.pos.set(x, heightAt(x, z), z); this.yaw = yaw; this.camYaw = yaw + Math.PI
    this.obj.position.copy(this.pos); this.obj.rotation.y = yaw
    this.snapCamera()
  }
  snapCamera() { this.updateCamera(1, true) }
  get speed() { return this.vel.length() }
  update(dt) {
    const inp = this.input
    const [mx, my] = inp.consumeMouse()
    if (inp.locked && !this.locked) {
      this.camYaw -= mx * 0.0022; this.camPitch = THREE.MathUtils.clamp(this.camPitch + my * 0.0016, -0.3, 0.75)
    }
    let move = new THREE.Vector3()
    if (!this.locked) {
      if (inp.down('KeyW')) move.z -= 1
      if (inp.down('KeyS')) move.z += 1
      if (inp.down('KeyA')) move.x -= 1
      if (inp.down('KeyD')) move.x += 1
    }
    const moving = move.lengthSq() > 0
    const wantRun = moving && inp.down('ShiftLeft') && !this.burning
    if (wantRun) { this.stamina = Math.max(0, this.stamina - dt / 6.5); if (this.stamina <= 0) this.burning = true }
    else { this.stamina = Math.min(1, this.stamina + dt / (this.burning ? 9 : 13)); if (this.burning && this.stamina > 0.5) this.burning = false }
    let target = 0
    if (moving) {
      move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camYaw)
      target = (this.burning ? WINDED : wantRun ? RUN : WALK) * this.speedMul
      const desiredYaw = Math.atan2(move.x, move.z)
      let d = desiredYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d))
      this.yaw += d * Math.min(1, dt * 10)
    }
    const tv = move.multiplyScalar(target)
    this.vel.lerp(tv, Math.min(1, dt * (moving ? 7 : 10)))
    this.pos.addScaledVector(this.vel, dt)
    this.pos.y = heightAt(this.pos.x, this.pos.z)
    this.obj.position.copy(this.pos); this.obj.rotation.y = this.yaw
    const sp = this.vel.length()
    if (this.poseOverride) this.fig.setPose(this.poseOverride)
    else this.fig.setPose(sp > 3.2 ? 'run' : sp > 0.25 ? 'walk' : 'idle')
    this.fig.update(dt, sp)
    this.updateCamera(dt)
  }
  updateCamera(dt, snap = false) {
    const cam = this.camera
    if (this.cine) {
      const k = snap ? 1 : Math.min(1, dt * (this.cine.k || 1.5))
      this.camPos.lerp(this.cine.pos, k); this.camLook.lerp(this.cine.look, k)
    } else {
      const look = this.pos.clone().add(new THREE.Vector3(0, 1.35, 0))
      const back = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw))
      const desired = look.clone().addScaledVector(back, this.camDist * Math.cos(this.camPitch)).add(new THREE.Vector3(0, this.camDist * Math.sin(this.camPitch) + 0.25, 0))
      // shoulder offset, the way an over-the-shoulder camera sits
      const side = new THREE.Vector3(back.z, 0, -back.x)
      desired.addScaledVector(side, 0.45); look.addScaledVector(side, 0.45)
      const floor = heightAt(desired.x, desired.z) + 0.5
      if (desired.y < floor) desired.y = floor
      const k = snap ? 1 : Math.min(1, dt * 9)
      this.camPos.lerp(desired, k); this.camLook.lerp(look, snap ? 1 : Math.min(1, dt * 12))
    }
    cam.position.copy(this.camPos)
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake; cam.position.y += (Math.random() - 0.5) * this.shake
      this.shake *= Math.pow(0.02, dt)
    }
    cam.lookAt(this.camLook)
  }
}
