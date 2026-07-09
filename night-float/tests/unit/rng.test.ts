import { describe, expect, it } from 'vitest';
import { hash01, makeRng } from '../../src/engine/rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng(1234);
    const b = makeRng(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('forks independent streams', () => {
    const a = makeRng(42);
    const fork1 = a.fork('labs');
    // consuming the parent must not change an equivalent fork made later
    a.next();
    a.next();
    const b = makeRng(42);
    const fork2 = b.fork('labs');
    expect(fork1.next()).toBe(fork2.next());
  });

  it('hash01 agrees across call sites and stays in [0,1)', () => {
    for (let i = 0; i < 50; i++) {
      const v = hash01(7, i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(hash01(7, i)).toBe(v);
    }
  });

  it('string seeds work', () => {
    const a = makeRng('scenario-crashing');
    const b = makeRng('scenario-crashing');
    expect(a.next()).toBe(b.next());
  });
});
