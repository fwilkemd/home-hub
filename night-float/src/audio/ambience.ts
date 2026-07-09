/**
 * Room ambience (SPEC §12) — the 3am ICU bed. Three layers, all deliberately
 * quiet: a barely-there brown-noise room tone with a faint mains hum, the
 * vent's inspiratory whoosh synced to the engine's real breath phase (the
 * room's heartbeat), and a soft peristaltic pump tick while any channel runs.
 * Continuous chains are built once; update() only moves gain/filter targets.
 */
import type { EngineHandle } from '../contracts/runtime';
import { hash01 } from '../engine/rng';
import type { AudioCore } from './context';
import { noiseBurst, tone } from './synth';

/** whoosh rises over the first ~35% of the breath phase, then falls away */
const INSP_END = 0.35;
const FALL_END = 0.8;

function whooshEnv(phase: number): number {
  if (phase < INSP_END) return 0.5 - 0.5 * Math.cos((Math.PI * phase) / INSP_END);
  if (phase < FALL_END) {
    return 0.5 + 0.5 * Math.cos((Math.PI * (phase - INSP_END)) / (FALL_END - INSP_END));
  }
  return 0;
}

export interface Ambience {
  update(realDtS: number): void;
  dispose(): void;
}

export function createAmbience(core: AudioCore, engine: EngineHandle): Ambience {
  const ctx = core.ctx;
  const amb = core.bus('ambience');
  if (!ctx || !amb) return { update: () => {}, dispose: () => {} };

  const stops: Array<() => void> = [];
  let whooshGain: GainNode | null = null;
  let whooshFilter: BiquadFilterNode | null = null;

  try {
    // ---- room tone: very quiet filtered brown noise
    if (core.brown) {
      const src = ctx.createBufferSource();
      src.buffer = core.brown;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 240;
      const g = ctx.createGain();
      g.gain.value = 0.055;
      src.connect(lp);
      lp.connect(g);
      g.connect(amb);
      src.start();
      stops.push(() => {
        try {
          src.stop();
          g.disconnect();
        } catch {
          /* already gone */
        }
      });
    }

    // ---- faint 120 Hz-ish hum: two detuned partials beat slowly
    const humG = ctx.createGain();
    humG.gain.value = 0.011;
    humG.connect(amb);
    for (const [f, lvl] of [
      [120, 1],
      [119.1, 0.6],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = lvl;
      o.connect(og);
      og.connect(humG);
      o.start();
      stops.push(() => {
        try {
          o.stop();
          o.disconnect();
        } catch {
          /* already gone */
        }
      });
    }
    stops.push(() => {
      try {
        humG.disconnect();
      } catch {
        /* already gone */
      }
    });

    // ---- vent whoosh: filtered noise whose gain follows the breath phase
    const ventOut = core.spatialInput('vent', 'ambience');
    if (core.white && ventOut) {
      const src = ctx.createBufferSource();
      src.buffer = core.white;
      src.loop = true;
      whooshFilter = ctx.createBiquadFilter();
      whooshFilter.type = 'bandpass';
      whooshFilter.frequency.value = 560;
      whooshFilter.Q.value = 0.8;
      whooshGain = ctx.createGain();
      whooshGain.gain.value = 0;
      src.connect(whooshFilter);
      whooshFilter.connect(whooshGain);
      whooshGain.connect(ventOut);
      src.start();
      stops.push(() => {
        try {
          src.stop();
          whooshGain?.disconnect();
        } catch {
          /* already gone */
        }
      });
    }
  } catch {
    /* keep whatever layers were built */
  }

  const pumpOut = core.spatialInput('pump', 'ambience');
  let pumpAcc = 1; // check channels shortly after start
  let pumpRunning = false;
  let nextTickAt = 0;
  let tickN = 0;

  function update(realDtS: number): void {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;

      // vent whoosh follows the real vent + breath phase, gently
      if (whooshGain && whooshFilter) {
        const vw = engine.getVentWave();
        const env = vw.connected && !vw.standby ? whooshEnv(engine.getBreathPhase()) : 0;
        whooshGain.gain.setTargetAtTime(env * 0.15, now, 0.06);
        whooshFilter.frequency.setTargetAtTime(480 + 320 * env, now, 0.08);
      }

      // pump motor tick every few seconds while any channel runs
      pumpAcc += realDtS;
      if (pumpAcc >= 0.25) {
        pumpAcc = 0;
        pumpRunning = engine.getPatient().devices.pumps.some((c) => c.running);
      }
      if (pumpRunning && pumpOut && core.live() && now >= nextTickAt) {
        tone(ctx, pumpOut, {
          at: now + 0.01,
          freq: 318,
          dur: 0.035,
          gain: 0.05,
          release: 0.02,
          harmonic: { ratio: 2.7, level: 0.35 },
        });
        noiseBurst(ctx, pumpOut, core.white, {
          at: now + 0.01,
          dur: 0.02,
          gain: 0.028,
          filter: { type: 'lowpass', freq: 900 },
          offset01: hash01(0x9a17, tickN),
        });
        nextTickAt = now + 2.4 + 1.9 * hash01(0x9a18, tickN++);
      }
      if (!pumpRunning) nextTickAt = Math.max(nextTickAt, now + 0.4);
    } catch {
      /* headless-safe */
    }
  }

  function dispose(): void {
    for (const s of stops) s();
    stops.length = 0;
  }

  return { update, dispose };
}
