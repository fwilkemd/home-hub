import * as THREE from 'three'
import type { SimEngine } from '../../sim/engine'
import type { Interactions } from '../interactions'
import { UI, UIPanel } from '../ui'
import type { Text } from 'troika-three-text'

export interface SimClock {
  paused: boolean
  timeScale: number
}

/**
 * Hidden debug panel (long-press the wall clock, or ` on desktop):
 * pause, timeScale presets, current raw vars.
 */
export class DebugPanel {
  private readonly panel: UIPanel
  private varsText: Text | null = null
  private built = false

  constructor(
    private readonly engine: SimEngine,
    interactions: Interactions,
    private readonly clock: SimClock,
    scene: THREE.Scene,
    position: THREE.Vector3,
    facing: THREE.Vector3,
  ) {
    this.panel = new UIPanel(interactions, 0.62, 0.66)
    this.panel.group.position.copy(position)
    this.panel.group.lookAt(facing)
    this.panel.group.visible = false
    scene.add(this.panel.group)
  }

  toggle(): void {
    this.panel.group.visible = !this.panel.group.visible
    if (this.panel.group.visible) this.rebuild()
  }

  /** Refresh raw values once per sim tick (cheap: one Text update). */
  tick(): void {
    if (!this.panel.group.visible || !this.varsText) return
    this.varsText.text = this.varsDump()
    this.varsText.sync()
  }

  private rebuild(): void {
    const p = this.panel
    p.clearContent()
    this.built = true
    const left = -p.w / 2 + 0.04
    const top = p.h / 2
    p.addText('DEBUG', left, top - 0.045, 0.028, UI.warn)

    p.addButton(
      {
        label: this.clock.paused ? 'RESUME' : 'PAUSE',
        w: 0.17,
        h: 0.055,
        fontSize: 0.022,
        onSelect: () => {
          this.clock.paused = !this.clock.paused
          this.rebuild()
        },
      },
      left + 0.085,
      top - 0.115,
    )
    ;[1, 10, 60].forEach((scale, i) => {
      p.addButton(
        {
          label: `${scale}×`,
          w: 0.09,
          h: 0.055,
          fontSize: 0.022,
          active: this.clock.timeScale === scale,
          onSelect: () => {
            this.clock.timeScale = scale
            this.rebuild()
          },
        },
        left + 0.28 + i * 0.105,
        top - 0.115,
      )
    })

    this.varsText = p.addText(this.varsDump(), left, top - 0.17, 0.02, UI.inkDim, {
      anchorY: 'top',
      maxWidth: p.w - 0.08,
      lineHeight: 1.35,
    })
  }

  private varsDump(): string {
    const e = this.engine
    const rows: string[] = [`t=${e.time}s  rhythm=${e.rhythm}  tags=[${[...e.tags].join(',')}]`]
    const names = ['hr', 'sbp', 'dbp', 'map', 'spo2', 'rr', 'tempC']
    rows.push(names.map((n) => `${n}=${e.get(n).toFixed(1)}`).join('  '))
    const custom = (e.scenario.customVars ?? []).map((c) => `${c.name}=${e.get(c.name).toFixed(2)}`)
    if (custom.length > 0) rows.push(custom.join('  '))
    rows.push(`alarms=[${e.alarmedVars().join(',')}]${e.alarmsSilenced ? ' (silenced)' : ''}`)
    if (e.ended) rows.push(`ENDED: ${e.ended.kind} — ${e.ended.label}`)
    return rows.join('\n')
  }
}
