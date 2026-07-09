import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import { ROOM } from './room'

/**
 * Desktop fallback: pointer-lock mouse look + WASD, active whenever an XR
 * session is not presenting. Click = trigger (interactions arrive in M2).
 */
export class DesktopControls {
  private readonly controls: PointerLockControls
  private readonly keys = new Set<string>()
  private readonly velocity = new THREE.Vector3()
  /** When set, clicking only grabs the pointer if this returns true (so
   *  clicks on interactive things select them instead of locking). */
  lockGate: (() => boolean) | null = null

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.controls = new PointerLockControls(camera, domElement)

    domElement.addEventListener('click', () => {
      if (!this.controls.isLocked && (this.lockGate?.() ?? true)) this.controls.lock()
    })
    document.addEventListener('keydown', (e) => this.keys.add(e.code))
    document.addEventListener('keyup', (e) => this.keys.delete(e.code))
  }

  get locked(): boolean {
    return this.controls.isLocked
  }

  onLockChange(cb: (locked: boolean) => void): void {
    this.controls.addEventListener('lock', () => cb(true))
    this.controls.addEventListener('unlock', () => cb(false))
  }

  update(dt: number): void {
    if (!this.controls.isLocked) return
    const speed = 2.2
    const damp = Math.exp(-10 * dt)
    this.velocity.multiplyScalar(damp)

    const fwd = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'))
    const strafe = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'))
    if (fwd) this.velocity.z = fwd * speed
    if (strafe) this.velocity.x = strafe * speed

    this.controls.moveForward(this.velocity.z * dt)
    this.controls.moveRight(this.velocity.x * dt)

    // Stay inside the room at standing eye height.
    const p = this.controls.object.position
    const m = 0.35
    p.x = THREE.MathUtils.clamp(p.x, -ROOM.width / 2 + m, ROOM.width / 2 - m)
    p.z = THREE.MathUtils.clamp(p.z, -ROOM.depth / 2 + m, ROOM.depth / 2 - m)
    p.y = 1.6
  }
}
