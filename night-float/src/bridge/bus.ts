/**
 * Typed event bus (SPEC §3). SimEvents fan out here; audio/UI subscribe
 * without polling the store.
 */
import type { SimEvent } from '../contracts/events';

export type BusEvents = {
  simEvent: SimEvent;
  /** soft chime cues (auto time-drop, stat result, tutorial advance) */
  chime: { kind: 'timeDrop' | 'result' | 'tutorial' | 'success' };
  /** a beat fired on the monitor — audio beeps (pitch follows SpO2) */
  qrsBeep: { spo2: number };
  /** UI click feedback for device screens */
  screenClick: { device: string };
};

type Handler<T> = (v: T) => void;

class TypedBus<M extends Record<string, unknown>> {
  private handlers = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(key: K, h: Handler<M[K]>): () => void {
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(h as Handler<never>);
    return () => set.delete(h as Handler<never>);
  }

  emit<K extends keyof M>(key: K, value: M[K]): void {
    const set = this.handlers.get(key);
    if (!set) return;
    for (const h of set) (h as Handler<M[K]>)(value);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const bus = new TypedBus<BusEvents>();
