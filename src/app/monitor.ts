import * as THREE from 'three'
import type { RhythmToken } from '../sim/types'

/**
 * Patient monitor drawn into a single 1024×512 CanvasTexture.
 * Waveforms sweep like a real monitor: only the new columns at the sweep
 * position are drawn each frame, with an erased gap ahead. The numerics
 * column redraws at 1 Hz when new sim values arrive.
 *
 * The renderer knows rhythm *tokens*, never medicine — the scenario decides
 * when the rhythm changes.
 */

const W = 1024
const H = 512
const WAVE_W = 768 // waveform area; numerics live in the right column
const SWEEP_PX_PER_SEC = 140
const GAP_PX = 36
const BG = '#04070a'

const COLORS = {
  ecg: '#3ce06a',
  pleth: '#3ad2e8',
  resp: '#e8d13a',
  bp: '#ff8f4a',
  temp: '#e6e2da',
  label: '#7d8a92',
}

interface Row {
  label: string
  color: string
  yCenter: number
  amp: number
  prevY: number | null
}

export class PatientMonitor {
  readonly texture: THREE.CanvasTexture

  private readonly ctx: CanvasRenderingContext2D
  private vitals: Record<string, number> = {}
  private rhythm: RhythmToken = 'sinus'

  /** Waveform clock in sim-rate seconds (advances with timeScale). */
  private waveClock = 0
  private sweepX = 0

  /** Shared beat scheduler for ECG + pleth. */
  private recentBeats: number[] = [0]
  private nextBeat = 0.6

  private readonly rows: Row[] = [
    { label: 'II', color: COLORS.ecg, yCenter: 90, amp: 62, prevY: null },
    { label: 'PLETH', color: COLORS.pleth, yCenter: 256, amp: 58, prevY: null },
    { label: 'RESP', color: COLORS.resp, yCenter: 420, amp: 50, prevY: null },
  ]

  constructor() {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable')
    this.ctx = ctx

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, W, H)

    this.texture = new THREE.CanvasTexture(canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
  }

  /** Called at 1 Hz with fresh sim values; redraws the numerics column. */
  setVitals(vitals: Record<string, number>, rhythm: RhythmToken): void {
    this.vitals = vitals
    this.rhythm = rhythm
    this.drawNumerics()
    this.texture.needsUpdate = true
  }

  /** Called every render frame; dt is in sim-rate seconds. */
  advance(dt: number): void {
    const ctx = this.ctx
    const targetX = this.sweepX + dt * SWEEP_PX_PER_SEC
    const secPerPx = 1 / SWEEP_PX_PER_SEC

    let x = Math.floor(this.sweepX)
    const xEnd = Math.floor(targetX)

    for (; x < xEnd; x++) {
      const col = x % WAVE_W
      if (col === 0) for (const row of this.rows) row.prevY = null

      // Erase the gap ahead of the sweep (wrapping inside the waveform area).
      for (let g = 0; g < GAP_PX; g++) {
        ctx.fillStyle = BG
        ctx.fillRect((col + g) % WAVE_W, 0, 1, H)
      }

      const t = this.waveClock + (x - this.sweepX) * secPerPx
      this.scheduleBeats(t)

      this.plot(this.rows[0]!, col, this.ecgSample(t))
      this.plot(this.rows[1]!, col, this.plethSample(t))
      this.plot(this.rows[2]!, col, this.respSample(t))
    }

    this.sweepX = targetX % WAVE_W
    this.waveClock += dt
    this.drawRowLabels()
    this.texture.needsUpdate = true
  }

  private plot(row: Row, col: number, value: number): void {
    const y = row.yCenter - value * row.amp
    const ctx = this.ctx
    ctx.strokeStyle = row.color
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(col === 0 || row.prevY === null ? col : col - 1, row.prevY ?? y)
    ctx.lineTo(col, y)
    ctx.stroke()
    row.prevY = y
  }

  private drawRowLabels(): void {
    const ctx = this.ctx
    ctx.font = '600 20px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (const row of this.rows) {
      ctx.fillStyle = COLORS.label
      ctx.fillText(row.label, 10, row.yCenter - row.amp - 26)
    }
  }

  // ---- beat scheduling ------------------------------------------------

  private scheduleBeats(t: number): void {
    while (t >= this.nextBeat) {
      this.recentBeats.push(this.nextBeat)
      if (this.recentBeats.length > 4) this.recentBeats.shift()
      const hr = Math.max(this.vitals.hr ?? 60, 5)
      let interval = 60 / hr
      if (this.rhythm === 'afib') {
        // Irregularly irregular: jitter each R-R interval.
        interval *= 0.65 + 0.7 * this.pseudoRandom(this.nextBeat)
      }
      this.nextBeat += interval
    }
  }

  /** Deterministic hash-noise so the waveform needs no stateful RNG. */
  private pseudoRandom(x: number): number {
    const s = Math.sin(x * 127.1 + 311.7) * 43758.5453
    return s - Math.floor(s)
  }

  // ---- waveform synthesis ---------------------------------------------

  private ecgSample(t: number): number {
    switch (this.rhythm) {
      case 'vf': {
        // Chaotic coarse oscillation, no organized beats.
        return (
          0.45 * Math.sin(t * 2 * Math.PI * 4.3 + 2.1 * Math.sin(t * 1.7)) +
          0.3 * Math.sin(t * 2 * Math.PI * 6.7 + 1.3 * Math.sin(t * 2.9)) +
          0.15 * (this.pseudoRandom(Math.floor(t * 30)) - 0.5)
        )
      }
      case 'asystole':
        return 0.02 * Math.sin(t * 0.7) + 0.01 * (this.pseudoRandom(Math.floor(t * 8)) - 0.5)
      default: {
        let v = 0
        for (const beat of this.recentBeats) v += this.beatShape(t - beat)
        return v
      }
    }
  }

  /** One beat complex as summed gaussian bumps; shape depends on rhythm token. */
  private beatShape(rel: number): number {
    if (rel < -0.4 || rel > 0.6) return 0
    const g = (mu: number, sigma: number, amp: number) =>
      amp * Math.exp(-((rel - mu) ** 2) / (2 * sigma * sigma))
    switch (this.rhythm) {
      case 'vt':
        // Fast wide complexes: broad R and deep broad S, no P, minimal T.
        return g(0, 0.055, 0.95) + g(0.1, 0.06, -0.55)
      case 'svt':
      case 'afib':
        // Narrow complex, no P wave.
        return g(-0.028, 0.012, -0.1) + g(0, 0.014, 1) + g(0.03, 0.013, -0.2) + g(0.2, 0.05, 0.28)
      default: // sinus
        return (
          g(-0.17, 0.026, 0.13) + // P
          g(-0.028, 0.011, -0.11) + // Q
          g(0, 0.013, 1) + // R
          g(0.03, 0.012, -0.2) + // S
          g(0.2, 0.05, 0.3) // T
        )
    }
  }

  private plethSample(t: number): number {
    // No organized perfusing beats to follow in vf/asystole.
    if (this.rhythm === 'vf' || this.rhythm === 'asystole') {
      return -0.85 + 0.02 * Math.sin(t * 3)
    }
    let v = 0
    for (const beat of this.recentBeats) {
      const rel = t - beat - 0.15
      if (rel <= 0 || rel > 1.5) continue
      const tau = 0.11
      v += (rel / tau) * Math.exp(1 - rel / tau) // systolic upstroke + decay
      v += 0.22 * Math.exp(-((rel - 0.38) ** 2) / (2 * 0.07 * 0.07)) // dicrotic bump
    }
    return Math.min(v, 1.6) - 0.85
  }

  private respSample(t: number): number {
    const rr = Math.max(this.vitals.rr ?? 12, 0.5)
    return 0.8 * Math.sin(2 * Math.PI * (rr / 60) * t)
  }

  // ---- numerics column --------------------------------------------------

  private drawNumerics(): void {
    const ctx = this.ctx
    const x0 = WAVE_W
    ctx.fillStyle = BG
    ctx.fillRect(x0, 0, W - x0, H)
    ctx.fillStyle = '#16222a'
    ctx.fillRect(x0, 0, 2, H)

    const v = this.vitals
    const fmt = (n: number | undefined, digits = 0) =>
      n === undefined || Number.isNaN(n) ? '--' : n.toFixed(digits)

    const block = (
      y: number,
      label: string,
      value: string,
      color: string,
      sub?: string,
    ) => {
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.font = '600 19px monospace'
      ctx.fillStyle = COLORS.label
      ctx.fillText(label, x0 + 20, y)
      ctx.font = '700 58px monospace'
      ctx.fillStyle = color
      ctx.fillText(value, x0 + 20, y + 24)
      if (sub) {
        ctx.font = '600 22px monospace'
        ctx.fillStyle = color
        ctx.fillText(sub, x0 + 20, y + 84)
      }
    }

    block(14, `HR  ${this.rhythm.toUpperCase()}`, fmt(v.hr), COLORS.ecg)
    block(124, 'NIBP  mmHg', `${fmt(v.sbp)}/${fmt(v.dbp)}`, COLORS.bp, `(${fmt(v.map)})`)
    block(258, 'SpO2  %', fmt(v.spo2), COLORS.pleth)
    block(368, 'RR  /min', fmt(v.rr), COLORS.resp)

    ctx.font = '600 19px monospace'
    ctx.fillStyle = COLORS.label
    ctx.fillText('TEMP  °C', x0 + 20, 462)
    ctx.font = '700 34px monospace'
    ctx.fillStyle = COLORS.temp
    ctx.fillText(fmt(v.tempC, 1), x0 + 150, 456)
  }
}
