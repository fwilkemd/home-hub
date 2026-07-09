/**
 * Fixed-timestep sim clock with time compression (SPEC §5.1).
 * The sim always steps in exact TICK_S quanta; rendering interpolates nothing
 * from here — it reads parameters and synthesizes at its own rate.
 */
import type { TimeScale } from '../contracts/ids';

export const TICK_S = 0.1; // 10 Hz

const MAX_TICKS_PER_ADVANCE = 400; // 32x at ~1fps still keeps up; beyond that we drop

export class SimClock {
  simTime = 0;
  timeScale: TimeScale = 1;
  private acc = 0;

  /**
   * Advance by real seconds. Calls `step(simTime)` once per elapsed fixed tick.
   */
  advance(realDtS: number, step: (simTime: number) => void): void {
    if (this.timeScale === 0) return;
    this.acc += Math.min(realDtS, 1) * this.timeScale;
    let n = 0;
    while (this.acc >= TICK_S && n < MAX_TICKS_PER_ADVANCE) {
      this.acc -= TICK_S;
      this.simTime = Math.round((this.simTime + TICK_S) * 1000) / 1000;
      step(this.simTime);
      n++;
    }
    if (n >= MAX_TICKS_PER_ADVANCE) this.acc = 0; // shed backlog rather than spiral
  }

  /** Step exactly `simSeconds` regardless of timeScale (tests / fast-forward). */
  stepSim(simSeconds: number, step: (simTime: number) => void): void {
    const ticks = Math.round(simSeconds / TICK_S);
    for (let i = 0; i < ticks; i++) {
      this.simTime = Math.round((this.simTime + TICK_S) * 1000) / 1000;
      step(this.simTime);
    }
  }

  serialize() {
    return { simTime: this.simTime, timeScale: this.timeScale };
  }

  restore(s: { simTime: number; timeScale: TimeScale }) {
    this.simTime = s.simTime;
    this.timeScale = s.timeScale;
    this.acc = 0;
  }
}
