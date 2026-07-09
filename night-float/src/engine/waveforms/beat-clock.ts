/**
 * BeatClock — the deterministic beat scheduler every consumer agrees on
 * (monitor tracings, pleth, art line, ultrasound heart motion, QRS audio).
 *
 * The schedule is a pure function of (seed, observed rhythm/rate history):
 * beat N starts at the prefix sum of intervals 0..N-1, anchored at absolute
 * t = 0. Two instances with the same seed that observe the same params
 * produce bit-identical beat times regardless of how often update() is
 * called — which is what keeps the monitor, the ultrasound and the beep
 * in sync without sharing an object.
 *
 * Contract for consumers: construct with WaveformParams.beatSeed, call
 * `update({ rhythm, rate }, tSec)` once per frame with the SESSION real-time
 * base (the `realTimeS` handed to ScreensHandle.updateAll), then sample with
 * `phaseAt(tSec)`.
 */
import type { RhythmId } from '../../contracts/ids';
import { hash01 } from '../rng';
import { clamp } from './wave-utils';

export interface BeatClockParams {
  rhythm: RhythmId;
  rate: number;
}

export interface BeatPhaseInfo {
  /** 0..1 position inside the current beat interval (0 = beat onset). */
  phase: number;
  /** seconds since the current beat began. */
  tInBeat: number;
  /** current beat-to-beat interval, seconds. */
  interval: number;
  /** monotonically increasing beat index (detect edges for QRS beeps). */
  beatIndex: number;
  /** false while the rhythm produces no organized beats (vf / asystole). */
  inBeat: boolean;
}

const MIN_RATE = 15;
const MAX_RATE = 260;

export class BeatClock {
  readonly seed: number;

  private rhythm: RhythmId = 'sinus';
  private rate = 75;
  private beatIndex = 0;
  private beatStart = 0;
  private beatEnd: number;
  private prevStart = 0;
  private silent = false;

  constructor(seed: number) {
    this.seed = seed | 0;
    this.beatEnd = this.intervalFor(0);
    this.prevStart = -this.beatEnd;
  }

  /** Interval preceding-to-next beat for a given beat index under current params. */
  private intervalFor(index: number): number {
    const base = 60 / clamp(this.rate, MIN_RATE, MAX_RATE);
    if (this.rhythm === 'afib') {
      // Irregularly irregular, deterministic per beat index (SPEC §5.2).
      return base * (0.65 + 0.7 * hash01(this.seed, index));
    }
    // Regular rhythms (sinus family) and vt (engine sends the fast rate).
    return base;
  }

  /**
   * Advance the internal beat list to tSec. Incremental — keeps last/next
   * beat times and rolls forward, no O(t) rescans per call.
   */
  update(params: BeatClockParams, tSec: number): void {
    const wasSilent = this.silent;
    const changed = params.rhythm !== this.rhythm || params.rate !== this.rate;
    this.rhythm = params.rhythm;
    this.rate = params.rate;
    this.silent = params.rhythm === 'vf' || params.rhythm === 'asystole';
    if (this.silent) return;

    if (wasSilent) {
      // Resuming organized beats (e.g. defibrillated out of VF): re-anchor on
      // an interval-quantized boundary so consumers that observe the
      // transition within the same beat window land on the same schedule.
      this.beatIndex += 1;
      const iv = this.intervalFor(this.beatIndex);
      this.beatStart = Math.floor(tSec / iv) * iv;
      this.prevStart = this.beatStart - iv;
      this.beatEnd = this.beatStart + iv;
    } else if (changed) {
      // Rate/rhythm change: re-derive the current interval from the current
      // beat's onset; overdue beats fire via the roll-forward below.
      this.beatEnd = this.beatStart + this.intervalFor(this.beatIndex);
    }

    let guard = 0;
    while (tSec >= this.beatEnd && guard++ < 400000) {
      this.prevStart = this.beatStart;
      this.beatStart = this.beatEnd;
      this.beatIndex += 1;
      this.beatEnd = this.beatStart + this.intervalFor(this.beatIndex);
    }
  }

  /**
   * Phase info at tSec. Tolerates sampling slightly in the past (sweep
   * renderers sample times just behind "now") by answering from the previous
   * beat window when tSec < current beat onset.
   */
  phaseAt(tSec: number): BeatPhaseInfo {
    if (this.silent) {
      return {
        phase: 0,
        tInBeat: 0,
        interval: 60 / clamp(this.rate, MIN_RATE, MAX_RATE),
        beatIndex: this.beatIndex,
        inBeat: false,
      };
    }
    if (tSec < this.beatStart && this.beatIndex > 0) {
      const interval = this.beatStart - this.prevStart;
      const tInBeat = clamp(tSec - this.prevStart, 0, interval);
      return {
        phase: interval > 0 ? tInBeat / interval : 0,
        tInBeat,
        interval,
        beatIndex: this.beatIndex - 1,
        inBeat: true,
      };
    }
    const interval = this.beatEnd - this.beatStart;
    const tInBeat = clamp(tSec - this.beatStart, 0, interval);
    return {
      phase: interval > 0 ? tInBeat / interval : 0,
      tInBeat,
      interval,
      beatIndex: this.beatIndex,
      inBeat: true,
    };
  }
}
