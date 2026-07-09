/**
 * Deterministic seeded RNG (mulberry32). ALL randomness in the engine must
 * flow through one of these — never Math.random — so a seed + event log
 * replays identically.
 */
export interface Rng {
  /** [0, 1) */
  next(): number;
  range(lo: number, hi: number): number;
  int(lo: number, hi: number): number;
  chance(p: number): boolean;
  /** gaussian-ish noise, mean 0, sd 1 (sum of uniforms) */
  gauss(): number;
  /** independent deterministic stream — call order in one stream can't perturb another */
  fork(label: string): Rng;
  getState(): number;
  setState(s: number): void;
}

export function hashString(s: string): number {
  // xmur3
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function makeRng(seed: number | string): Rng {
  let a = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9;

  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    gauss: () => next() + next() + next() + next() - 2,
    fork: (label) => makeRng(hashString(label) ^ a),
    getState: () => a >>> 0,
    setState: (s) => {
      a = s >>> 0;
    },
  };
  return rng;
}

/** Stateless hash-noise in [0,1) — for per-index jitter that all consumers agree on. */
export function hash01(seed: number, index: number): number {
  let h = (seed ^ Math.imul(index + 0x9e3779b9, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
