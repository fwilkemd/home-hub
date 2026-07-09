/**
 * Cardiac rhythm state machine (SPEC §5.2). The rhythm is a waveform-level
 * mode stored in vitals.rhythm; transitions come from scenario setRhythm
 * effects and drug rhythmEffects. Rate/pressure consequences of each rhythm
 * are applied in physiology/hemodynamics.
 */
import type { RhythmId } from '../../contracts/ids';
import type { EngineCtx } from '../types';

export interface RhythmMachine {
  current(): RhythmId;
  /** transition + RhythmChanged event (no-op when unchanged) */
  set(to: RhythmId): void;
}

export function createRhythmMachine(ctx: EngineCtx): RhythmMachine {
  return {
    current: () => ctx.patient.vitals.rhythm,
    set(to: RhythmId) {
      const from = ctx.patient.vitals.rhythm;
      if (from === to) return;
      ctx.patient.vitals.rhythm = to;
      ctx.emit({ type: 'RhythmChanged', from, to });
    },
  };
}
