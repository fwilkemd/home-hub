import * as THREE from 'three'
import { Text } from 'troika-three-text'
// Bundled font so in-VR text never fetches from a CDN (must work offline).
import uiFontUrl from './assets/ui-font.ttf?url'
import type { Interactions } from './interactions'

export const UI = {
  panelBg: 0x101a20,
  panelEdge: 0x27404c,
  button: 0x1e313c,
  buttonHover: 0x2f4d5e,
  buttonActive: 0x3a6a80,
  buttonDisabled: 0x141d22,
  ink: 0xe8f1f5,
  inkDim: 0x8aa0ab,
  accent: 0x3ad2e8,
  ok: 0x3ce06a,
  warn: 0xffb54a,
  danger: 0xff6b57,
} as const

export function makeText(
  str: string,
  fontSize: number,
  color: number,
  opts: Partial<Pick<Text, 'anchorX' | 'anchorY' | 'maxWidth' | 'textAlign' | 'lineHeight'>> = {},
): Text {
  const t = new Text()
  t.text = str
  t.font = uiFontUrl
  t.fontSize = fontSize
  t.color = color
  t.anchorX = opts.anchorX ?? 'left'
  t.anchorY = opts.anchorY ?? 'middle'
  if (opts.maxWidth !== undefined) t.maxWidth = opts.maxWidth
  if (opts.textAlign !== undefined) t.textAlign = opts.textAlign
  if (opts.lineHeight !== undefined) t.lineHeight = opts.lineHeight
  t.sync()
  return t
}

export interface ButtonSpec {
  label: string
  sub?: string
  w: number
  h: number
  enabled?: boolean
  active?: boolean
  color?: number
  labelColor?: number
  fontSize?: number
  onSelect?: () => void
}

export class UIButton {
  readonly group = new THREE.Group()
  readonly hitMesh: THREE.Mesh
  private readonly material: THREE.MeshBasicMaterial
  private readonly baseColor: number

  constructor(
    private readonly interactions: Interactions,
    spec: ButtonSpec,
  ) {
    const enabled = spec.enabled ?? true
    this.baseColor = !enabled
      ? UI.buttonDisabled
      : spec.active
        ? UI.buttonActive
        : (spec.color ?? UI.button)
    this.material = new THREE.MeshBasicMaterial({ color: this.baseColor })
    this.hitMesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), this.material)
    this.hitMesh.name = `btn:${spec.label}`
    this.group.add(this.hitMesh)

    const labelColor = !enabled ? UI.inkDim : (spec.labelColor ?? UI.ink)
    const size = spec.fontSize ?? 0.026
    const label = makeText(spec.label, size, labelColor, {
      anchorX: 'center',
      anchorY: 'middle',
      maxWidth: spec.w - 0.02,
      textAlign: 'center',
    })
    label.position.set(0, spec.sub ? spec.h * 0.17 : 0, 0.004)
    this.group.add(label)

    if (spec.sub) {
      const sub = makeText(spec.sub, size * 0.62, enabled ? UI.inkDim : UI.warn, {
        anchorX: 'center',
        anchorY: 'middle',
        maxWidth: spec.w - 0.02,
        textAlign: 'center',
      })
      sub.position.set(0, -spec.h * 0.24, 0.004)
      this.group.add(sub)
    }

    if (enabled && spec.onSelect) {
      this.interactions.register(this.hitMesh, {
        onSelect: spec.onSelect,
        onHoverStart: () => this.material.color.setHex(UI.buttonHover),
        onHoverEnd: () => this.material.color.setHex(this.baseColor),
      })
    }
  }

  dispose(): void {
    this.interactions.unregister(this.hitMesh)
    for (const child of this.group.children) {
      if (child instanceof Text) child.dispose()
    }
    this.hitMesh.geometry.dispose()
    this.material.dispose()
  }
}

/**
 * Flat opaque panel with troika text and buttons. Content is regenerated only
 * when it changes (perf budget), via clearContent() + re-add.
 */
export class UIPanel {
  readonly group = new THREE.Group()
  private readonly content = new THREE.Group()
  private readonly buttons: UIButton[] = []
  private readonly texts: Text[] = []

  constructor(
    private readonly interactions: Interactions,
    readonly w: number,
    readonly h: number,
  ) {
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: UI.panelBg }))
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.012, h + 0.012),
      new THREE.MeshBasicMaterial({ color: UI.panelEdge }),
    )
    edge.position.z = -0.002
    this.group.add(edge, bg, this.content)
  }

  /** Add text at panel-local coords (origin center, +y up); returns the Text. */
  addText(
    str: string,
    x: number,
    y: number,
    fontSize: number,
    color: number,
    opts: Parameters<typeof makeText>[3] = {},
  ): Text {
    const t = makeText(str, fontSize, color, opts)
    t.position.set(x, y, 0.004)
    this.content.add(t)
    this.texts.push(t)
    return t
  }

  addButton(spec: ButtonSpec, x: number, y: number): UIButton {
    const b = new UIButton(this.interactions, spec)
    b.group.position.set(x, y, 0.004)
    this.content.add(b.group)
    this.buttons.push(b)
    return b
  }

  clearContent(): void {
    for (const b of this.buttons) b.dispose()
    this.buttons.length = 0
    for (const t of this.texts) t.dispose()
    this.texts.length = 0
    this.content.clear()
  }
}
