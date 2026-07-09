/**
 * Audio core (SPEC §12) — lazy AudioContext plus the shared graph:
 *
 *   voices -> sfx --------------------\
 *   voices -> ambience -> duck -------- master -> destination
 *
 * with per-device panner buses for spatialized sources, deterministic noise
 * buffers (hash01 — never Math.random), settings-driven gains kept live via
 * hubStore.subscribe, and autoplay unlocking (self-armed gesture listeners,
 * since nothing else in the app calls AudioHandle.unlock today).
 *
 * Every entry point is guarded: in an environment without AudioContext
 * (jsdom, headless smoke) the core degrades to inert no-ops — it never
 * throws and never logs.
 */
import type { DeviceId } from '../contracts/ids';
import type { WorldHandle } from '../contracts/runtime';
import type { SettingsState } from '../bridge/store';
import { hubStore } from '../bridge/store';
import { hash01 } from '../engine/rng';

export type BusName = 'sfx' | 'ambience';

type V3 = [number, number, number];

export interface AudioCore {
  readonly ctx: AudioContext | null;
  /** deterministic loop buffers shared by all synth modules */
  readonly white: AudioBuffer | null;
  readonly brown: AudioBuffer | null;
  /** context exists, is running and not disposed — gate for one-shot scheduling */
  live(): boolean;
  now(): number;
  bus(name: BusName): GainNode | null;
  /** shared per-device fan-in; routed through a panner when a world exists */
  spatialInput(device: DeviceId, bus: BusName): GainNode | null;
  /** stethoscope duck — scales the ambience bus (1 = normal, 0.3 = ducked) */
  duckAmbience(factor: number, rampS?: number): void;
  /** per frame: listener pose + periodic device-placement refresh */
  updateSpatial(world: WorldHandle | null, realDtS: number): void;
  unlock(): void;
  dispose(): void;
}

const PLACEMENT_REFRESH_S = 2;

/** perceptual-ish taper for the 0..1 settings sliders */
const taper = (v: number): number => Math.min(1, Math.max(0, v)) ** 2;

/** hash01-driven noise, loop-safe. Brown = leaky-integrated white, tail crossfaded. */
function makeNoise(ctx: AudioContext, seconds: number, seed: number, brown: boolean): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * seconds));
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let acc = 0;
  for (let i = 0; i < len; i++) {
    const w = hash01(seed, i) * 2 - 1;
    if (brown) {
      acc = (acc + 0.02 * w) / 1.02;
      d[i] = acc * 3.5;
    } else {
      d[i] = w;
    }
  }
  if (brown) {
    // crossfade the tail into the head so the loop wraps without a tick
    const fade = Math.min(Math.floor(sr * 0.25), len >> 1);
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      const j = len - fade + i;
      d[j] = d[j] * (1 - a) + d[i] * a;
    }
  }
  return buf;
}

function setPannerPos(p: PannerNode, [x, y, z]: V3): void {
  if ((p as { positionX?: AudioParam }).positionX) {
    p.positionX.value = x;
    p.positionY.value = y;
    p.positionZ.value = z;
  } else {
    p.setPosition(x, y, z);
  }
}

function setListenerPose(l: AudioListener, pos: V3, fwd: V3): void {
  if ((l as { positionX?: AudioParam }).positionX) {
    l.positionX.value = pos[0];
    l.positionY.value = pos[1];
    l.positionZ.value = pos[2];
    l.forwardX.value = fwd[0];
    l.forwardY.value = fwd[1];
    l.forwardZ.value = fwd[2];
    l.upX.value = 0;
    l.upY.value = 1;
    l.upZ.value = 0;
  } else {
    l.setPosition(pos[0], pos[1], pos[2]);
    l.setOrientation(fwd[0], fwd[1], fwd[2], 0, 1, 0);
  }
}

interface SpatialEntry {
  device: DeviceId;
  input: GainNode;
  panner: PannerNode | null;
}

export function createAudioCore(spatialize: boolean): AudioCore {
  let ctx: AudioContext | null = null;
  try {
    const w =
      typeof window !== 'undefined'
        ? (window as unknown as {
            AudioContext?: typeof AudioContext;
            webkitAudioContext?: typeof AudioContext;
          })
        : undefined;
    const Ctor = w?.AudioContext ?? w?.webkitAudioContext;
    ctx = Ctor ? new Ctor({ latencyHint: 'interactive' }) : null;
  } catch {
    ctx = null;
  }

  let disposed = false;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let ambience: GainNode | null = null;
  let duck: GainNode | null = null;
  let white: AudioBuffer | null = null;
  let brown: AudioBuffer | null = null;
  const spatials = new Map<string, SpatialEntry>();
  let placementAcc = PLACEMENT_REFRESH_S; // position panners on the first update

  try {
    if (ctx) {
      master = ctx.createGain();
      master.connect(ctx.destination);
      duck = ctx.createGain();
      duck.connect(master);
      sfx = ctx.createGain();
      sfx.connect(master);
      ambience = ctx.createGain();
      ambience.connect(duck);
      white = makeNoise(ctx, 2, 0x57a17e, false);
      brown = makeNoise(ctx, 4, 0x0b7047, true);
    }
  } catch {
    master = sfx = ambience = duck = null;
  }

  function applyGains(s: SettingsState): void {
    if (!ctx || !master || !sfx || !ambience) return;
    try {
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(taper(s.masterVol), t, 0.03);
      sfx.gain.setTargetAtTime(taper(s.sfxVol), t, 0.03);
      ambience.gain.setTargetAtTime(taper(s.ambienceVol), t, 0.03);
    } catch {
      /* headless-safe */
    }
  }
  applyGains(hubStore.getState().settings);
  const unsubStore = hubStore.subscribe((s, prev) => {
    if (s.settings !== prev.settings) applyGains(s.settings);
  });

  // ---- autoplay policy: resume on the first user gesture -------------------
  function unlock(): void {
    if (!ctx || disposed) return;
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {
      /* headless-safe */
    }
  }
  const onGesture = (): void => {
    unlock();
    removeGestureListeners();
  };
  function removeGestureListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
  }
  if (ctx && typeof window !== 'undefined') {
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });
  }

  function spatialInput(device: DeviceId, busName: BusName): GainNode | null {
    if (!ctx || disposed) return null;
    const key = `${device}:${busName}`;
    const existing = spatials.get(key);
    if (existing) return existing.input;
    const target = busName === 'sfx' ? sfx : ambience;
    if (!target) return null;
    try {
      const input = ctx.createGain();
      let panner: PannerNode | null = null;
      if (spatialize) {
        panner = ctx.createPanner();
        panner.panningModel = 'equalpower';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1.2;
        panner.rolloffFactor = 0.55;
        input.connect(panner);
        panner.connect(target);
      } else {
        input.connect(target); // no world -> plain stereo
      }
      spatials.set(key, { device, input, panner });
      placementAcc = PLACEMENT_REFRESH_S; // pick up a position on next update
      return input;
    } catch {
      return null;
    }
  }

  return {
    ctx,
    white,
    brown,
    live: () => !!ctx && !disposed && ctx.state === 'running',
    now: () => ctx?.currentTime ?? 0,
    bus: (name) => (name === 'sfx' ? sfx : ambience),
    spatialInput,

    duckAmbience(factor: number, rampS = 0.15): void {
      if (!ctx || !duck || disposed) return;
      try {
        duck.gain.setTargetAtTime(Math.max(0, factor), ctx.currentTime, Math.max(0.01, rampS / 3));
      } catch {
        /* headless-safe */
      }
    },

    updateSpatial(world: WorldHandle | null, realDtS: number): void {
      if (!ctx || !world || !spatialize || disposed) return;
      try {
        placementAcc += realDtS;
        if (placementAcc >= PLACEMENT_REFRESH_S) {
          placementAcc = 0;
          const placements = world.getDevicePlacements();
          for (const entry of spatials.values()) {
            if (!entry.panner) continue;
            const pl = placements.find((p) => p.device === entry.device);
            if (pl) setPannerPos(entry.panner, pl.position);
          }
        }
        const pose = world.getListenerPose();
        setListenerPose(ctx.listener, pose.position, pose.forward);
      } catch {
        /* headless-safe */
      }
    },

    unlock,

    dispose(): void {
      if (disposed) return;
      disposed = true;
      removeGestureListeners();
      unsubStore();
      try {
        if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      } catch {
        /* headless-safe */
      }
      try {
        ctx?.close().catch(() => {});
      } catch {
        /* headless-safe */
      }
    },
  };
}
