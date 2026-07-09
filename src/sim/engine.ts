import { gaussian, mulberry32 } from './rng'
import {
  ENGINE_CONTINUOUS_VARS,
  type RhythmToken,
  type ScenarioData,
  type TickSample,
} from './types'

/**
 * Generic physical/display bounds and measurement-noise amplitudes for the
 * engine-default variables. These are instrument ranges, not clinical logic —
 * scenarios own all clinical meaning.
 */
const VAR_DEFAULTS: Record<string, { min: number; max: number; noiseAmp: number }> = {
  hr: { min: 0, max: 300, noiseAmp: 1.2 },
  sbp: { min: 0, max: 300, noiseAmp: 2.0 },
  dbp: { min: 0, max: 200, noiseAmp: 1.5 },
  spo2: { min: 0, max: 100, noiseAmp: 0.4 },
  rr: { min: 0, max: 80, noiseAmp: 0.6 },
  tempC: { min: 20, max: 45, noiseAmp: 0.03 },
}

interface VarState {
  /** Deterministic drift state; noise is applied on top each tick, not accumulated. */
  base: number
  setpoint: number | null
  ratePerMin: number
  noiseAmp: number
  min: number
  max: number
  /** Displayed value: clamp(base + effects + noise). */
  value: number
}

export interface SimEngineOptions {
  seed?: number
  /** Scales noise amplitudes; 0 disables noise (used by tests). */
  noiseScale?: number
}

/**
 * The simulation core. Fixed 1 Hz tick, driven externally by an accumulator
 * (render loop or headless runner), so both environments behave identically.
 */
export class SimEngine {
  readonly scenario: ScenarioData
  readonly history: TickSample[] = []
  /** Sim time in seconds. */
  time = 0

  private readonly rand: () => number
  private readonly noiseScale: number
  private readonly vars = new Map<string, VarState>()
  private rhythmValue: RhythmToken

  constructor(scenario: ScenarioData, opts: SimEngineOptions = {}) {
    this.scenario = scenario
    this.rand = mulberry32(opts.seed ?? 1)
    this.noiseScale = opts.noiseScale ?? 1

    for (const name of ENGINE_CONTINUOUS_VARS) {
      const initial = scenario.initial.vitals[name]
      if (initial === undefined) {
        throw new Error(`Scenario "${scenario.id}" is missing initial vitals.${name}`)
      }
      const d = VAR_DEFAULTS[name] ?? { min: -Infinity, max: Infinity, noiseAmp: 0 }
      const drift = scenario.drift?.[name]
      this.vars.set(name, {
        base: initial,
        setpoint: drift?.setpoint ?? null,
        ratePerMin: drift?.ratePerMin ?? 0,
        noiseAmp: d.noiseAmp,
        min: d.min,
        max: d.max,
        value: clamp(initial, d.min, d.max),
      })
    }

    for (const cv of scenario.customVars ?? []) {
      const drift = scenario.drift?.[cv.name]
      this.vars.set(cv.name, {
        base: cv.initial,
        setpoint: drift?.setpoint ?? cv.setpoint ?? null,
        ratePerMin: drift?.ratePerMin ?? cv.ratePerMin ?? 0,
        noiseAmp: 0,
        min: -Infinity,
        max: Infinity,
        value: cv.initial,
      })
    }

    this.rhythmValue = scenario.initial.vitals.rhythm ?? 'sinus'
    this.recordSample()
  }

  /** Advance the simulation by exactly one second. */
  tick(): void {
    this.time += 1
    for (const v of this.vars.values()) {
      // Drift toward setpoint, never overshooting.
      if (v.setpoint !== null && v.ratePerMin !== 0) {
        const step = Math.abs(v.ratePerMin) / 60
        const delta = v.setpoint - v.base
        v.base += Math.sign(delta) * Math.min(step, Math.abs(delta))
      }
      // Effect envelopes sum here from M2 onward.
      const effects = 0
      const noise = v.noiseAmp > 0 && this.noiseScale > 0
        ? gaussian(this.rand) * v.noiseAmp * this.noiseScale
        : 0
      v.value = clamp(v.base + effects + noise, v.min, v.max)
    }
    this.recordSample()
  }

  /** Displayed (clamped, noisy) value of a variable, including derived `map`. */
  get(name: string): number {
    if (name === 'map') {
      return (this.get('sbp') + 2 * this.get('dbp')) / 3
    }
    const v = this.vars.get(name)
    if (!v) throw new Error(`Unknown sim variable "${name}"`)
    return v.value
  }

  get rhythm(): RhythmToken {
    return this.rhythmValue
  }

  /** Engine-default vitals plus derived map — what the monitor displays. */
  snapshot(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const name of ENGINE_CONTINUOUS_VARS) out[name] = this.get(name)
    out.map = this.get('map')
    return out
  }

  private recordSample(): void {
    const values: Record<string, number> = {}
    for (const [name] of this.vars) values[name] = this.get(name)
    values.map = this.get('map')
    this.history.push({ t: this.time, values, rhythm: this.rhythmValue })
  }
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x))
}
