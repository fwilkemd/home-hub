import { describe, expect, it } from 'vitest';
import { SimClock, TICK_S } from '../../src/engine/clock';

describe('SimClock', () => {
  it('steps at fixed 10 Hz', () => {
    const c = new SimClock();
    const times: number[] = [];
    c.advance(1.0, (t) => times.push(t));
    expect(times.length).toBe(10);
    expect(times[0]).toBeCloseTo(TICK_S);
    expect(c.simTime).toBeCloseTo(1.0);
  });

  it('applies time compression', () => {
    const c = new SimClock();
    c.timeScale = 8;
    let ticks = 0;
    c.advance(1.0, () => ticks++);
    expect(ticks).toBe(80);
    expect(c.simTime).toBeCloseTo(8.0);
  });

  it('pauses at 0x', () => {
    const c = new SimClock();
    c.timeScale = 0;
    let ticks = 0;
    c.advance(5, () => ticks++);
    expect(ticks).toBe(0);
  });

  it('accumulates partial frames without drift', () => {
    const c = new SimClock();
    let ticks = 0;
    for (let i = 0; i < 100; i++) c.advance(0.016, () => ticks++);
    // 1.6s of real time at 1x -> 16 ticks (float accumulation may hold one back)
    expect(ticks).toBeGreaterThanOrEqual(15);
    expect(ticks).toBeLessThanOrEqual(16);
    expect(c.simTime).toBeCloseTo(ticks * 0.1, 5);
  });

  it('stepSim steps exact sim seconds regardless of scale', () => {
    const c = new SimClock();
    c.timeScale = 0;
    let ticks = 0;
    c.stepSim(2.0, () => ticks++);
    expect(ticks).toBe(20);
    expect(c.simTime).toBeCloseTo(2.0);
  });
});
