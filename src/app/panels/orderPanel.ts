import * as THREE from 'three'
import type { SimEngine } from '../../sim/engine'
import type { Interactions } from '../interactions'
import type { SoundKit } from '../audio'
import { UI, UIPanel } from '../ui'

/**
 * The bedside order tablet, enlarged into a floating panel when selected.
 * Tabs come from the catalog's `category` values; buttons grey out when
 * `requires` tags are unmet (showing the missing tag); running infusions are
 * listed with a stop button. Content regenerates only when relevant sim state
 * changes.
 */
export class OrderPanel {
  readonly panel: UIPanel
  private open = false
  private activeTab: string
  private readonly categories: string[]
  private lastSignature = ''

  constructor(
    private readonly engine: SimEngine,
    private readonly interactions: Interactions,
    private readonly sounds: SoundKit,
    tabletScreen: THREE.Mesh,
    scene: THREE.Scene,
    facing: THREE.Vector3,
  ) {
    this.categories = [...new Set([...engine.catalog.values()].map((i) => i.category))]
    this.activeTab = this.categories[0] ?? 'Orders'

    this.panel = new UIPanel(interactions, 0.95, 0.8)
    this.panel.group.position.set(1.05, 1.45, -0.95)
    this.panel.group.lookAt(facing.x, facing.y, facing.z)
    this.panel.group.visible = false
    scene.add(this.panel.group)

    const tabletMat = tabletScreen.material as THREE.MeshBasicMaterial
    interactions.register(tabletScreen, {
      onSelect: () => this.toggle(),
      onHoverStart: () => tabletMat.color.setHex(0x1e4252),
      onHoverEnd: () => tabletMat.color.setHex(0x10222b),
    })
  }

  toggle(): void {
    this.open = !this.open
    this.panel.group.visible = this.open
    if (this.open) {
      this.lastSignature = ''
      this.tick()
    }
  }

  /** Call once per sim tick; rebuilds content only when it would change. */
  tick(): void {
    if (!this.open) return
    const e = this.engine
    const infusions = e.activeInfusions()
    const signature = [
      this.activeTab,
      [...e.tags].join(','),
      infusions.map((i) => i.orderNo).join(','),
      e.ended ? 'ended' : '',
    ].join('|')
    if (signature === this.lastSignature) return
    this.lastSignature = signature
    this.rebuild()
  }

  private rebuild(): void {
    const p = this.panel
    p.clearContent()
    const e = this.engine
    const left = -p.w / 2 + 0.05
    const top = p.h / 2

    p.addText('ORDERS', left, top - 0.05, 0.034, UI.accent)
    p.addButton({ label: '×', w: 0.07, h: 0.055, fontSize: 0.036, onSelect: () => this.toggle() }, p.w / 2 - 0.06, top - 0.05)

    // Category tabs
    let tx = left + 0.08
    for (const cat of this.categories) {
      const w = 0.055 + cat.length * 0.0125
      p.addButton(
        {
          label: cat,
          w,
          h: 0.055,
          fontSize: 0.022,
          active: cat === this.activeTab,
          onSelect: () => {
            this.activeTab = cat
            this.lastSignature = ''
            this.sounds.click()
            this.tick()
          },
        },
        tx + w / 2 - 0.06,
        top - 0.125,
      )
      tx += w + 0.018
    }

    // Intervention buttons for the active tab
    const items = [...e.catalog.values()].filter((i) => i.category === this.activeTab)
    const bw = 0.41
    const bh = 0.088
    items.forEach((item, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const missing = e.missingTags(item.id)
      const gated = missing.length > 0
      p.addButton(
        {
          label: item.label,
          sub: gated ? `needs: ${missing.join(', ')}` : item.busySec > 0 ? `~${item.busySec}s` : undefined,
          w: bw,
          h: bh,
          fontSize: 0.0215,
          enabled: !gated && !e.ended,
          onSelect: () => {
            const r = e.order(item.id)
            if (r.ok) this.sounds.click()
            this.lastSignature = ''
          },
        },
        left + bw / 2 + col * (bw + 0.025),
        top - 0.21 - row * (bh + 0.014),
      )
    })

    // Running infusions with stop buttons
    const infusions = e.activeInfusions()
    const sectionY = top - 0.21 - 2 * (bh + 0.014) - 0.035
    p.addText('RUNNING', left, sectionY, 0.022, UI.inkDim)
    if (infusions.length === 0) {
      p.addText('— none —', left + 0.14, sectionY, 0.022, UI.inkDim)
    }
    infusions.forEach((inf, i) => {
      const y = sectionY - 0.055 - i * 0.062
      p.addText(inf.label, left, y, 0.023, UI.ok, { maxWidth: 0.62 })
      p.addButton(
        {
          label: 'STOP',
          w: 0.14,
          h: 0.05,
          fontSize: 0.021,
          color: 0x4a2018,
          labelColor: UI.danger,
          onSelect: () => {
            this.engine.stopInfusion(inf.orderNo)
            this.sounds.click()
            this.lastSignature = ''
          },
        },
        p.w / 2 - 0.13,
        y,
      )
    })
  }
}
