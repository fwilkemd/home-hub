/**
 * Predicate evaluator (SPEC §5.5) over vitals / base physiology / elapsed
 * time / the event log, with `sustained` accumulator timers advanced each
 * tick. Standalone-testable: no engine wiring, just a PredicateCtx.
 */
import type { CmpOp, Predicate } from '../../contracts/content';
import type { SimEvent } from '../../contracts/events';
import type { VitalSigns } from '../../contracts/patient';
import { matchWhere } from '../log';
import { getPath } from '../paths';

export interface PredicateCtx {
  vitals: VitalSigns;
  /** BASE physiology (scripts/ramps target base, so predicates read base) */
  physiology: Record<string, number>;
  elapsed: number;
  events: readonly SimEvent[];
}

/** Per-run accumulator state for `sustained` nodes (keyed by node identity). */
export interface PredicateState {
  sustained: Map<Predicate, { acc: number; lapse: number }>;
}

export function createPredicateState(): PredicateState {
  return { sustained: new Map() };
}

function cmp(op: CmpOp, a: number, b: number): boolean {
  switch (op) {
    case 'lt':
      return a < b;
    case 'lte':
      return a <= b;
    case 'gt':
      return a > b;
    case 'gte':
      return a >= b;
    case 'eq':
      return a === b;
  }
}

/** Resolve a `path` for vital/sustained nodes: vitals by default, with an
 * explicit 'physiology.' prefix escape hatch for base params. */
function resolvePath(ctx: PredicateCtx, path: string): number | undefined {
  const raw = path.startsWith('physiology.')
    ? ctx.physiology[path.slice('physiology.'.length)]
    : getPath(ctx.vitals, path);
  return typeof raw === 'number' ? raw : undefined;
}

function eventOccurred(
  ctx: PredicateCtx,
  eventType: string,
  where?: Record<string, string | number | boolean>,
  withinLastS?: number,
): boolean {
  const cutoff = withinLastS === undefined ? -Infinity : ctx.elapsed - withinLastS;
  for (let i = ctx.events.length - 1; i >= 0; i--) {
    const e = ctx.events[i];
    if (e.t < cutoff) return false; // log is time-ordered
    if (e.type !== eventType) continue;
    if (where && !matchWhere(e, where)) continue;
    return true;
  }
  return false;
}

/**
 * Evaluate a predicate. IMPORTANT: child predicates of and/or/not are ALL
 * evaluated (no short-circuit) so nested `sustained` accumulators keep
 * advancing deterministically regardless of sibling values.
 */
export function evalPredicate(
  p: Predicate,
  ctx: PredicateCtx,
  state: PredicateState,
  dt: number,
): boolean {
  switch (p.type) {
    case 'vital': {
      const v = resolvePath(ctx, p.path);
      return v !== undefined && cmp(p.op, v, p.value);
    }
    case 'physiology': {
      const v = ctx.physiology[p.param];
      return typeof v === 'number' && cmp(p.op, v, p.value);
    }
    case 'elapsed':
      return p.op === 'gt' ? ctx.elapsed > p.seconds : ctx.elapsed < p.seconds;
    case 'eventOccurred':
      return eventOccurred(ctx, p.eventType, p.where, p.withinLastS);
    case 'sustained': {
      const v = resolvePath(ctx, p.path);
      const holding = v !== undefined && cmp(p.op, v, p.value);
      const s = state.sustained.get(p) ?? { acc: 0, lapse: 0 };
      if (holding) {
        s.acc += dt;
        s.lapse = 0;
      } else {
        // Lapses up to graceS pause the clock instead of resetting it —
        // physiologic noise must not make near-threshold sustains unreachable.
        s.lapse += dt;
        if (s.lapse > (p.graceS ?? 0) + 1e-9) s.acc = 0;
      }
      state.sustained.set(p, s);
      return s.acc >= p.seconds - 1e-9;
    }
    case 'and': {
      let all = true;
      for (const c of p.conditions) if (!evalPredicate(c, ctx, state, dt)) all = false;
      return all;
    }
    case 'or': {
      let any = false;
      for (const c of p.conditions) if (evalPredicate(c, ctx, state, dt)) any = true;
      return any;
    }
    case 'not':
      return !evalPredicate(p.condition, ctx, state, dt);
  }
}
