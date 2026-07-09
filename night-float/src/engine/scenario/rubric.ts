/**
 * Rubric engine (SPEC §13): declarative conditions over the event log.
 * Pure — evaluates a ScenarioRubric against a finished (or running) log.
 * Real rubric CONTENT is medical-pass work; this evaluator is machinery.
 */
import type { RubricCondition, ScenarioRubric } from '../../contracts/content';
import type { SimEvent } from '../../contracts/events';
import type { RubricResult } from '../../contracts/runtime';
import { matchWhere } from '../log';

function findMatches(
  events: readonly SimEvent[],
  eventType: string,
  where?: Record<string, unknown>,
): SimEvent[] {
  return events.filter((e) => e.type === eventType && (!where || matchWhere(e, where)));
}

export function evaluateCondition(cond: RubricCondition, events: readonly SimEvent[]): boolean {
  switch (cond.type) {
    case 'eventOccurred':
      return findMatches(events, cond.eventType, cond.where).length > 0;
    case 'never':
      return findMatches(events, cond.eventType, cond.where).length === 0;
    case 'eventWithin': {
      const anchors = findMatches(events, cond.afterEventType, cond.afterWhere);
      if (anchors.length === 0) return false;
      const hits = findMatches(events, cond.eventType, cond.where);
      return anchors.some((a) =>
        hits.some((h) => h.t >= a.t && h.t - a.t <= cond.windowS),
      );
    }
    case 'outcome': {
      const end = events.find((e) => e.type === 'ScenarioEnded');
      return !!end && end.type === 'ScenarioEnded' && end.outcome === cond.outcome;
    }
  }
}

export function evaluateRubric(
  rubric: ScenarioRubric,
  events: readonly SimEvent[],
): RubricResult[] {
  return rubric.items.map((item) => {
    const pass = evaluateCondition(item.condition, events);
    return {
      id: item.id,
      label: item.label,
      detail: item.detail,
      points: item.points,
      earned: pass ? item.points : 0,
      pass,
    };
  });
}
