import { describe, expect, it } from 'vitest';
import { BeatClock } from '../../src/engine/waveforms/beat-clock';
import { ecgSample } from '../../src/engine/waveforms/ecg';
import { plethSample } from '../../src/engine/waveforms/pleth';
import { artSample } from '../../src/engine/waveforms/art';
import { capnoSample } from '../../src/engine/waveforms/capno';
import { ventCurves } from '../../src/engine/waveforms/vent-curves';
import type {
  ArtParams,
  CapnoParams,
  EcgParams,
  PlethParams,
  VentWaveParams,
} from '../../src/contracts/waveforms';
import type { RhythmId } from '../../src/contracts/ids';

/** Step a clock over [0, duration] and collect exact beat-onset times. */
function collectBeats(
  clock: BeatClock,
  params: { rhythm: RhythmId; rate: number },
  duration: number,
  dt: number,
): number[] {
  const onsets: number[] = [];
  let lastIndex = -1;
  for (let t = 0; t <= duration + 1e-9; t += dt) {
    clock.update(params, t);
    const info = clock.phaseAt(t);
    if (info.inBeat && info.beatIndex !== lastIndex) {
      lastIndex = info.beatIndex;
      onsets.push(t - info.tInBeat); // exact beat start
    }
  }
  return onsets;
}

function variance(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length;
}

describe('BeatClock', () => {
  it('fires 80 +/- 1 beats over 60 s at HR 80 (sinus)', () => {
    const clock = new BeatClock(42);
    const beats = collectBeats(clock, { rhythm: 'sinus', rate: 80 }, 60, 0.01);
    const inWindow = beats.filter((b) => b > 0 && b <= 60).length;
    expect(inWindow).toBeGreaterThanOrEqual(79);
    expect(inWindow).toBeLessThanOrEqual(81);
  });

  it('afib beat count is within +/-25% of rate and intervals are irregular', () => {
    const clock = new BeatClock(1234);
    const beats = collectBeats(clock, { rhythm: 'afib', rate: 90 }, 120, 0.01);
    const expected = (90 * 120) / 60;
    expect(beats.length).toBeGreaterThanOrEqual(expected * 0.75);
    expect(beats.length).toBeLessThanOrEqual(expected * 1.25);
    const intervals = beats.slice(1).map((b, i) => b - beats[i]);
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const sd = Math.sqrt(variance(intervals));
    expect(sd / mean).toBeGreaterThan(0.08);
  });

  it('same seed -> identical beat times, even at different update cadences', () => {
    const a = new BeatClock(777);
    const b = new BeatClock(777);
    const beatsA = collectBeats(a, { rhythm: 'afib', rate: 85 }, 60, 0.01);
    const beatsB = collectBeats(b, { rhythm: 'afib', rate: 85 }, 60, 0.037);
    const n = Math.min(beatsA.length, beatsB.length);
    expect(n).toBeGreaterThan(40);
    for (let i = 0; i < n; i++) {
      expect(Math.abs(beatsA[i] - beatsB[i])).toBeLessThan(1e-9);
    }
  });

  it('handles rate changes without rescanning and stays monotonic', () => {
    const clock = new BeatClock(5);
    let lastIndex = -1;
    for (let t = 0; t <= 30; t += 0.02) {
      const rate = t < 15 ? 60 : 150;
      clock.update({ rhythm: 'sinus', rate }, t);
      const info = clock.phaseAt(t);
      expect(info.beatIndex).toBeGreaterThanOrEqual(lastIndex);
      lastIndex = info.beatIndex;
    }
    // ~15 beats in the first half, ~37 in the second
    expect(lastIndex).toBeGreaterThan(45);
    expect(lastIndex).toBeLessThan(58);
  });

  it('vf / asystole schedule no beats', () => {
    const clock = new BeatClock(9);
    for (let t = 0; t <= 10; t += 0.05) {
      clock.update({ rhythm: 'vf', rate: 0 }, t);
      expect(clock.phaseAt(t).inBeat).toBe(false);
    }
  });
});

describe('ecgSample', () => {
  const base: EcgParams = { rhythm: 'sinus', rate: 80, amplitude: 1, ectopyPerMin: 0 };

  function sampleSeries(params: EcgParams, seed: number, duration = 10, dt = 0.005): number[] {
    const clock = new BeatClock(seed);
    const out: number[] = [];
    for (let t = 0; t <= duration; t += dt) {
      clock.update({ rhythm: params.rhythm, rate: params.rate }, t);
      out.push(ecgSample(params, clock, t));
    }
    return out;
  }

  it('sinus stays in millivolt-ish bounds (-0.5..1.5)', () => {
    const xs = sampleSeries(base, 42);
    expect(Math.min(...xs)).toBeGreaterThan(-0.5);
    expect(Math.max(...xs)).toBeLessThan(1.5);
    expect(Math.max(...xs)).toBeGreaterThan(0.7); // R waves present
  });

  it('vf is non-flat, asystole is near-flat', () => {
    const vf = sampleSeries({ ...base, rhythm: 'vf' }, 42);
    const asys = sampleSeries({ ...base, rhythm: 'asystole' }, 42);
    expect(variance(vf)).toBeGreaterThan(0.005);
    expect(variance(asys)).toBeLessThan(0.001);
    expect(Math.max(...asys.map(Math.abs))).toBeLessThan(0.1);
  });

  it('is deterministic for the same seed', () => {
    const a = sampleSeries({ ...base, rhythm: 'afib' }, 314, 5);
    const b = sampleSeries({ ...base, rhythm: 'afib' }, 314, 5);
    expect(a).toEqual(b);
  });
});

describe('plethSample', () => {
  it('flatlines near 0 when not present and pulses when present', () => {
    const clock = new BeatClock(11);
    const off: PlethParams = { present: false, rate: 80, perfusion: 0.8, respSwing: 0 };
    const on: PlethParams = { present: true, rate: 80, perfusion: 0.8, respSwing: 0.1 };
    let maxOff = 0;
    let maxOn = 0;
    for (let t = 0; t <= 6; t += 0.005) {
      clock.update({ rhythm: 'sinus', rate: 80 }, t);
      maxOff = Math.max(maxOff, Math.abs(plethSample(off, clock, t)));
      maxOn = Math.max(maxOn, plethSample(on, clock, t));
    }
    expect(maxOff).toBeLessThan(0.05);
    expect(maxOn).toBeGreaterThan(0.5);
    expect(maxOn).toBeLessThanOrEqual(1.2);
  });
});

describe('artSample', () => {
  const base: ArtParams = {
    present: true,
    rate: 80,
    sbp: 120,
    dbp: 65,
    respSwing: 1,
    damped: 0,
    pulsatile: true,
  };

  function minMax(params: ArtParams, seed = 7): { min: number; max: number } {
    const clock = new BeatClock(seed);
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t <= 40; t += 0.004) {
      clock.update({ rhythm: 'sinus', rate: params.rate }, t);
      const v = artSample(params, clock, t);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    return { min, max };
  }

  it('stays within [dbp-5, sbp+5] with full respiratory swing', () => {
    const { min, max } = minMax(base);
    expect(min).toBeGreaterThanOrEqual(base.dbp - 5);
    expect(max).toBeLessThanOrEqual(base.sbp + 5);
    expect(max - min).toBeGreaterThan(25); // still visibly pulsatile
  });

  it('damped narrows pulse pressure but stays in bounds', () => {
    const damped = { ...base, damped: 0.8, respSwing: 0.2 };
    const d = minMax(damped);
    const n = minMax({ ...base, respSwing: 0.2 });
    expect(d.max - d.min).toBeLessThan(n.max - n.min);
    expect(d.min).toBeGreaterThanOrEqual(base.dbp - 5);
    expect(d.max).toBeLessThanOrEqual(base.sbp + 5);
  });

  it('pulsatile=false is a low flat-ish line', () => {
    const flat = minMax({ ...base, pulsatile: false });
    expect(flat.max).toBeLessThan(25);
    expect(flat.max - flat.min).toBeLessThan(6);
  });
});

describe('capnoSample', () => {
  it('returns 0 when not present', () => {
    const p: CapnoParams = { present: false, rate: 14, etco2: 38, plateauSlope: 0.2 };
    for (let t = 0; t < 8; t += 0.1) expect(capnoSample(p, t)).toBe(0);
  });

  it('reaches ~etco2 at end-tidal and returns to ~0 in inspiration', () => {
    const p: CapnoParams = { present: true, rate: 12, etco2: 38, plateauSlope: 0.1 };
    let max = 0;
    let min = Infinity;
    for (let t = 0; t <= 15; t += 0.005) {
      const v = capnoSample(p, t);
      max = Math.max(max, v);
      min = Math.min(min, v);
    }
    expect(max).toBeGreaterThan(p.etco2 * 0.92);
    expect(max).toBeLessThan(p.etco2 * 1.08);
    expect(min).toBeLessThan(1);
    expect(min).toBeGreaterThanOrEqual(0);
  });
});

describe('ventCurves', () => {
  const vc: VentWaveParams = {
    connected: true,
    standby: false,
    mode: 'VC',
    rate: 16,
    tiS: 1.0,
    peep: 5,
    fio2: 0.4,
    drivePressure: 12,
    targetVtMl: 450,
    measuredVteMl: 440,
    complianceMlPerCmH2o: 50,
    resistanceCmH2oPerLps: 10,
    ppeak: 24,
    pplat: 19,
    spontaneous: false,
  };

  function sweep(params: VentWaveParams) {
    let pawMax = -Infinity;
    let volMax = -Infinity;
    let volEnd = 0;
    let flowMin = Infinity;
    for (let p = 0; p <= 1; p += 0.001) {
      const s = ventCurves(params, p);
      pawMax = Math.max(pawMax, s.paw);
      volMax = Math.max(volMax, s.vol);
      flowMin = Math.min(flowMin, s.flow);
      if (p > 0.999) volEnd = s.vol;
    }
    return { pawMax, volMax, volEnd, flowMin };
  }

  it('VC ramps Paw to ppeak, delivers Vt, and exhales back to ~0', () => {
    const s = sweep(vc);
    expect(s.pawMax).toBeGreaterThan(vc.ppeak - 1);
    expect(s.pawMax).toBeLessThan(vc.ppeak + 1);
    expect(s.volMax).toBeGreaterThan(vc.targetVtMl - 1);
    expect(s.volMax).toBeLessThan(vc.targetVtMl + 1);
    expect(s.volEnd).toBeLessThan(5);
    expect(s.flowMin).toBeLessThan(-10); // expiratory flow exists
  });

  it('PC squares pressure at peep+drivePressure and volumes track vte', () => {
    const pc: VentWaveParams = { ...vc, mode: 'PC', drivePressure: 15 };
    const s = sweep(pc);
    expect(s.pawMax).toBeGreaterThan(pc.peep + pc.drivePressure - 1);
    expect(s.pawMax).toBeLessThan(pc.peep + pc.drivePressure + 0.5);
    expect(s.volMax).toBeGreaterThan(pc.measuredVteMl * 0.98);
    expect(s.volMax).toBeLessThan(pc.measuredVteMl * 1.02);
  });

  it('standby / disconnected is all zeros', () => {
    const s = ventCurves({ ...vc, standby: true }, 0.4);
    expect(s).toEqual({ paw: 0, flow: 0, vol: 0 });
  });
});
