/**
 * Alarm SOUND side (SPEC §12). Alarm STATE lives in the engine
 * (src/engine/alarms.ts); this module reads engine.getActiveAlarms() every
 * frame and turns it into per-source cadences: the highest priority per
 * source wins, each source is spatialized at its device via the core's
 * panner buses, silenced/resolved alarms gate off within milliseconds and
 * resume when the silence window (SIM time) expires.
 *
 * Scheduling: a short-lookahead loop against context.currentTime — voices
 * are scheduled at most LOOKAHEAD_S ahead so a fresh silence can cut them
 * off via the per-source gate without audible leftovers.
 */
import type { AlarmPriority, DeviceId } from '../contracts/ids';
import type { EngineHandle } from '../contracts/runtime';
import type { AudioCore } from './context';
import { tone } from './synth';

const LOOKAHEAD_S = 0.25;
const RANK: Record<AlarmPriority, number> = { advisory: 0, warning: 1, crisis: 2 };
/** the only devices that raise alarms today — natural voice cap of three */
const SOURCES: DeviceId[] = ['monitor', 'vent', 'pump'];

interface Pulse {
  t: number;
  f: number;
  d: number;
}
interface Pattern {
  period: number;
  gain: number;
  pulses: Pulse[];
  glide?: number;
}

/** IEC-flavored cadences per priority. TODO(MEDICAL): true IEC 60601-1-8 melodies. */
const PATTERNS: Record<AlarmPriority, Pattern> = {
  crisis: {
    // fast, insistent 3+2 burst around 880-990 Hz
    period: 2.5,
    gain: 0.42,
    pulses: [
      { t: 0, f: 988, d: 0.1 },
      { t: 0.17, f: 988, d: 0.1 },
      { t: 0.34, f: 988, d: 0.1 },
      { t: 0.62, f: 880, d: 0.1 },
      { t: 0.79, f: 880, d: 0.1 },
    ],
  },
  warning: {
    // two-tone medium pattern
    period: 8,
    gain: 0.32,
    pulses: [
      { t: 0, f: 660, d: 0.16 },
      { t: 0.38, f: 524, d: 0.22 },
    ],
  },
  advisory: {
    // single soft chirp
    period: 20,
    gain: 0.22,
    glide: 470,
    pulses: [{ t: 0, f: 520, d: 0.2 }],
  },
};

interface SourceVoice {
  gate: GainNode;
  /** priority currently sounding (null = gated off) */
  priority: AlarmPriority | null;
  /** context time the next cadence period starts */
  nextAt: number;
}

export interface AlarmSounds {
  update(): void;
  dispose(): void;
}

export function createAlarmSounds(core: AudioCore, engine: EngineHandle): AlarmSounds {
  const ctx = core.ctx;
  const voices = new Map<DeviceId, SourceVoice>();
  if (ctx) {
    for (const src of SOURCES) {
      const out = core.spatialInput(src, 'sfx');
      if (!out) continue;
      try {
        const gate = ctx.createGain();
        gate.gain.value = 0;
        gate.connect(out);
        voices.set(src, { gate, priority: null, nextAt: 0 });
      } catch {
        /* no-audio env */
      }
    }
  }

  function update(): void {
    if (!ctx || voices.size === 0) return;
    const simTime = engine.getSimTime();
    // highest audible priority per source (silencedUntil is SIM time)
    const best = new Map<DeviceId, AlarmPriority>();
    for (const a of engine.getActiveAlarms()) {
      if (!a.active || a.silencedUntil > simTime) continue;
      const cur = best.get(a.source);
      if (!cur || RANK[a.priority] > RANK[cur]) best.set(a.source, a.priority);
    }

    const now = ctx.currentTime;
    for (const [src, v] of voices) {
      const want = best.get(src) ?? null;
      if (want !== v.priority) {
        try {
          if (want) {
            v.gate.gain.setTargetAtTime(1, now, 0.008);
            v.nextAt = now + 0.03; // (re)start the cadence promptly
          } else {
            // silenced or resolved: gate off the instant it happens
            v.gate.gain.setTargetAtTime(0, now, 0.004);
          }
        } catch {
          /* headless-safe */
        }
        v.priority = want;
      }
      if (!want || !core.live()) continue;
      const pat = PATTERNS[want];
      if (v.nextAt < now) v.nextAt = now + 0.02; // resync after suspend/lag
      while (v.nextAt < now + LOOKAHEAD_S) {
        for (const p of pat.pulses) {
          tone(ctx, v.gate, {
            at: v.nextAt + p.t,
            freq: p.f,
            glideTo: pat.glide,
            dur: p.d,
            gain: pat.gain,
            attack: 0.006,
            release: 0.03,
            harmonic: { ratio: 2, level: 0.22 },
          });
        }
        v.nextAt += pat.period;
      }
    }
  }

  function dispose(): void {
    for (const v of voices.values()) {
      try {
        v.gate.gain.setTargetAtTime(0, core.now(), 0.005);
        v.gate.disconnect();
      } catch {
        /* already gone */
      }
    }
    voices.clear();
  }

  return { update, dispose };
}
