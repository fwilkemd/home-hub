import * as THREE from 'three'
import type { SimEngine } from '../../sim/engine'
import type { LogEntry } from '../../sim/types'
import type { Interactions } from '../interactions'
import type { SoundKit } from '../audio'
import { UI, UIPanel, makeText } from '../ui'

function stamp(t: number): string {
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/**
 * Wall-mounted message feed: nurse messages, order confirmations, results.
 * Newest on top; soft chime + brief head-locked toast on arrival.
 */
export class MessageFeed {
  readonly panel: UIPanel
  private consumed = 0
  private readonly lines: { t: number; from: string; text: string }[] = []
  private readonly toast: { group: THREE.Group; bg: THREE.Mesh; hideAt: number }

  constructor(
    private readonly engine: SimEngine,
    interactions: Interactions,
    private readonly sounds: SoundKit,
    scene: THREE.Scene,
    camera: THREE.Camera,
    position: THREE.Vector3,
  ) {
    this.panel = new UIPanel(interactions, 1.05, 0.92)
    this.panel.group.position.copy(position)
    scene.add(this.panel.group)

    // Head-locked toast (small, brief, per spec §5)
    const group = new THREE.Group()
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.075),
      new THREE.MeshBasicMaterial({ color: UI.panelBg }),
    )
    group.add(bg)
    group.position.set(0, -0.22, -0.75)
    group.visible = false
    camera.add(group)
    this.toast = { group, bg, hideAt: 0 }

    this.render()
  }

  /** Call once per sim tick: pull new feed-worthy log entries. */
  tick(): void {
    const log = this.engine.log
    let changed = false
    for (; this.consumed < log.length; this.consumed++) {
      const entry = log[this.consumed]!
      if (!this.feedWorthy(entry)) continue
      const from = entry.type === 'message' ? (entry.ref ?? 'Nurse') : entry.type === 'result' ? 'Results' : 'System'
      this.lines.unshift({ t: entry.t, from, text: entry.text })
      changed = true
      this.showToast(`${from}: ${entry.text}`)
    }
    if (changed) {
      this.lines.length = Math.min(this.lines.length, 9)
      this.sounds.chime()
      this.render()
    }
  }

  /** Fade the toast out on a real-time clock (call every frame). */
  frame(nowMs: number): void {
    if (this.toast.group.visible && nowMs >= this.toast.hideAt) {
      this.toast.group.visible = false
      const old = this.toast.group.children.find((c) => c.name === 'toast-text')
      if (old) this.toast.group.remove(old)
    }
  }

  private feedWorthy(e: LogEntry): boolean {
    return e.type === 'message' || e.type === 'result' || e.type === 'orderRejected'
  }

  private showToast(text: string): void {
    const old = this.toast.group.children.find((c) => c.name === 'toast-text')
    if (old) this.toast.group.remove(old)
    const t = makeText(text.length > 90 ? text.slice(0, 88) + '…' : text, 0.017, UI.ink, {
      anchorX: 'center',
      anchorY: 'middle',
      maxWidth: 0.4,
      textAlign: 'center',
    })
    t.name = 'toast-text'
    t.position.z = 0.003
    this.toast.group.add(t)
    this.toast.group.visible = true
    this.toast.hideAt = performance.now() + 3500
  }

  private render(): void {
    const p = this.panel
    p.clearContent()
    const left = -p.w / 2 + 0.05
    let y = p.h / 2 - 0.055
    p.addText('MESSAGES', left, y, 0.032, UI.accent)
    y -= 0.075
    if (this.lines.length === 0) {
      p.addText('No messages yet.', left, y, 0.024, UI.inkDim)
    }
    for (const line of this.lines) {
      p.addText(`${stamp(line.t)}  ${line.from}`, left, y, 0.019, UI.inkDim)
      const body = p.addText(line.text, left, y - 0.033, 0.023, UI.ink, { maxWidth: p.w - 0.1, anchorY: 'top' })
      body.position.y = y - 0.026
      y -= 0.092
    }
  }
}

/**
 * Wall-mounted chart panel: patient info, chart note, resulted labs/imaging,
 * order history. Regenerates only when the log grows in a chart-relevant way.
 */
export class ChartPanel {
  readonly panel: UIPanel
  private lastCount = -1

  constructor(
    private readonly engine: SimEngine,
    interactions: Interactions,
    scene: THREE.Scene,
    position: THREE.Vector3,
  ) {
    this.panel = new UIPanel(interactions, 1.05, 1.15)
    this.panel.group.position.copy(position)
    scene.add(this.panel.group)
    this.render()
  }

  tick(): void {
    const count = this.engine.log.filter((l) => l.type === 'order' || l.type === 'result').length
    if (count !== this.lastCount) this.render()
  }

  private render(): void {
    const e = this.engine
    this.lastCount = e.log.filter((l) => l.type === 'order' || l.type === 'result').length
    const p = this.panel
    p.clearContent()
    const left = -p.w / 2 + 0.05
    let y = p.h / 2 - 0.055

    p.addText('CHART', left, y, 0.032, UI.accent)
    y -= 0.07
    const pt = e.scenario.patient
    if (pt) {
      p.addText(`${pt.name} — ${pt.age}y ${pt.sex}, ${pt.weightKg} kg`, left, y, 0.025, UI.ink)
      y -= 0.05
      if (pt.chartNote) {
        const note = p.addText(pt.chartNote, left, y, 0.019, UI.inkDim, { maxWidth: p.w - 0.1, anchorY: 'top' })
        note.position.y = y + 0.008
        y -= 0.15
      }
      if (pt.history.length > 0) {
        p.addText(`Hx: ${pt.history.join(' · ')}`, left, y, 0.019, UI.inkDim, { maxWidth: p.w - 0.1 })
        y -= 0.045
      }
      if (pt.homeMeds.length > 0) {
        p.addText(`Home meds: ${pt.homeMeds.join(' · ')}`, left, y, 0.019, UI.inkDim, { maxWidth: p.w - 0.1 })
        y -= 0.045
      }
    }

    y -= 0.015
    p.addText('RESULTS', left, y, 0.024, UI.accent)
    y -= 0.045
    const results = e.log.filter((l) => l.type === 'result').slice(-4)
    if (results.length === 0) {
      p.addText('— none yet —', left, y, 0.02, UI.inkDim)
      y -= 0.042
    }
    for (const r of results) {
      p.addText(`${stamp(r.t)}  ${r.text}`, left, y, 0.02, UI.ink, { maxWidth: p.w - 0.1 })
      y -= 0.058
    }

    y -= 0.015
    p.addText('ORDER HISTORY', left, y, 0.024, UI.accent)
    y -= 0.045
    const orders = e.log.filter((l) => l.type === 'order').slice(-6)
    if (orders.length === 0) p.addText('— none yet —', left, y, 0.02, UI.inkDim)
    for (const o of orders) {
      p.addText(`${stamp(o.t)}  ${o.text}`, left, y, 0.02, UI.inkDim, { maxWidth: p.w - 0.1 })
      y -= 0.04
    }
  }
}

/** Small floating card that shows the latest exam finding for a few seconds. */
export class ExamCard {
  private readonly panel: UIPanel
  private hideAt = 0

  constructor(interactions: Interactions, scene: THREE.Scene, position: THREE.Vector3, facing: THREE.Vector3) {
    this.panel = new UIPanel(interactions, 0.62, 0.2)
    this.panel.group.position.copy(position)
    this.panel.group.lookAt(facing)
    this.panel.group.visible = false
    scene.add(this.panel.group)
  }

  show(region: string, text: string): void {
    const p = this.panel
    p.clearContent()
    p.addText(`EXAM — ${region.toUpperCase()}`, -p.w / 2 + 0.04, p.h / 2 - 0.04, 0.022, UI.accent)
    const body = p.addText(text, -p.w / 2 + 0.04, p.h / 2 - 0.075, 0.023, UI.ink, {
      maxWidth: p.w - 0.08,
      anchorY: 'top',
    })
    body.position.y = p.h / 2 - 0.07
    p.group.visible = true
    this.hideAt = performance.now() + 8000
  }

  frame(nowMs: number): void {
    if (this.panel.group.visible && nowMs >= this.hideAt) this.panel.group.visible = false
  }

  get group(): THREE.Group {
    return this.panel.group
  }
}
