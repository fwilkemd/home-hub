/**
 * Alarm manager (SPEC §12) — the STATE machine only; sounds live in /audio.
 * Sources: monitor vital limits (scenario content, with engine fallbacks),
 * built-in lethal-rhythm rules, vent alarms, pump occlusion.
 * Semantics: a condition must hold ~3s before raising (debounce), an alarm
 * resolves after the condition has been clear ~5s, silencing keeps it listed
 * but flags it for the audio layer, and any new warning/crisis alarm drops
 * time compression to 1x.
 */
import type { AlarmLimit } from '../contracts/patient';
import type { AlarmPriority, DeviceId } from '../contracts/ids';
import type { ActiveAlarm } from '../contracts/runtime';
import type { EngineCtx } from './types';
import type { VentHandle } from './vent';
import { getPath } from './paths';

const DEBOUNCE_S = 3; // condition must hold this long before raising
const RESOLVE_S = 5; // condition must be clear this long before resolving
const DEFAULT_SILENCE_S = 120;

/**
 * Fallback monitor limits used only when the scenario ships none.
 * Keys may carry a '#tier' suffix so one vital can have stacked thresholds.
 * TODO(MEDICAL): sensible default alarm limits per vital.
 */
export const DEFAULT_MONITOR_LIMITS: Record<string, AlarmLimit> = {
  spo2: { lo: 90, priority: 'warning', label: 'SpO2 low' },
  'spo2#crisis': { lo: 85, priority: 'crisis', label: 'SpO2 critically low' },
  map: { lo: 65, priority: 'warning', label: 'MAP low' },
  'map#crisis': { lo: 55, priority: 'crisis', label: 'MAP critically low' },
  hr: { lo: 45, hi: 130, priority: 'warning', label: 'HR' },
  rr: { hi: 30, priority: 'advisory', label: 'RR high' },
};

interface Condition {
  id: string;
  source: DeviceId;
  priority: AlarmPriority;
  label: string;
}

interface AlarmRecord extends Condition {
  raisedAt: number;
  silencedUntil: number;
  conditionTrue: boolean;
  clearSince: number | null;
}

export interface AlarmsHandle {
  tick(t: number, dt: number): void;
  silence(alarmId: string, durationS?: number): void;
  silenceAll(durationS?: number): void;
  getActive(): ActiveAlarm[];
  serialize(): Array<Pick<AlarmRecord, 'id' | 'raisedAt' | 'silencedUntil'>>;
  restore(list: Array<Pick<AlarmRecord, 'id' | 'raisedAt' | 'silencedUntil'>>): void;
}

export function createAlarms(
  ctx: EngineCtx,
  vent: VentHandle,
  hooks: { onRaised?: (a: Condition) => void } = {},
): AlarmsHandle {
  const active = new Map<string, AlarmRecord>();
  const pendingSince = new Map<string, number>();
  /** save/load: alarms that were live at save time re-adopt their identity
   * (raisedAt, silence window) without re-emitting AlarmRaised */
  const restoredMeta = new Map<string, { raisedAt: number; silencedUntil: number }>();

  function monitorConditions(out: Condition[]): void {
    const configured = ctx.patient.devices.monitor.alarmLimits;
    const limits = Object.keys(configured).length > 0 ? configured : DEFAULT_MONITOR_LIMITS;
    for (const [key, lim] of Object.entries(limits)) {
      const path = key.split('#')[0];
      const value = getPath(ctx.patient.vitals, path);
      if (typeof value !== 'number') continue;
      const both = lim.lo !== undefined && lim.hi !== undefined;
      const base = `monitor-${key.replace(/#/g, '-')}`;
      if (lim.lo !== undefined && value < lim.lo) {
        out.push({
          id: `${base}-lo`,
          source: 'monitor',
          priority: lim.priority,
          label: both ? `${lim.label} low` : lim.label,
        });
      }
      if (lim.hi !== undefined && value > lim.hi) {
        out.push({
          id: `${base}-hi`,
          source: 'monitor',
          priority: lim.priority,
          label: both ? `${lim.label} high` : lim.label,
        });
      }
    }

    // built-in rhythm alarms TODO(MEDICAL): full arrhythmia alarm taxonomy
    const rhythm = ctx.patient.vitals.rhythm;
    if (rhythm === 'vf')
      out.push({ id: 'monitor-rhythm-vf', source: 'monitor', priority: 'crisis', label: 'Ventricular fibrillation' });
    if (rhythm === 'asystole')
      out.push({ id: 'monitor-rhythm-asystole', source: 'monitor', priority: 'crisis', label: 'Asystole' });
    if (rhythm === 'vt')
      out.push({ id: 'monitor-rhythm-vt', source: 'monitor', priority: 'warning', label: 'Ventricular tachycardia' });
  }

  function ventConditions(out: Condition[]): void {
    if (!vent.isVentilating()) return;
    const limits = ctx.patient.devices.vent.alarmLimits;
    const wave = vent.getWave();
    if (wave.ppeak > limits.pawHigh)
      out.push({ id: 'vent-ppeak-hi', source: 'vent', priority: 'warning', label: 'High airway pressure' });
    if (wave.rate > 0 && wave.measuredVteMl < limits.vteLowMl)
      out.push({ id: 'vent-vte-lo', source: 'vent', priority: 'warning', label: 'Low tidal volume' });
    if (vent.secondsSinceBreath() > limits.apneaS)
      out.push({ id: 'vent-apnea', source: 'vent', priority: 'crisis', label: 'Apnea' });
  }

  function pumpConditions(out: Condition[]): void {
    for (const ch of ctx.patient.devices.pumps) {
      if (ch.occluded)
        out.push({
          id: `pump-${ch.id}-occl`,
          source: 'pump',
          priority: 'warning',
          label: `Occlusion — ${ch.label || ch.id}`,
        });
    }
  }

  function tick(t: number, _dt: number): void {
    const conditions: Condition[] = [];
    monitorConditions(conditions);
    ventConditions(conditions);
    pumpConditions(conditions);
    const trueIds = new Set<string>();

    for (const cond of conditions) {
      trueIds.add(cond.id);
      const existing = active.get(cond.id);
      if (existing) {
        existing.conditionTrue = true;
        existing.clearSince = null;
        continue;
      }
      const meta = restoredMeta.get(cond.id);
      if (meta) {
        restoredMeta.delete(cond.id);
        active.set(cond.id, {
          ...cond,
          raisedAt: meta.raisedAt,
          silencedUntil: meta.silencedUntil,
          conditionTrue: true,
          clearSince: null,
        });
        continue;
      }
      const since = pendingSince.get(cond.id);
      if (since === undefined) {
        pendingSince.set(cond.id, t);
        continue;
      }
      if (t - since >= DEBOUNCE_S) {
        pendingSince.delete(cond.id);
        active.set(cond.id, {
          ...cond,
          raisedAt: t,
          silencedUntil: 0,
          conditionTrue: true,
          clearSince: null,
        });
        ctx.emit({
          type: 'AlarmRaised',
          alarmId: cond.id,
          source: cond.source,
          priority: cond.priority,
          label: cond.label,
        });
        if (cond.priority !== 'advisory') ctx.dropToRealtime('new alarm');
        hooks.onRaised?.(cond);
      }
    }

    for (const id of [...pendingSince.keys()]) {
      if (!trueIds.has(id)) pendingSince.delete(id);
    }
    for (const [id, rec] of [...active]) {
      if (trueIds.has(id)) continue;
      rec.conditionTrue = false;
      if (rec.clearSince === null) rec.clearSince = t;
      if (t - rec.clearSince >= RESOLVE_S) {
        active.delete(id);
        ctx.emit({ type: 'AlarmResolved', alarmId: id });
      }
    }
  }

  function silence(alarmId: string, durationS = DEFAULT_SILENCE_S): void {
    const rec = active.get(alarmId);
    if (!rec) return;
    rec.silencedUntil = ctx.now() + durationS;
    ctx.emit({ type: 'AlarmSilenced', alarmId, durationS });
  }

  function silenceAll(durationS = DEFAULT_SILENCE_S): void {
    for (const id of active.keys()) silence(id, durationS);
  }

  function getActive(): ActiveAlarm[] {
    return [...active.values()].map((rec) => ({
      id: rec.id,
      source: rec.source,
      priority: rec.priority,
      label: rec.label,
      raisedAt: rec.raisedAt,
      active: rec.conditionTrue,
      latched: false, // simple model: listed while true, auto-resolves after clear
      silencedUntil: rec.silencedUntil,
    }));
  }

  return {
    tick,
    silence,
    silenceAll,
    getActive,
    serialize: () =>
      [...active.values()].map((r) => ({
        id: r.id,
        raisedAt: r.raisedAt,
        silencedUntil: r.silencedUntil,
      })),
    restore: (list) => {
      restoredMeta.clear();
      for (const r of list) restoredMeta.set(r.id, r);
    },
  };
}
