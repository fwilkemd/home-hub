/**
 * Stethoscope auscultation (SPEC §12). On ExamPerformed(auscultate) the
 * ambience ducks ~70% and a ~7s synthesized program for the examined zone
 * plays: S1/S2 heart thumps timed by the shared BeatClock (bit-identical
 * schedule to the monitor tracing), breath-gated lung noise recipes, or
 * sparse bowel gurgles. Stethoscope output is non-spatial — it is in the
 * player's ears — and routes through a program-level fade + muffle lowpass.
 *
 * All recipes here are plausible defaults.
 * TODO(MEDICAL): real acoustics per finding (murmur timing/character
 * taxonomy, crackle fine/coarse split, wheeze polyphony, bowel activity).
 */
import { bus } from '../bridge/bus';
import type { BodyZoneId } from '../contracts/ids';
import { isEvent } from '../contracts/events';
import type { AuscultationParams } from '../contracts/patient';
import type { EngineHandle } from '../contracts/runtime';
import { BeatClock, INSP_FRACTION, clamp } from '../engine/waveforms';
import { hash01 } from '../engine/rng';
import type { AudioCore } from './context';
import { noiseBurst, tone } from './synth';

const PROGRAM_S = 7;
const DUCK = 0.3; // ambience at 30% while listening

const DEFAULT_PARAMS: AuscultationParams = {
  heartMurmur: 0,
  heartMuffled: 0,
  lungRecipe: 'clear',
  lungIntensity: 0.5,
};

type ProgramKind = 'heart' | 'lung' | 'abdomen' | 'faint';

function kindForZone(zone: BodyZoneId): ProgramKind {
  if (zone === 'precordium' || zone === 'neck') return 'heart';
  if (zone === 'chest_left' || zone === 'chest_right') return 'lung';
  if (zone === 'abdomen') return 'abdomen';
  return 'faint'; // head/extremities: only distant transmitted sounds
}

interface Program {
  kind: ProgramKind;
  p: AuscultationParams;
  endPerfS: number;
  clock: BeatClock;
  lastBeat: number;
  murmurN: number;
  prevBreathPhase: number;
  breathIdx: number;
  clickPhases: number[];
  nextGurgleAt: number;
  gurgleN: number;
  lungGain: GainNode | null;
  wheezeGain: GainNode | null;
  wheezeFilter: BiquadFilterNode | null;
  sources: AudioBufferSourceNode[];
}

export interface Steth {
  update(): void;
  dispose(): void;
}

export function createSteth(core: AudioCore, engine: EngineHandle): Steth {
  const ctx = core.ctx;
  const sfxBus = core.bus('sfx');
  if (!ctx || !sfxBus) return { update: () => {}, dispose: () => {} };
  const ac: AudioContext = ctx; // non-null alias visible inside hoisted fns

  // fixed chain, reused across programs: voices -> programGain -> muffle -> sfx
  let programGain: GainNode | null = null;
  let muffle: BiquadFilterNode | null = null;
  try {
    programGain = ac.createGain();
    programGain.gain.value = 0;
    muffle = ac.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 6000;
    programGain.connect(muffle);
    muffle.connect(sfxBus);
  } catch {
    programGain = null;
  }

  let prog: Program | null = null;

  function killChains(pr: Program, fadeS: number): void {
    try {
      const t = ac.currentTime;
      pr.lungGain?.gain.setTargetAtTime(0, t, Math.max(0.01, fadeS / 3));
      pr.wheezeGain?.gain.setTargetAtTime(0, t, Math.max(0.01, fadeS / 3));
      for (const s of pr.sources) {
        try {
          s.stop(t + fadeS + 0.05);
        } catch {
          /* already stopped */
        }
      }
    } catch {
      /* headless-safe */
    }
    pr.sources.length = 0;
  }

  function stopProgram(fadeS = 0.3): void {
    if (!prog) return;
    try {
      programGain?.gain.setTargetAtTime(0, ac.currentTime, Math.max(0.01, fadeS / 3));
    } catch {
      /* headless-safe */
    }
    killChains(prog, fadeS);
    core.duckAmbience(1, 0.6);
    prog = null;
  }

  function genClicks(pr: Program): void {
    // deterministic per-breath cluster of fine clicks in late inspiration
    const n = 2 + Math.round(4 * pr.p.lungIntensity);
    pr.clickPhases = [];
    for (let k = 0; k < n; k++) {
      pr.clickPhases.push(INSP_FRACTION * (0.55 + 0.42 * hash01(pr.breathIdx * 97 + 13, k)));
    }
  }

  function buildLungChains(pr: Program): void {
    if (!core.white || !programGain) return;
    try {
      // broadband breath noise. TODO(MEDICAL): real vesicular/bronchial spectra.
      const src = ac.createBufferSource();
      src.buffer = core.white;
      src.loop = true;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 430;
      bp.Q.value = 0.9;
      const g = ac.createGain();
      g.gain.value = 0;
      src.connect(bp);
      bp.connect(g);
      g.connect(programGain);
      src.start();
      pr.sources.push(src);
      pr.lungGain = g;

      if (pr.p.lungRecipe === 'wheeze') {
        // narrow ~400 Hz expiratory whistle. TODO(MEDICAL): polyphonic wheeze.
        const wsrc = ac.createBufferSource();
        wsrc.buffer = core.white;
        wsrc.loop = true;
        const wbp = ac.createBiquadFilter();
        wbp.type = 'bandpass';
        wbp.frequency.value = 400;
        wbp.Q.value = 18;
        const wg = ac.createGain();
        wg.gain.value = 0;
        wsrc.connect(wbp);
        wbp.connect(wg);
        wg.connect(programGain);
        wsrc.start();
        pr.sources.push(wsrc);
        pr.wheezeGain = wg;
        pr.wheezeFilter = wbp;
      }
    } catch {
      /* headless-safe */
    }
  }

  function start(zone: BodyZoneId): void {
    if (!programGain || !muffle) return;
    if (prog) stopProgram(0.08);
    const p = engine.getPatient().exam[zone]?.auscultation ?? DEFAULT_PARAMS;
    const kind = kindForZone(zone);
    const program: Program = {
      kind,
      p,
      endPerfS: performance.now() / 1000 + PROGRAM_S,
      clock: new BeatClock(engine.getWaveformParams().beatSeed),
      lastBeat: -1,
      murmurN: 0,
      prevBreathPhase: engine.getBreathPhase(),
      breathIdx: 0,
      clickPhases: [],
      nextGurgleAt: 0,
      gurgleN: 0,
      lungGain: null,
      wheezeGain: null,
      wheezeFilter: null,
      sources: [],
    };
    try {
      const t = ac.currentTime;
      // muffling (effusion, habitus) rolls the highs off and softens thumps.
      // TODO(MEDICAL): real muffling acoustics.
      const heartFocus = kind === 'heart' || kind === 'faint';
      muffle.frequency.setTargetAtTime(heartFocus ? 1400 - 1150 * p.heartMuffled : 6000, t, 0.05);
      programGain.gain.setTargetAtTime(kind === 'faint' ? 0.3 : 1, t, 0.05);
      core.duckAmbience(DUCK, 0.15);
      if (kind === 'lung') {
        buildLungChains(program);
        if (p.lungRecipe === 'crackles') genClicks(program);
      }
    } catch {
      /* headless-safe */
    }
    prog = program;
  }

  function heartTick(pr: Program, scale: number, perfS: number): void {
    const wf = engine.getWaveformParams();
    pr.clock.update({ rhythm: wf.ecg.rhythm, rate: wf.ecg.rate }, perfS);
    const info = pr.clock.phaseAt(perfS);
    if (!info.inBeat || info.beatIndex === pr.lastBeat) return; // vf/asystole stay silent
    if (pr.lastBeat < 0) {
      pr.lastBeat = info.beatIndex; // don't fire mid-beat on program start
      return;
    }
    pr.lastBeat = info.beatIndex;
    if (!programGain) return;
    const damp = 1 - 0.35 * pr.p.heartMuffled;
    const t0 = ac.currentTime + 0.02;
    const sys = clamp(info.interval * 0.34, 0.16, 0.38);
    // S1/S2 low thumps. TODO(MEDICAL): heart-sound acoustics, splits, gallops.
    tone(ac, programGain, {
      at: t0,
      freq: 55,
      dur: 0.085,
      gain: 0.5 * scale * damp,
      release: 0.06,
      harmonic: { ratio: 2, level: 0.55 },
    });
    tone(ac, programGain, {
      at: t0 + sys,
      freq: 45,
      dur: 0.07,
      gain: 0.38 * scale * damp,
      release: 0.05,
      harmonic: { ratio: 2, level: 0.55 },
    });
    if (pr.p.heartMurmur > 0.02) {
      // systolic band-passed noise between S1 and S2. TODO(MEDICAL): murmur taxonomy.
      noiseBurst(ac, programGain, core.white, {
        at: t0 + 0.05,
        dur: Math.max(0.05, sys - 0.08),
        gain: 0.38 * pr.p.heartMurmur * scale,
        attack: 0.02,
        release: 0.03,
        filter: { type: 'bandpass', freq: 260, q: 1.3 },
        offset01: hash01(0x3a7b, pr.murmurN++),
      });
    }
  }

  function lungTick(pr: Program): void {
    const phase = engine.getBreathPhase();
    const I = INSP_FRACTION;
    const r = pr.p.lungRecipe;
    // TODO(MEDICAL): per-recipe gains; 'diminished' quiet, 'absent' near-silent.
    const base = r === 'diminished' ? 0.3 : r === 'absent' ? 0.04 : 1;
    const insp = phase < I ? Math.sin((Math.PI * phase) / I) : 0;
    const exp = phase >= I ? Math.sin((Math.PI * (phase - I)) / (1 - I)) : 0;
    const t = ac.currentTime;
    try {
      // inspiration louder than expiration for the soft vesicular swell
      pr.lungGain?.gain.setTargetAtTime((insp + 0.35 * exp) * 0.3 * base, t, 0.05);
      if (pr.wheezeGain && pr.wheezeFilter) {
        pr.wheezeGain.gain.setTargetAtTime(exp * 0.5 * pr.p.lungIntensity, t, 0.05);
        pr.wheezeFilter.frequency.setTargetAtTime(395 + 28 * Math.sin(t * 2.1), t, 0.1);
      }
    } catch {
      /* headless-safe */
    }
    if (r === 'crackles') {
      if (phase < pr.prevBreathPhase - 0.5) {
        pr.breathIdx += 1;
        genClicks(pr); // new breath -> new deterministic click cluster
      } else if (programGain) {
        for (let i = 0; i < pr.clickPhases.length; i++) {
          const cp = pr.clickPhases[i];
          if (pr.prevBreathPhase < cp && phase >= cp) {
            noiseBurst(ac, programGain, core.white, {
              at: t,
              dur: 0.008,
              gain: 0.3 * pr.p.lungIntensity,
              filter: { type: 'highpass', freq: 1500 },
              offset01: hash01(pr.breathIdx * 53 + 29, i),
            });
          }
        }
      }
    }
    pr.prevBreathPhase = phase;
  }

  function abdomenTick(pr: Program): void {
    if (!programGain) return;
    const now = ac.currentTime;
    if (now < pr.nextGurgleAt) return;
    const n = pr.gurgleN++;
    const f0 = 82 + 55 * hash01(0xab5, n);
    // sparse borborygmi at irregular intervals. TODO(MEDICAL): bowel character.
    tone(ac, programGain, {
      at: now + 0.01,
      freq: f0,
      glideTo: f0 * 0.6,
      dur: 0.12 + 0.1 * hash01(0xab7, n),
      gain: 0.15,
      release: 0.06,
      harmonic: { ratio: 2, level: 0.3 },
    });
    noiseBurst(ac, programGain, core.white, {
      at: now + 0.02,
      dur: 0.09,
      gain: 0.045,
      filter: { type: 'lowpass', freq: 330 },
      offset01: hash01(0xab8, n),
    });
    pr.nextGurgleAt = now + 0.55 + 2.6 * hash01(0xab9, n);
  }

  function update(): void {
    if (!prog) return;
    const perfS = performance.now() / 1000;
    if (perfS >= prog.endPerfS) {
      stopProgram();
      return;
    }
    if (!core.live()) return;
    if (prog.kind === 'heart') heartTick(prog, 1, perfS);
    else if (prog.kind === 'faint') heartTick(prog, 0.35, perfS);
    else if (prog.kind === 'lung') {
      lungTick(prog);
      heartTick(prog, 0.15, perfS); // distant heart under the breath sounds
    } else abdomenTick(prog);
  }

  const unsub = bus.on('simEvent', (e) => {
    if (isEvent(e, 'ExamPerformed') && e.mode === 'auscultate') start(e.zone);
  });

  return {
    update,
    dispose(): void {
      unsub();
      stopProgram(0.05);
      try {
        programGain?.disconnect();
      } catch {
        /* already gone */
      }
    },
  };
}
