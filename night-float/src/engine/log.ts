/**
 * Append-only SimEvent log — the source of truth for debrief, rubric and
 * replay (SPEC §5, §13).
 */
import type { SimEvent, SimEventBody, SimEventType } from '../contracts/events';

export class EventLog {
  private events: SimEvent[] = [];
  private seq = 0;
  private listeners = new Set<(e: SimEvent) => void>();

  append(t: number, body: SimEventBody): SimEvent {
    const e = { t, seq: this.seq++, ...body } as SimEvent;
    this.events.push(e);
    for (const l of this.listeners) l(e);
    return e;
  }

  onAppend(l: (e: SimEvent) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  all(): readonly SimEvent[] {
    return this.events;
  }

  /** last event of a type, optionally matching a shallow `where` */
  findLast<T extends SimEventType>(
    type: T,
    where?: Record<string, unknown>,
  ): Extract<SimEvent, { type: T }> | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      if (e.type !== type) continue;
      if (where && !matchWhere(e, where)) continue;
      return e as Extract<SimEvent, { type: T }>;
    }
    return undefined;
  }

  count(type: SimEventType, where?: Record<string, unknown>): number {
    let n = 0;
    for (const e of this.events) {
      if (e.type === type && (!where || matchWhere(e, where))) n++;
    }
    return n;
  }

  toJSON(): SimEvent[] {
    return [...this.events];
  }

  restore(events: SimEvent[]): void {
    this.events = [...events];
    this.seq = events.length ? Math.max(...events.map((e) => e.seq)) + 1 : 0;
  }
}

/**
 * Shallow field match with one level of dot-path support
 * (e.g. { "order.kind": "med" }).
 */
export function matchWhere(e: SimEvent, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    let val: unknown = e as unknown as Record<string, unknown>;
    for (const part of k.split('.')) {
      if (val == null || typeof val !== 'object') return false;
      val = (val as Record<string, unknown>)[part];
    }
    if (val !== v) return false;
  }
  return true;
}
