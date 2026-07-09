/**
 * Tiny one-shot voice helpers shared by alarms / cues / stethoscope.
 * Every voice gets a click-free envelope (attack/release >= 5 ms, linear
 * ramps), stops itself, and disconnects on end so nothing leaks. All calls
 * are guarded — a missing/closed AudioContext never throws.
 */

export interface ToneSpec {
  /** absolute context time to start at */
  at: number;
  freq: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  /** optional pitch glide target reached at the end of the tone */
  glideTo?: number;
  attack?: number;
  release?: number;
  /** optional single overtone: frequency ratio + relative level */
  harmonic?: { ratio: number; level: number };
}

/** Schedule a synthesized beep/thump/ding into `dest`. */
export function tone(ctx: BaseAudioContext, dest: AudioNode, s: ToneSpec): void {
  try {
    const attack = Math.max(0.005, s.attack ?? 0.005);
    const release = Math.max(0.005, s.release ?? 0.02);
    const dur = Math.max(s.dur, attack + release + 0.004);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, s.at);
    g.gain.linearRampToValueAtTime(s.gain, s.at + attack);
    g.gain.setValueAtTime(s.gain, Math.max(s.at + attack, s.at + dur - release));
    g.gain.linearRampToValueAtTime(0, s.at + dur);
    g.connect(dest);

    const end = s.at + dur + 0.02;
    const voices: OscillatorNode[] = [];
    const osc = ctx.createOscillator();
    osc.type = s.type ?? 'sine';
    osc.frequency.setValueAtTime(s.freq, s.at);
    if (s.glideTo !== undefined) osc.frequency.linearRampToValueAtTime(s.glideTo, s.at + dur);
    osc.connect(g);
    voices.push(osc);
    if (s.harmonic) {
      const og = ctx.createGain();
      og.gain.value = s.harmonic.level;
      og.connect(g);
      const o2 = ctx.createOscillator();
      o2.type = s.type ?? 'sine';
      o2.frequency.setValueAtTime(s.freq * s.harmonic.ratio, s.at);
      if (s.glideTo !== undefined) {
        o2.frequency.linearRampToValueAtTime(s.glideTo * s.harmonic.ratio, s.at + dur);
      }
      o2.connect(og);
      voices.push(o2);
    }
    for (const v of voices) {
      v.start(s.at);
      v.stop(end);
    }
    voices[0].onended = () => {
      try {
        g.disconnect();
      } catch {
        /* already gone */
      }
    };
  } catch {
    /* no-audio env */
  }
}

export interface NoiseSpec {
  at: number;
  dur: number;
  gain: number;
  attack?: number;
  release?: number;
  /** optional shaping filter in front of the envelope */
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  /** 0..1 read offset into the (looping) buffer — decorrelates bursts */
  offset01?: number;
}

/** Schedule a filtered burst from a shared noise buffer into `dest`. */
export function noiseBurst(
  ctx: BaseAudioContext,
  dest: AudioNode,
  buffer: AudioBuffer | null,
  s: NoiseSpec,
): void {
  if (!buffer) return;
  try {
    const attack = Math.max(0.005, s.attack ?? 0.005);
    const release = Math.max(0.005, s.release ?? 0.02);
    const dur = Math.max(s.dur, attack + release + 0.004);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, s.at);
    g.gain.linearRampToValueAtTime(s.gain, s.at + attack);
    g.gain.setValueAtTime(s.gain, Math.max(s.at + attack, s.at + dur - release));
    g.gain.linearRampToValueAtTime(0, s.at + dur);
    g.connect(dest);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    let head: AudioNode = src;
    if (s.filter) {
      const f = ctx.createBiquadFilter();
      f.type = s.filter.type;
      f.frequency.value = s.filter.freq;
      if (s.filter.q !== undefined) f.Q.value = s.filter.q;
      head.connect(f);
      head = f;
    }
    head.connect(g);
    const offset = Math.max(0, (s.offset01 ?? 0) * Math.max(0, buffer.duration - 0.05));
    src.start(s.at, offset);
    src.stop(s.at + dur + 0.02);
    src.onended = () => {
      try {
        g.disconnect();
      } catch {
        /* already gone */
      }
    };
  } catch {
    /* no-audio env */
  }
}
