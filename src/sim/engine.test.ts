import { describe, expect, it } from 'vitest'
import { SimEngine } from './engine'
import type { ScenarioData } from './types'
import demoScenario from '../../content/scenarios/demo-placeholder.json'

function scenario(overrides: Partial<ScenarioData> = {}): ScenarioData {
  return {
    schemaVersion: 1,
    id: 'test',
    title: 'test',
    initial: {
      vitals: { hr: 100, sbp: 120, dbp: 60, spo2: 98, rr: 14, tempC: 37, rhythm: 'sinus' },
    },
    ...overrides,
  }
}

function run(engine: SimEngine, seconds: number): void {
  for (let i = 0; i < seconds; i++) engine.tick()
}

describe('SimEngine', () => {
  it('drifts a variable toward its setpoint at ratePerMin', () => {
    const e = new SimEngine(
      scenario({ drift: { hr: { setpoint: 130, ratePerMin: 6 } } }),
      { noiseScale: 0 },
    )
    run(e, 60)
    expect(e.get('hr')).toBeCloseTo(106, 6)
  })

  it('drift never overshoots the setpoint and holds there', () => {
    const e = new SimEngine(
      scenario({ drift: { sbp: { setpoint: 118, ratePerMin: -60 } } }),
      { noiseScale: 0 },
    )
    run(e, 10)
    expect(e.get('sbp')).toBe(118)
  })

  it('uses drift-rate magnitude toward the setpoint regardless of sign', () => {
    const e = new SimEngine(
      scenario({ drift: { sbp: { setpoint: 60, ratePerMin: -1 } } }),
      { noiseScale: 0 },
    )
    run(e, 60)
    expect(e.get('sbp')).toBeCloseTo(119, 6)
  })

  it('derives map = (sbp + 2*dbp) / 3', () => {
    const e = new SimEngine(scenario(), { noiseScale: 0 })
    run(e, 5)
    expect(e.get('map')).toBeCloseTo((120 + 2 * 60) / 3, 6)
  })

  it('clamps displayed values to variable bounds', () => {
    const e = new SimEngine(
      scenario({
        initial: {
          vitals: { hr: 100, sbp: 120, dbp: 60, spo2: 100, rr: 14, tempC: 37, rhythm: 'sinus' },
        },
        drift: { spo2: { setpoint: 200, ratePerMin: 60 } },
      }),
      { noiseScale: 0 },
    )
    run(e, 120)
    expect(e.get('spo2')).toBe(100)
  })

  it('is deterministic for the same seed and diverges for different seeds', () => {
    const make = (seed: number) => {
      const e = new SimEngine(demoScenario as ScenarioData, { seed })
      run(e, 300)
      return e.history
    }
    expect(make(42)).toEqual(make(42))
    expect(make(42)).not.toEqual(make(7))
  })

  it('tracks scenario-declared custom vars uniformly', () => {
    const e = new SimEngine(demoScenario as ScenarioData, { noiseScale: 0 })
    run(e, 60)
    expect(e.get('analyteQ')).toBeCloseTo(4.05, 6)
  })

  it('exposes the initial rhythm token and records history every tick', () => {
    const e = new SimEngine(demoScenario as ScenarioData)
    run(e, 30)
    expect(e.rhythm).toBe('sinus')
    expect(e.history).toHaveLength(31) // initial sample + 30 ticks
    expect(e.history[30]?.t).toBe(30)
  })

  it('fails loudly when a scenario omits an engine vital', () => {
    const bad = scenario()
    delete (bad.initial.vitals as Record<string, unknown>).spo2
    expect(() => new SimEngine(bad)).toThrow(/spo2/)
  })
})
