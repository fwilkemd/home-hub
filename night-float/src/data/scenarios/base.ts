/**
 * Shared scenario building blocks (pure data helpers — no engine imports).
 * TODO(MEDICAL): alarm limits and "normal" findings are placeholder content.
 */
import type { z } from 'zod';
import type { alarmLimitSchema, pumpChannelSchema } from '../../contracts/patient';

type AlarmLimitIn = z.input<typeof alarmLimitSchema>;
type PumpChannelIn = z.input<typeof pumpChannelSchema>;

/**
 * Standard adult monitor limits. Keys may carry '#tier' suffixes so one vital
 * stacks a warning and a crisis threshold (engine strips the suffix for the
 * vital path). TODO(MEDICAL): per-scenario limit strategy.
 */
export const STANDARD_ALARM_LIMITS: Record<string, AlarmLimitIn> = {
  spo2: { lo: 90, priority: 'warning', label: 'SpO2 low' },
  'spo2#crisis': { lo: 85, priority: 'crisis', label: 'SpO2 critically low' },
  map: { lo: 65, priority: 'warning', label: 'MAP low' },
  'map#crisis': { lo: 55, priority: 'crisis', label: 'MAP critically low' },
  hr: { lo: 45, hi: 130, priority: 'warning', label: 'HR' },
  rr: { hi: 30, priority: 'advisory', label: 'RR high' },
};

export function emptyPumps(n: number): PumpChannelIn[] {
  return Array.from({ length: n }, (_, i) => ({ id: `ch-${i + 1}` }));
}

/** Normal-ish cardiac/IVC/lung ultrasound baseline. TODO(MEDICAL). */
export const NORMAL_US = {
  plax: { kind: 'cardiac', contractility: 0.6, lvScale: 1, rvScale: 1, effusion: 0 },
  psax: { kind: 'cardiac', contractility: 0.6, lvScale: 1, rvScale: 1, effusion: 0 },
  a4c: { kind: 'cardiac', contractility: 0.6, lvScale: 1, rvScale: 1, effusion: 0 },
  subxiphoid: { kind: 'cardiac', contractility: 0.6, lvScale: 1, rvScale: 1, effusion: 0 },
  ivc: { kind: 'ivc', diameterCm: 1.8, collapse: 0.3 },
  lung_ant_l: { kind: 'lung', sliding: true, bLines: 0, effusion: 0 },
  lung_ant_r: { kind: 'lung', sliding: true, bLines: 0, effusion: 0 },
  lung_post_l: { kind: 'lung', sliding: true, bLines: 0, effusion: 0 },
  lung_post_r: { kind: 'lung', sliding: true, bLines: 0, effusion: 0 },
} as const;
