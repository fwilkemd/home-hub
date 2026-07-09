/**
 * One-shot cues driven by the typed bus (SPEC §12): the SpO2-pitched QRS
 * beep (the iconic ICU sound — pitch falls as the sat falls), UI screen
 * clicks, soft chimes, and pump programming clicks on infusion events.
 * All synthesized; nothing here polls — the monitor announces each beat.
 */
import { bus } from '../bridge/bus';
import { isEvent } from '../contracts/events';
import { hash01 } from '../engine/rng';
import type { AudioCore } from './context';
import { noiseBurst, tone } from './synth';

/** SpO2 100 -> ~660 Hz sliding smoothly down to ~420 Hz at SpO2 75 (clamped). */
export function qrsPitch(spo2: number): number {
  const k = Math.min(1, Math.max(0, (spo2 - 75) / 25));
  return 420 + 240 * k;
}

export interface CueSounds {
  dispose(): void;
}

export function createCueSounds(core: AudioCore): CueSounds {
  const ctx = core.ctx;
  const unsubs: Array<() => void> = [];

  if (ctx) {
    const monitorOut = core.spatialInput('monitor', 'sfx');
    const pumpOut = core.spatialInput('pump', 'sfx');
    const sfx = core.bus('sfx');
    let clickN = 0;

    unsubs.push(
      bus.on('qrsBeep', ({ spo2 }) => {
        if (!core.live() || !monitorOut) return;
        // modest under sfx — always softer than the alarms
        tone(ctx, monitorOut, {
          at: ctx.currentTime,
          freq: qrsPitch(spo2),
          dur: 0.06,
          gain: 0.13,
          attack: 0.005,
          release: 0.03,
          harmonic: { ratio: 2, level: 0.15 },
        });
      }),
    );

    unsubs.push(
      bus.on('screenClick', () => {
        if (!core.live() || !sfx) return;
        tone(ctx, sfx, {
          at: ctx.currentTime,
          freq: 1650,
          dur: 0.022,
          gain: 0.05,
          type: 'triangle',
          release: 0.012,
        });
      }),
    );

    unsubs.push(
      bus.on('chime', ({ kind }) => {
        if (!core.live() || !sfx) return;
        const t = ctx.currentTime + 0.01;
        if (kind === 'timeDrop') {
          // two descending soft notes
          tone(ctx, sfx, { at: t, freq: 659, dur: 0.16, gain: 0.09 });
          tone(ctx, sfx, { at: t + 0.17, freq: 494, dur: 0.22, gain: 0.08, release: 0.12 });
        } else if (kind === 'result') {
          // single warm ding
          tone(ctx, sfx, {
            at: t,
            freq: 880,
            dur: 0.45,
            gain: 0.11,
            release: 0.38,
            harmonic: { ratio: 2, level: 0.3 },
          });
        } else if (kind === 'tutorial') {
          // gentle blip
          tone(ctx, sfx, { at: t, freq: 587, dur: 0.09, gain: 0.07 });
        } else {
          // success: quiet rising major triad (C5 E5 G5)
          tone(ctx, sfx, { at: t, freq: 523.25, dur: 0.22, gain: 0.08, release: 0.15 });
          tone(ctx, sfx, { at: t + 0.12, freq: 659.25, dur: 0.22, gain: 0.08, release: 0.15 });
          tone(ctx, sfx, { at: t + 0.24, freq: 783.99, dur: 0.3, gain: 0.08, release: 0.22 });
        }
      }),
    );

    unsubs.push(
      bus.on('simEvent', (e) => {
        if (!core.live() || !pumpOut) return;
        if (isEvent(e, 'InfusionStarted') || isEvent(e, 'InfusionRateChanged')) {
          // pump keypad/programming click at the pump's position
          const t = ctx.currentTime + 0.01;
          tone(ctx, pumpOut, { at: t, freq: 980, dur: 0.03, gain: 0.07, type: 'square', release: 0.012 });
          tone(ctx, pumpOut, { at: t + 0.09, freq: 1245, dur: 0.03, gain: 0.06, type: 'square', release: 0.012 });
          noiseBurst(ctx, pumpOut, core.white, {
            at: t,
            dur: 0.015,
            gain: 0.03,
            filter: { type: 'lowpass', freq: 1200 },
            offset01: hash01(0xc11c, clickN++),
          });
        }
      }),
    );
  }

  return {
    dispose(): void {
      for (const u of unsubs) u();
      unsubs.length = 0;
    },
  };
}
