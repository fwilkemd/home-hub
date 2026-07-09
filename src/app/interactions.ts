import * as THREE from 'three'

export interface InteractionHandlers {
  onSelect?: () => void
  onLongPress?: () => void
  onHoverStart?: () => void
  onHoverEnd?: () => void
}

const LONG_PRESS_MS = 650

interface PointerState {
  hovered: THREE.Object3D | null
  pressTarget: THREE.Object3D | null
  pressAt: number
  longFired: boolean
}

/**
 * One raycast-select system for both presentations: XR controller rays with
 * trigger select, and the desktop fallback (crosshair when pointer-locked,
 * plain mouse position otherwise). Click = trigger. Hold = long press.
 */
export class Interactions {
  private readonly targets = new Map<THREE.Object3D, InteractionHandlers>()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointers = new Map<string, PointerState>()
  private readonly mouseNdc = new THREE.Vector2(0, 0)
  private readonly controllers: THREE.XRTargetRaySpace[] = []
  private readonly rayLines: THREE.Line[] = []
  private readonly cursor: THREE.Mesh

  /** Called on any successful select — used to unlock audio + click sound. */
  onAnySelect: (() => void) | null = null

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly isPointerLocked: () => boolean,
    scene: THREE.Scene,
    rig: THREE.Group,
  ) {
    this.raycaster.far = 6

    // Hit cursor (shared; parked at the latest hover point)
    this.cursor = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xdff2f8 }),
    )
    this.cursor.visible = false
    scene.add(this.cursor)

    // XR controllers: ray line + trigger events
    for (const i of [0, 1]) {
      const controller = this.renderer.xr.getController(i)
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -4),
      ])
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fc6d4 }))
      line.visible = false
      controller.add(line)
      rig.add(controller)
      this.controllers.push(controller)
      this.rayLines.push(line)
      this.pointers.set(`xr${i}`, { hovered: null, pressTarget: null, pressAt: 0, longFired: false })

      controller.addEventListener('selectstart', () => this.pressStart(`xr${i}`))
      controller.addEventListener('selectend', () => this.pressEnd(`xr${i}`))
      controller.addEventListener('connected', () => (line.visible = true))
      controller.addEventListener('disconnected', () => (line.visible = false))
    }

    // Desktop mouse
    this.pointers.set('mouse', { hovered: null, pressTarget: null, pressAt: 0, longFired: false })
    const dom = renderer.domElement
    dom.addEventListener('pointermove', (e) => {
      this.mouseNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    })
    // Refresh mouse hover synchronously at press/release so desktop clicks
    // don't depend on an animation frame having run since the last move.
    dom.addEventListener('pointerdown', () => {
      this.refreshMouseHover()
      this.pressStart('mouse')
    })
    dom.addEventListener('pointerup', () => {
      this.refreshMouseHover()
      this.pressEnd('mouse')
    })
  }

  /**
   * Raycastable targets: skip anything inside a hidden ancestor (a closed
   * panel's buttons must not swallow rays). Self-invisibility is allowed —
   * exam colliders and hitboxes are deliberately invisible meshes.
   */
  private raycastTargets(): THREE.Object3D[] {
    const list: THREE.Object3D[] = []
    outer: for (const obj of this.targets.keys()) {
      for (let p = obj.parent; p; p = p.parent) {
        if (!p.visible) continue outer
      }
      list.push(obj)
    }
    return list
  }

  private refreshMouseHover(): void {
    if (this.renderer.xr.isPresenting) return
    const ndc = this.isPointerLocked() ? new THREE.Vector2(0, 0) : this.mouseNdc
    this.raycaster.setFromCamera(ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.raycastTargets(), false)
    const obj = hits.length > 0 ? hits[0]!.object : null
    const p = this.pointers.get('mouse')!
    if (obj !== p.hovered) {
      if (p.hovered) this.targets.get(p.hovered)?.onHoverEnd?.()
      if (obj) this.targets.get(obj)?.onHoverStart?.()
      p.hovered = obj
    }
  }

  private lastSelectAt = -1

  /**
   * Is the desktop mouse over an interactive target (or did a select just
   * fire)? A select can rebuild UI and unregister the hovered mesh before the
   * browser's `click` event runs, so the recent-select grace keeps that click
   * from being treated as "empty space" (which would grab the pointer).
   */
  get mouseHovering(): boolean {
    return this.pointers.get('mouse')?.hovered != null || performance.now() - this.lastSelectAt < 350
  }

  register(object: THREE.Object3D, handlers: InteractionHandlers): void {
    this.targets.set(object, handlers)
  }

  unregister(object: THREE.Object3D): void {
    this.targets.delete(object)
    for (const p of this.pointers.values()) {
      if (p.hovered === object) p.hovered = null
      if (p.pressTarget === object) p.pressTarget = null
    }
  }

  /** Per-frame: refresh hover per pointer and fire long-presses. */
  update(): void {
    const targetList = this.raycastTargets()
    let cursorSet = false

    const processRay = (key: string, active: boolean) => {
      const p = this.pointers.get(key)!
      const hits = active ? this.raycaster.intersectObjects(targetList, false) : []
      const top = hits.length > 0 ? hits[0]! : null
      const obj = top?.object ?? null

      if (obj !== p.hovered) {
        if (p.hovered) this.targets.get(p.hovered)?.onHoverEnd?.()
        if (obj) this.targets.get(obj)?.onHoverStart?.()
        p.hovered = obj
      }
      if (top) {
        this.cursor.position.copy(top.point)
        cursorSet = true
      }
      if (
        p.pressTarget &&
        !p.longFired &&
        performance.now() - p.pressAt >= LONG_PRESS_MS &&
        p.hovered === p.pressTarget
      ) {
        p.longFired = true
        this.targets.get(p.pressTarget)?.onLongPress?.()
      }
    }

    if (this.renderer.xr.isPresenting) {
      for (const i of [0, 1]) {
        const c = this.controllers[i]!
        const origin = new THREE.Vector3()
        const dir = new THREE.Vector3(0, 0, -1)
        c.getWorldPosition(origin)
        dir.applyQuaternion(c.getWorldQuaternion(new THREE.Quaternion()))
        this.raycaster.set(origin, dir)
        processRay(`xr${i}`, true)
      }
      processRay('mouse', false)
    } else {
      const ndc = this.isPointerLocked() ? new THREE.Vector2(0, 0) : this.mouseNdc
      this.raycaster.setFromCamera(ndc, this.camera)
      processRay('mouse', true)
      processRay('xr0', false)
      processRay('xr1', false)
    }

    this.cursor.visible = cursorSet
  }

  private pressStart(key: string): void {
    const p = this.pointers.get(key)!
    p.pressTarget = p.hovered
    p.pressAt = performance.now()
    p.longFired = false
  }

  private pressEnd(key: string): void {
    const p = this.pointers.get(key)!
    const target = p.pressTarget
    p.pressTarget = null
    if (!target || p.longFired) return
    if (p.hovered === target) {
      this.lastSelectAt = performance.now()
      this.onAnySelect?.()
      this.targets.get(target)?.onSelect?.()
    }
  }
}
