import * as THREE from 'three'
import { ROOM } from './room'

const SNAP_RADIANS = Math.PI / 6 // 30°
const STICK_THRESHOLD = 0.7
const STICK_RELEASE = 0.3

/**
 * Standard VR locomotion: thumbstick-forward aims a teleport marker along the
 * controller ray (release to jump), thumbstick left/right snap-turns 30°.
 * The room is sized so everything is reachable from beside the bed; this is
 * comfort polish, not a requirement.
 */
export class Locomotion {
  private readonly marker: THREE.Mesh
  private snapLatched = false
  private aiming: THREE.XRTargetRaySpace | null = null
  private target: THREE.Vector3 | null = null

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly rig: THREE.Group,
    private readonly camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
  ) {
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.2, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x3ad2e8 }),
    )
    this.marker.position.y = 0.01
    this.marker.visible = false
    scene.add(this.marker)
  }

  update(): void {
    const session = this.renderer.xr.getSession()
    if (!session) {
      this.marker.visible = false
      return
    }

    let teleportStick = 0
    let teleportSource: XRInputSource | null = null
    let turnStick = 0

    for (const source of session.inputSources) {
      const axes = source.gamepad?.axes
      if (!axes || axes.length < 4) continue
      const x = axes[2] ?? 0
      const y = axes[3] ?? 0
      if (source.handedness === 'right' || turnStick === 0) turnStick = Math.abs(x) > Math.abs(turnStick) ? x : turnStick
      if (-y > Math.abs(teleportStick)) {
        teleportStick = -y
        teleportSource = source
      }
    }

    // Snap turn (latched so one push = one turn)
    if (!this.snapLatched && Math.abs(turnStick) >= STICK_THRESHOLD) {
      this.snapLatched = true
      this.rotateRigAroundCamera(-Math.sign(turnStick) * SNAP_RADIANS)
    } else if (this.snapLatched && Math.abs(turnStick) < STICK_RELEASE) {
      this.snapLatched = false
    }

    // Teleport aim while the stick is pushed forward
    if (teleportStick >= STICK_THRESHOLD && teleportSource) {
      const controller = this.controllerFor(teleportSource)
      if (controller) {
        this.aiming = controller
        this.target = this.floorHit(controller)
        if (this.target) {
          this.marker.position.set(this.target.x, 0.01, this.target.z)
          this.marker.visible = true
        } else {
          this.marker.visible = false
        }
      }
    } else if (this.aiming) {
      // Stick released → jump
      if (this.target) this.teleportTo(this.target)
      this.aiming = null
      this.target = null
      this.marker.visible = false
    }
  }

  private controllerFor(source: XRInputSource): THREE.XRTargetRaySpace | null {
    for (const i of [0, 1]) {
      const c = this.renderer.xr.getController(i)
      // three stores the matching inputSource in userData on connect
      if ((c.userData as { inputSource?: XRInputSource }).inputSource === source) return c
    }
    return this.renderer.xr.getController(0)
  }

  private floorHit(controller: THREE.Object3D): THREE.Vector3 | null {
    const origin = controller.getWorldPosition(new THREE.Vector3())
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(
      controller.getWorldQuaternion(new THREE.Quaternion()),
    )
    if (dir.y >= -0.05) return null // must point downward
    const k = -origin.y / dir.y
    if (k <= 0 || k > 8) return null
    const hit = origin.addScaledVector(dir, k)
    const m = 0.4
    hit.x = THREE.MathUtils.clamp(hit.x, -ROOM.width / 2 + m, ROOM.width / 2 - m)
    hit.z = THREE.MathUtils.clamp(hit.z, -ROOM.depth / 2 + m, ROOM.depth / 2 - m)
    return hit
  }

  private teleportTo(target: THREE.Vector3): void {
    const camWorld = this.camera.getWorldPosition(new THREE.Vector3())
    this.rig.position.x += target.x - camWorld.x
    this.rig.position.z += target.z - camWorld.z
  }

  private rotateRigAroundCamera(angle: number): void {
    const camWorld = this.camera.getWorldPosition(new THREE.Vector3())
    const pivot = new THREE.Vector3(camWorld.x, this.rig.position.y, camWorld.z)
    this.rig.position.sub(pivot)
    this.rig.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
    this.rig.position.add(pivot)
    this.rig.rotateY(angle)
  }
}
