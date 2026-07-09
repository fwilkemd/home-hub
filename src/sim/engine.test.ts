import { describe, expect, it } from 'vitest'
import { SimEngine } from './engine'
import { parseCatalog, parseScenario, ContentValidationError, type ScenarioData } from './schema'
import demoScenarioRaw from '../../content/scenarios/demo-placeholder.json'
import catalogRaw from '../../content/interventions.json'

const demoScenario = parseScenario(demoScenarioRaw)
const catalog = parseCatalog(catalogRaw)

function scenario(overrides: Record<string, unknown> = {}): ScenarioData {
  return parseScenario({
    schemaVersion: 1,
    id: 'test',
    title: 'test',
    initial: {
      vitals: { hr: 100, sbp: 120, dbp: 60, spo2: 98, rr: 14, tempC: 37, rhythm: 'sinus' },
    },
    ...overrides,
  })
}

function testCatalog(interventions: Record<string, unknown>[]) {
  return parseCatalog({ schemaVersion: 1, interventions })
}

function run(engine: SimEngine, seconds: number): void {
  for (let i = 0; i < seconds; i++) engine.tick()
}

describe('variables and drift', () => {
  it('drifts a variable toward its setpoint at ratePerMin', () => {
    const e = new SimEngine(
      scenario({ drift: { hr: { setpoint: 130, ratePerMin: 6 } } }),
      undefined,
      { noiseScale: 0 },
    )
    run(e, 60)
    expect(e.get('hr')).toBeCloseTo(106, 6)
  })

  it('drift never overshoots the setpoint and holds there', () => {
    const e = new SimEngine(
      scenario({ drift: { sbp: { setpoint: 118, ratePerMin: -60 } } }),
      undefined,
      { noiseScale: 0 },
    )
    run(e, 10)
    expect(e.get('sbp')).toBe(118)
  })

  it('derives map = (sbp + 2*dbp) / 3', () => {
    const e = new SimEngine(scenario(), undefined, { noiseScale: 0 })
    run(e, 5)
    expect(e.get('map')).toBeCloseTo((120 + 2 * 60) / 3, 6)
  })

  it('clamps displayed values to instrument bounds', () => {
    const e = new SimEngine(
      scenario({ drift: { spo2: { setpoint: 200, ratePerMin: 60 } } }),
      undefined,
      { noiseScale: 0 },
    )
    run(e, 120)
    expect(e.get('spo2')).toBe(100)
  })

  it('tracks scenario-declared custom vars uniformly', () => {
    const e = new SimEngine(demoScenario, catalog, { noiseScale: 0 })
    run(e, 60)
    expect(e.get('analyteQ')).toBeCloseTo(4.05, 6)
  })

  it('fails loudly when a scenario omits an engine vital', () => {
    expect(() =>
      parseScenario({
        schemaVersion: 1,
        id: 'bad',
        title: 'bad',
        initial: { vitals: { hr: 100, sbp: 120, dbp: 60, rr: 14, tempC: 37 } },
      }),
    ).toThrow(ContentValidationError)
  })
})

describe('effects', () => {
  const bolusCatalog = testCatalog([
    {
      id: 'med-t',
      label: 'Med T',
      category: 'Meds',
      type: 'bolus',
      effects: [{ var: 'map', delta: 12, onsetSec: 60, peakSec: 120, durationSec: 300, decaySec: 60 }],
    },
  ])

  it('bolus envelope: zero before onset, ramps to delta at peak, holds, decays to zero', () => {
    const e = new SimEngine(scenario(), bolusCatalog, { noiseScale: 0 })
    const baseMap = e.get('map')
    expect(e.order('med-t').ok).toBe(true)

    run(e, 59) // t=59, still pre-onset
    expect(e.get('map')).toBeCloseTo(baseMap, 6)
    run(e, 31) // t=90, halfway up the ramp
    expect(e.get('map')).toBeCloseTo(baseMap + 6, 6)
    run(e, 30) // t=120, peak
    expect(e.get('map')).toBeCloseTo(baseMap + 12, 6)
    run(e, 240) // t=360 = onset+duration, still holding
    expect(e.get('map')).toBeCloseTo(baseMap + 12, 6)
    run(e, 30) // t=390, half decayed
    expect(e.get('map')).toBeCloseTo(baseMap + 6, 6)
    run(e, 40) // t=430, expired
    expect(e.get('map')).toBeCloseTo(baseMap, 6)
  })

  it('effects from multiple sources sum', () => {
    const e = new SimEngine(scenario(), bolusCatalog, { noiseScale: 0 })
    const baseMap = e.get('map')
    e.order('med-t')
    e.order('med-t')
    run(e, 120)
    expect(e.get('map')).toBeCloseTo(baseMap + 24, 6)
  })

  it('infusion sustains until stopped, then decays from current amplitude', () => {
    const infCatalog = testCatalog([
      {
        id: 'drip-t',
        label: 'Drip T',
        category: 'Meds',
        type: 'infusion',
        effects: [{ var: 'map', delta: 10, onsetSec: 0, peakSec: 100, decaySec: 100 }],
      },
    ])
    const e = new SimEngine(scenario(), infCatalog, { noiseScale: 0 })
    const baseMap = e.get('map')
    const { orderNo } = e.order('drip-t')
    run(e, 1000)
    expect(e.get('map')).toBeCloseTo(baseMap + 10, 6) // still holding long past peak
    expect(e.activeInfusions()).toHaveLength(1)

    e.stopInfusion(orderNo!)
    expect(e.activeInfusions()).toHaveLength(0)
    run(e, 50)
    expect(e.get('map')).toBeCloseTo(baseMap + 5, 6)
    run(e, 60)
    expect(e.get('map')).toBeCloseTo(baseMap, 6)
  })

  it('discrete effects set the value at onsetSec', () => {
    const c = testCatalog([
      {
        id: 'shock-t',
        label: 'Shock T',
        category: 'Procedures',
        type: 'action',
        effects: [{ var: 'rhythm', set: 'sinus', onsetSec: 10 }],
      },
    ])
    const e = new SimEngine(scenario({ initial: {
      vitals: { hr: 100, sbp: 120, dbp: 60, spo2: 98, rr: 14, tempC: 37, rhythm: 'vt' },
    } }), c, { noiseScale: 0 })
    e.order('shock-t')
    run(e, 9)
    expect(e.rhythm).toBe('vt')
    run(e, 1)
    expect(e.rhythm).toBe('sinus')
  })
})

describe('orders, tags, busySec', () => {
  it('busySec delays the effect and grants', () => {
    const c = testCatalog([
      { id: 'line-t', label: 'Line T', category: 'Procedures', type: 'action', busySec: 90, grants: ['access-t'] },
      {
        id: 'gated-t', label: 'Gated T', category: 'Meds', type: 'bolus', requires: ['access-t'],
        effects: [{ var: 'map', delta: 5, onsetSec: 0, peakSec: 0 }],
      },
    ])
    const e = new SimEngine(scenario(), c, { noiseScale: 0 })

    const rejected = e.order('gated-t')
    expect(rejected.ok).toBe(false)
    expect(rejected.missing).toEqual(['access-t'])
    expect(e.log.at(-1)?.type).toBe('orderRejected')

    e.order('line-t')
    run(e, 89)
    expect(e.tags.has('access-t')).toBe(false)
    run(e, 1)
    expect(e.tags.has('access-t')).toBe(true)
    expect(e.order('gated-t').ok).toBe(true)
  })

  it('lab results post after resultDelaySec with {{var}} templating', () => {
    const e = new SimEngine(demoScenario, catalog, { noiseScale: 0 })
    e.order('lab-panel-x')
    run(e, 299)
    expect(e.log.some((l) => l.type === 'result')).toBe(false)
    run(e, 1)
    const result = e.log.find((l) => l.type === 'result')
    expect(result).toBeDefined()
    // analyteQ drifts 4.0 → 4.25 over 300 s at 0.05/min
    expect(result!.text).toContain('Analyte Q: 4.25 (placeholder units)')
  })

  it('rejects orders after the scenario has ended', () => {
    const e = new SimEngine(scenario({ timeLimitSec: 5 }), catalog, { noiseScale: 0 })
    run(e, 6)
    expect(e.ended?.kind).toBe('timeout')
    expect(e.order('fluid-bolus-x').ok).toBe(false)
  })
})

describe('triggers, events, endpoints', () => {
  it('sustain requires consecutive seconds and resets on a dip', () => {
    const s = scenario({
      customVars: [{ name: 'x', initial: 0 }],
      events: [{
        id: 'ev-t',
        trigger: { when: { var: 'x', op: '>', value: 5, sustainSec: 10 } },
        actions: [{ type: 'message', from: 'T', text: 'fired' }],
      }],
    })
    const c = testCatalog([
      { id: 'raise-x', label: 'Raise', category: 'T', type: 'bolus', effects: [{ var: 'x', delta: 10, durationSec: 8, decaySec: 0 }] },
      { id: 'raise-x-long', label: 'Raise long', category: 'T', type: 'bolus', effects: [{ var: 'x', delta: 10, durationSec: 60, decaySec: 0 }] },
    ])
    const e = new SimEngine(s, c, { noiseScale: 0 })
    e.order('raise-x') // above 5 for only ~8s → resets
    run(e, 30)
    expect(e.log.some((l) => l.type === 'event')).toBe(false)
    e.order('raise-x-long')
    run(e, 15)
    expect(e.log.some((l) => l.type === 'event' && l.ref === 'ev-t')).toBe(true)
    expect(e.log.some((l) => l.type === 'message' && l.text === 'fired')).toBe(true)
  })

  it('events fire at most once unless repeatable', () => {
    const s = scenario({
      customVars: [{ name: 'x', initial: 10 }],
      events: [{
        id: 'once',
        trigger: { when: { var: 'x', op: '>', value: 5 } },
        actions: [{ type: 'message', from: 'T', text: 'ping' }],
      }],
    })
    const e = new SimEngine(s, undefined, { noiseScale: 0 })
    run(e, 30)
    expect(e.log.filter((l) => l.type === 'message' && l.text === 'ping')).toHaveLength(1)
  })

  it('setSetpoint with rampSec reaches the target in that time', () => {
    const s = scenario({
      customVars: [{ name: 'x', initial: 100 }],
      events: [{
        id: 'ramp',
        trigger: { when: { var: 'x', op: '>=', value: 100 } },
        actions: [{ type: 'setSetpoint', var: 'x', setpoint: 40, rampSec: 60 }],
      }],
    })
    const e = new SimEngine(s, undefined, { noiseScale: 0 })
    run(e, 31) // event fires at t=1, then 30s of ramping
    expect(e.get('x')).toBeCloseTo(70, 4)
    run(e, 35)
    expect(e.get('x')).toBeCloseTo(40, 4)
  })

  it('demo scenario is losable: untreated → vt → asystole → arrest endpoint', () => {
    const e = new SimEngine(demoScenario, catalog, { seed: 3 })
    run(e, 1800)
    expect(e.ended).not.toBeNull()
    expect(e.ended!.kind).toBe('fail')
    expect(e.ended!.id).toBe('arrest')
    expect(e.rhythm).toBe('asystole')
    expect(e.log.some((l) => l.type === 'event' && l.ref === 'crash-1')).toBe(true)
  })

  it('demo scenario is winnable: line + high pressor → stabilized endpoint', () => {
    const e = new SimEngine(demoScenario, catalog, { seed: 3 })
    e.order('place-central-line')
    run(e, 90)
    expect(e.order('pressor-a-high').ok).toBe(true)
    e.order('fluid-bolus-x')
    run(e, 1200)
    expect(e.ended).not.toBeNull()
    expect(e.ended!.kind).toBe('success')
    expect(e.ended!.id).toBe('stabilized')
  })

  it('ticking stops once an endpoint is reached', () => {
    const e = new SimEngine(scenario({ timeLimitSec: 10 }), undefined, { noiseScale: 0 })
    run(e, 50)
    expect(e.time).toBe(10)
    expect(e.history.at(-1)?.t).toBe(10)
  })
})

describe('alarms', () => {
  it('logs transitions and reports audible state with silence', () => {
    const s = scenario({
      alarms: { sbp: { low: 100 } },
      drift: { sbp: { setpoint: 90, ratePerMin: -120 } }, // 2/sec → breaches at ~t=11
    })
    const e = new SimEngine(s, undefined, { noiseScale: 0 })
    run(e, 20)
    expect(e.alarmedVars()).toEqual(['sbp'])
    expect(e.alarmsAudible()).toBe(true)
    expect(e.log.some((l) => l.type === 'alarmStart' && l.ref === 'sbp')).toBe(true)

    e.silenceAlarms(120)
    expect(e.alarmsAudible()).toBe(false)
    expect(e.alarmsSilenced).toBe(true)
    run(e, 121)
    expect(e.alarmsAudible()).toBe(true)
  })
})

describe('exam', () => {
  it('first matching finding wins; conditions read live values', () => {
    const e = new SimEngine(demoScenario, catalog, { noiseScale: 0 })
    expect(e.examine('chest')).toBe('Placeholder chest finding A (default).')
    run(e, 500) // spo2 has drifted below 88; crash-1 has not fired yet
    expect(e.examine('chest')).toBe('Placeholder chest finding B (low analyte state).')
  })

  it('revealExam prepends a finding that then wins', () => {
    const e = new SimEngine(demoScenario, catalog, { seed: 3 })
    run(e, 1500) // crash-1 has fired by now
    expect(e.examine('chest')).toBe('Placeholder chest finding C (revealed after the rhythm change).')
  })
})

describe('reproducibility', () => {
  function scripted(seed: number) {
    const e = new SimEngine(demoScenario, catalog, { seed })
    for (let t = 0; t < 1200; t++) {
      if (t === 30) e.order('place-central-line')
      if (t === 140) e.order('pressor-a-low')
      if (t === 200) e.order('lab-panel-x')
      e.tick()
    }
    return e
  }

  it('same seed + same scripted actions → identical history and log', () => {
    const a = scripted(42)
    const b = scripted(42)
    expect(a.history).toEqual(b.history)
    expect(a.log).toEqual(b.log)
    const c = scripted(7)
    expect(a.history).not.toEqual(c.history)
  })
})

describe('content validation', () => {
  it('accepts the bundled content files', () => {
    expect(demoScenario.id).toBe('demo-placeholder')
    expect(catalog.interventions.length).toBeGreaterThanOrEqual(5)
  })

  it('rejects a broken scenario with a readable error', () => {
    try {
      parseScenario({ schemaVersion: 1, id: 'x' }, 'broken.json')
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(ContentValidationError)
      expect(String(err)).toContain('broken.json')
      expect(String(err)).toContain('title')
    }
  })

  it('rejects an effect with both delta and set', () => {
    expect(() =>
      testCatalog([{
        id: 'bad', label: 'bad', category: 'x', type: 'bolus',
        effects: [{ var: 'rhythm', delta: 1, set: 'vt' }],
      }]),
    ).toThrow(ContentValidationError)
  })

  it('rejects duplicate intervention ids', () => {
    expect(() =>
      testCatalog([
        { id: 'dup', label: 'a', category: 'x', type: 'action' },
        { id: 'dup', label: 'b', category: 'x', type: 'action' },
      ]),
    ).toThrow(/unique/)
  })
})
