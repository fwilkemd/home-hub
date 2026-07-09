import { gaussian, mulberry32 } from './rng'
import {
  ENGINE_CONTINUOUS_VARS,
  type ActiveInfusion,
  type CatalogData,
  type Condition,
  type EndpointResult,
  type EventAction,
  type EffectSpec,
  type InterventionDef,
  type LogEntry,
  type LogEntryType,
  type OrderResult,
  type RhythmToken,
  type ScenarioData,
  type TickSample,
} from './types'

/**
 * Generic instrument display ranges and measurement-noise amplitudes for the
 * engine-default variables — not clinical logic; scenarios own all clinical
 * meaning.
 */
const VAR_DEFAULTS: Record<string, { min: number; max: number; noiseAmp: number }> = {
  hr: { min: 0, max: 300, noiseAmp: 1.2 },
  sbp: { min: 0, max: 300, noiseAmp: 2.0 },
  dbp: { min: 0, max: 200, noiseAmp: 1.5 },
  spo2: { min: 0, max: 100, noiseAmp: 0.4 },
  rr: { min: 0, max: 80, noiseAmp: 0.6 },
  tempC: { min: 20, max: 45, noiseAmp: 0.03 },
}

const DEFAULT_BOLUS_DURATION_SEC = 300
const DEFAULT_DECAY_SEC = 120

interface VarState {
  /** Deterministic drift state; effects and noise are applied on top each tick. */
  base: number
  setpoint: number | null
  ratePerMin: number
  noiseAmp: number
  min: number
  max: number
  /** Displayed value: clamp(base + effects + noise). */
  value: number
}

/**
 * One running piecewise-linear envelope on a continuous var, or a scheduled
 * discrete `set`. Times are absolute sim seconds.
 */
interface ActiveEffect {
  spec: EffectSpec
  t0: number
  orderNo?: number
  /** Infusions hold indefinitely until stopped. */
  infusion: boolean
  stopT: number | null
  stopAmp: number
  discreteApplied: boolean
}

interface PendingOrder {
  orderNo: number
  def: InterventionDef
  activeAt: number
}

interface PendingResult {
  orderNo: number
  def: InterventionDef
  dueAt: number
}

/** Compiled condition with per-leaf sustain counters. */
interface Evaluator {
  step(read: (name: string) => number | string): boolean
}

function compileCondition(cond: Condition): Evaluator {
  if ('all' in cond) {
    const subs = cond.all.map(compileCondition)
    return {
      step(read) {
        // Evaluate every leaf each tick so sustain counters keep counting.
        let ok = true
        for (const s of subs) if (!s.step(read)) ok = false
        return ok
      },
    }
  }
  let sustained = 0
  const need = cond.sustainSec ?? 0
  return {
    step(read) {
      const actual = read(cond.var)
      let raw: boolean
      if (typeof actual === 'string' || typeof cond.value === 'string') {
        raw = cond.op === '==' && String(actual) === String(cond.value)
      } else {
        raw =
          cond.op === '<' ? actual < cond.value
          : cond.op === '<=' ? actual <= cond.value
          : cond.op === '>' ? actual > cond.value
          : cond.op === '>=' ? actual >= cond.value
          : actual === cond.value
      }
      sustained = raw ? sustained + 1 : 0
      // sustainSec 120 → true after 120 consecutive satisfied ticks.
      return sustained >= Math.max(need, 1)
    },
  }
}

export interface SimEngineOptions {
  seed?: number
  /** Scales noise amplitudes; 0 disables noise (used by tests). */
  noiseScale?: number
}

/**
 * The simulation core. Fixed 1 Hz tick, driven externally by an accumulator
 * (render loop or headless runner), so both environments behave identically.
 * The only inputs are ordered interventions (plus stop-infusion); nothing
 * else mutates sim state from outside.
 */
export class SimEngine {
  readonly scenario: ScenarioData
  readonly catalog: Map<string, InterventionDef>
  readonly history: TickSample[] = []
  readonly log: LogEntry[] = []
  readonly seed: number
  /** Sim time in seconds. */
  time = 0
  ended: EndpointResult | null = null

  private readonly rand: () => number
  private readonly noiseScale: number
  private readonly vars = new Map<string, VarState>()
  private rhythmValue: RhythmToken
  private readonly grantedTags = new Set<string>()

  private orderCounter = 0
  private readonly pendingOrders: PendingOrder[] = []
  private readonly pendingResults: PendingResult[] = []
  private readonly effects: ActiveEffect[] = []
  private readonly infusions = new Map<number, ActiveInfusion>()

  private readonly eventEvals: { id: string; eval: Evaluator; fired: boolean; repeatable: boolean }[]
  private readonly endpointEvals: { id: string; eval: Evaluator }[]
  private readonly examFindings: Record<string, { when?: Condition; text: string }[]>

  /** Alarm state per alarmed var. */
  private readonly alarmActive = new Set<string>()
  private readonly alarmRecovery = new Map<string, number>()
  private silencedUntil = -1

  constructor(scenario: ScenarioData, catalog?: CatalogData, opts: SimEngineOptions = {}) {
    this.scenario = scenario
    this.catalog = new Map((catalog?.interventions ?? []).map((i) => [i.id, i]))
    this.seed = opts.seed ?? 1
    this.rand = mulberry32(this.seed)
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
    for (const tag of scenario.initial.grants ?? []) this.grantedTags.add(tag)

    this.eventEvals = (scenario.events ?? []).map((e) => ({
      id: e.id,
      eval: compileCondition(e.trigger.when),
      fired: false,
      repeatable: e.repeatable ?? false,
    }))
    this.endpointEvals = (scenario.endpoints ?? [])
      .filter((e) => e.when)
      .map((e) => ({ id: e.id, eval: compileCondition(e.when!) }))
    this.examFindings = Object.fromEntries(
      Object.entries(scenario.exam ?? {}).map(([region, list]) => [region, [...list]]),
    )

    this.recordSample()
  }

  // ---- inputs (the app's only way to change sim state) ----------------------

  /** Place an order from the interventions catalog. */
  order(interventionId: string): OrderResult {
    if (this.ended) return { ok: false }
    const def = this.catalog.get(interventionId)
    if (!def) throw new Error(`Unknown intervention "${interventionId}"`)

    const missing = def.requires.filter((tag) => !this.grantedTags.has(tag))
    if (missing.length > 0) {
      this.append('orderRejected', `${def.label} — requires: ${missing.join(', ')}`, def.id)
      return { ok: false, missing }
    }

    const orderNo = ++this.orderCounter
    this.append('order', def.label, def.id, orderNo)
    if (def.onOrderMessage) this.append('message', def.onOrderMessage, 'Nurse', orderNo)

    this.pendingOrders.push({ orderNo, def, activeAt: this.time + def.busySec })
    if ((def.type === 'lab' || def.type === 'imaging') && def.resultText !== undefined) {
      this.pendingResults.push({ orderNo, def, dueAt: this.time + (def.resultDelaySec ?? 0) })
    }
    return { ok: true, orderNo }
  }

  /** Stop a running infusion; its effects decay from their current amplitude. */
  stopInfusion(orderNo: number): boolean {
    const inf = this.infusions.get(orderNo)
    if (!inf || this.ended) return false
    for (const fx of this.effects) {
      if (fx.orderNo === orderNo && fx.infusion && fx.stopT === null) {
        fx.stopAmp = this.effectAmplitude(fx) // capture before stopT flips the branch
        fx.stopT = this.time
      }
    }
    this.infusions.delete(orderNo)
    this.append('infusionStopped', inf.label, inf.interventionId, orderNo)
    this.append('message', `Stopping ${inf.label}.`, 'Nurse', orderNo)
    return true
  }

  /** Point at a patient region; returns the first matching finding. */
  examine(region: string): string {
    const findings = this.examFindings[region] ?? []
    let text = 'Nothing remarkable (placeholder).'
    for (const f of findings) {
      if (!f.when || compileCondition(f.when).step((n) => this.getRaw(n))) {
        text = f.text
        break
      }
    }
    this.append('exam', `${region}: ${text}`, region)
    return text
  }

  /** Silence audible alarms for `sec` sim-seconds (monitor silence button). */
  silenceAlarms(sec = 120): void {
    this.silencedUntil = this.time + sec
    this.append('alarmSilenced', `Alarms silenced ${sec}s`)
  }

  // ---- tick -------------------------------------------------------------------

  /** Advance the simulation by exactly one second. No-op once ended. */
  tick(): void {
    if (this.ended) return
    this.time += 1

    // Activate orders whose nurse task completed
    for (let i = this.pendingOrders.length - 1; i >= 0; i--) {
      const p = this.pendingOrders[i]!
      if (p.activeAt > this.time) continue
      this.pendingOrders.splice(i, 1)
      this.activateOrder(p)
    }

    // Post due lab/imaging results
    for (let i = this.pendingResults.length - 1; i >= 0; i--) {
      const r = this.pendingResults[i]!
      if (r.dueAt > this.time) continue
      this.pendingResults.splice(i, 1)
      this.append('result', `${r.def.label}: ${this.renderTemplate(r.def.resultText ?? '')}`, r.def.id, r.orderNo)
    }

    // Discrete effects apply their `set` at onset
    for (const fx of this.effects) {
      if (fx.spec.set !== undefined && !fx.discreteApplied && this.time >= fx.t0 + fx.spec.onsetSec) {
        fx.discreteApplied = true
        this.setDiscrete(fx.spec.var, fx.spec.set)
      }
    }

    // Drift → effects → noise → clamp, then derived vars
    for (const [name, v] of this.vars) {
      if (v.setpoint !== null && v.ratePerMin !== 0) {
        const step = Math.abs(v.ratePerMin) / 60
        const delta = v.setpoint - v.base
        v.base += Math.sign(delta) * Math.min(step, Math.abs(delta))
      }
      const effectSum = this.effectSumFor(name)
      const noise =
        v.noiseAmp > 0 && this.noiseScale > 0 ? gaussian(this.rand) * v.noiseAmp * this.noiseScale : 0
      v.value = clamp(v.base + effectSum + noise, v.min, v.max)
    }

    // Drop expired envelopes
    for (let i = this.effects.length - 1; i >= 0; i--) {
      if (this.effectExpired(this.effects[i]!)) this.effects.splice(i, 1)
    }

    this.evaluateAlarms()
    this.evaluateEvents()
    this.evaluateEndpoints()

    if (!this.ended && this.scenario.timeLimitSec && this.time >= this.scenario.timeLimitSec) {
      this.ended = { id: 'time-limit', kind: 'timeout', label: 'Time limit reached', atSec: this.time }
      this.append('endpoint', 'Time limit reached', 'time-limit')
    }

    this.recordSample()
  }

  // ---- reads --------------------------------------------------------------------

  /** Sum of active envelope contributions targeting a variable right now. */
  private effectSumFor(name: string): number {
    let sum = 0
    for (const fx of this.effects) {
      if (fx.spec.var === name && fx.spec.delta !== undefined) sum += this.effectAmplitude(fx)
    }
    return sum
  }

  /**
   * Displayed (clamped, noisy) value of a variable, including derived `map`.
   * `map` is derived from sbp/dbp each read, plus any effects that target
   * `map` directly (the content contract allows effects on any var).
   */
  get(name: string): number {
    if (name === 'map') {
      return (this.get('sbp') + 2 * this.get('dbp')) / 3 + this.effectSumFor('map')
    }
    const v = this.vars.get(name)
    if (!v) throw new Error(`Unknown sim variable "${name}"`)
    return v.value
  }

  /** Like get(), but resolves `rhythm` to its token (for conditions/templates). */
  getRaw(name: string): number | string {
    return name === 'rhythm' ? this.rhythmValue : this.get(name)
  }

  get rhythm(): RhythmToken {
    return this.rhythmValue
  }

  get tags(): ReadonlySet<string> {
    return this.grantedTags
  }

  missingTags(interventionId: string): string[] {
    const def = this.catalog.get(interventionId)
    if (!def) return []
    return def.requires.filter((t) => !this.grantedTags.has(t))
  }

  activeInfusions(): ActiveInfusion[] {
    return [...this.infusions.values()]
  }

  /** Alarmed variables right now (limit breached). */
  alarmedVars(): string[] {
    return [...this.alarmActive]
  }

  /** True when an active alarm should be making noise (not silenced). */
  alarmsAudible(): boolean {
    return this.alarmActive.size > 0 && this.time >= this.silencedUntil
  }

  get alarmsSilenced(): boolean {
    return this.time < this.silencedUntil
  }

  /** Engine-default vitals plus derived map — what the monitor displays. */
  snapshot(): Record<string, number> {
    const out: Record<string, number> = {}
    for (const name of ENGINE_CONTINUOUS_VARS) out[name] = this.get(name)
    out.map = this.get('map')
    return out
  }

  exportSession() {
    return {
      scenarioId: this.scenario.id,
      scenarioTitle: this.scenario.title,
      seed: this.seed,
      endedAtSec: this.ended?.atSec ?? null,
      endpoint: this.ended,
      log: this.log,
      history: this.history,
    }
  }

  // ---- internals -------------------------------------------------------------------

  private activateOrder(p: PendingOrder): void {
    for (const tag of p.def.grants) this.grantedTags.add(tag)
    for (const spec of p.def.effects) {
      this.effects.push({
        spec,
        // Envelope clock starts when the nurse task completes, even if the
        // activating tick lands slightly after.
        t0: p.activeAt,
        orderNo: p.orderNo,
        infusion: p.def.type === 'infusion',
        stopT: null,
        stopAmp: 0,
        discreteApplied: false,
      })
    }
    if (p.def.type === 'infusion') {
      this.infusions.set(p.orderNo, {
        orderNo: p.orderNo,
        interventionId: p.def.id,
        label: p.def.label,
        startedAt: this.time,
      })
    }
    this.append('orderActive', `${p.def.label} — in effect`, p.def.id, p.orderNo)
    if (p.def.busySec > 0 && p.def.type === 'action') {
      this.append('message', `${p.def.label} — done.`, 'Nurse', p.orderNo)
    }
  }

  /** Piecewise-linear envelope: 0 → ramp → hold → linear decay → 0. */
  private effectAmplitude(fx: ActiveEffect): number {
    const spec = fx.spec
    if (spec.delta === undefined) return 0
    const onset = fx.t0 + spec.onsetSec
    const peak = fx.t0 + Math.max(spec.peakSec ?? spec.onsetSec, spec.onsetSec)
    const decay = spec.decaySec ?? DEFAULT_DECAY_SEC
    const t = this.time

    if (fx.stopT !== null) {
      // Stopped infusion: decay linearly from the amplitude at stop time.
      const k = decay === 0 ? 1 : (t - fx.stopT) / decay
      return fx.stopAmp * clamp(1 - k, 0, 1)
    }
    if (t <= onset) return 0
    const ramped = peak > onset ? spec.delta * clamp((t - onset) / (peak - onset), 0, 1) : spec.delta
    if (fx.infusion) return ramped

    const holdEnd = fx.t0 + spec.onsetSec + (spec.durationSec ?? DEFAULT_BOLUS_DURATION_SEC)
    if (t <= Math.max(holdEnd, peak)) return ramped
    const k = decay === 0 ? 1 : (t - Math.max(holdEnd, peak)) / decay
    return spec.delta * clamp(1 - k, 0, 1)
  }

  private effectExpired(fx: ActiveEffect): boolean {
    const spec = fx.spec
    if (spec.set !== undefined) return fx.discreteApplied
    const decay = spec.decaySec ?? DEFAULT_DECAY_SEC
    if (fx.stopT !== null) return this.time >= fx.stopT + decay
    if (fx.infusion) return false
    const holdEnd = fx.t0 + spec.onsetSec + (spec.durationSec ?? DEFAULT_BOLUS_DURATION_SEC)
    const peak = fx.t0 + Math.max(spec.peakSec ?? spec.onsetSec, spec.onsetSec)
    return this.time >= Math.max(holdEnd, peak) + decay
  }

  private setDiscrete(name: string, value: string): void {
    if (name === 'rhythm') {
      this.rhythmValue = value as RhythmToken
    } else {
      // Discrete set on a continuous/custom var pins its base.
      const v = this.vars.get(name)
      if (v) {
        const num = Number(value)
        if (!Number.isNaN(num)) {
          v.base = num
          v.value = clamp(num, v.min, v.max)
        }
      }
    }
  }

  private evaluateAlarms(): void {
    for (const [name, limits] of Object.entries(this.scenario.alarms ?? {})) {
      const value = this.get(name)
      const breached =
        (limits.low !== undefined && value < limits.low) ||
        (limits.high !== undefined && value > limits.high)
      const wasActive = this.alarmActive.has(name)
      if (breached) {
        this.alarmRecovery.set(name, 0)
        if (!wasActive) {
          this.alarmActive.add(name)
          this.append('alarmStart', `${name} alarm`, name)
        }
      } else if (wasActive) {
        // Hysteresis: clear only after 10 consecutive clean seconds so
        // measurement noise at the threshold doesn't chatter the alarm.
        const clean = (this.alarmRecovery.get(name) ?? 0) + 1
        this.alarmRecovery.set(name, clean)
        if (clean >= 10) {
          this.alarmActive.delete(name)
          this.append('alarmEnd', `${name} alarm resolved`, name)
        }
      }
    }
  }

  private evaluateEvents(): void {
    const scenarioEvents = this.scenario.events ?? []
    for (let i = 0; i < this.eventEvals.length; i++) {
      const ev = this.eventEvals[i]!
      const satisfied = ev.eval.step((n) => this.getRaw(n))
      if (!satisfied || (ev.fired && !ev.repeatable)) continue
      ev.fired = true
      this.append('event', ev.id, ev.id)
      for (const action of scenarioEvents[i]!.actions) this.runAction(action)
    }
  }

  private runAction(action: EventAction): void {
    switch (action.type) {
      case 'effect':
        this.effects.push({
          spec: action.effect,
          t0: this.time,
          infusion: false,
          stopT: null,
          stopAmp: 0,
          discreteApplied: false,
        })
        break
      case 'setVar': {
        if (typeof action.value === 'string') {
          this.setDiscrete(action.var, action.value)
        } else {
          const v = this.vars.get(action.var)
          if (v) {
            v.base = action.value
            v.value = clamp(action.value, v.min, v.max)
          }
        }
        break
      }
      case 'setSetpoint': {
        const v = this.vars.get(action.var)
        if (!v) break
        v.setpoint = action.setpoint
        v.ratePerMin = action.rampSec
          ? (Math.abs(action.setpoint - v.base) / action.rampSec) * 60
          : (action.ratePerMin ?? v.ratePerMin) || 1
        break
      }
      case 'message':
        this.append('message', action.text, action.from)
        break
      case 'revealExam': {
        const list = this.examFindings[action.region] ?? (this.examFindings[action.region] = [])
        list.unshift({ text: action.text }) // first match wins → revealed finding leads
        break
      }
      case 'endpoint': {
        const ep = (this.scenario.endpoints ?? []).find((e) => e.id === action.id)
        if (ep) this.reachEndpoint(ep.id, ep.kind, ep.label)
        break
      }
    }
  }

  private evaluateEndpoints(): void {
    if (this.ended) return
    for (const ep of this.endpointEvals) {
      if (ep.eval.step((n) => this.getRaw(n))) {
        const def = this.scenario.endpoints!.find((e) => e.id === ep.id)!
        this.reachEndpoint(def.id, def.kind, def.label)
        return
      }
    }
  }

  private reachEndpoint(id: string, kind: 'success' | 'fail', label: string): void {
    if (this.ended) return
    this.ended = { id, kind, label, atSec: this.time }
    this.append('endpoint', label, id)
  }

  /** Resolve {{var}} placeholders against current sim values. */
  private renderTemplate(template: string): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name: string) => {
      try {
        const raw = this.getRaw(name)
        return typeof raw === 'number' ? String(Math.round(raw * 100) / 100) : String(raw)
      } catch {
        return `{{${name}}}`
      }
    })
  }

  private append(type: LogEntryType, text: string, ref?: string, orderNo?: number): void {
    const vitals: Record<string, number> = {}
    for (const name of ENGINE_CONTINUOUS_VARS) vitals[name] = round1(this.get(name))
    vitals.map = round1(this.get('map'))
    this.log.push({ t: this.time, type, text, ref, orderNo, vitals, rhythm: this.rhythmValue })
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

function round1(x: number): number {
  return Math.round(x * 10) / 10
}
