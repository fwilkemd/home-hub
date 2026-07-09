/**
 * UI-side formatting helpers: wall clock math, durations, event one-liners,
 * log download. No sim state in here — pure functions plus one DOM helper.
 */
import type { SimEvent } from '../contracts/events';
import { exportLogJson } from '../bridge/session';

export function parseClockStart(clockStart: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clockStart.trim());
  if (!m) return 3 * 3600;
  return Number(m[1]) * 3600 + Number(m[2]) * 60;
}

/** clockStart "03:00" + sim seconds -> "03:12:45" (24 h wall clock). */
export function wallClock(clockStart: string, simTimeS: number, withSeconds = true): string {
  const total = Math.floor(parseClockStart(clockStart) + Math.max(0, simTimeS)) % 86400;
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  if (!withSeconds) return `${hh}:${mm}`;
  return `${hh}:${mm}:${String(total % 60).padStart(2, '0')}`;
}

/** seconds -> "m:ss" (or "h:mm:ss" for long spans). */
export function fmtDur(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Compact numeric display: 118, 7.4, 0.05 — no trailing zeros. */
export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '--';
  const a = Math.abs(v);
  const digits = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return String(parseFloat(v.toFixed(digits)));
}

/** One-line human description for a SimEvent (ticker / timeline tooltips). */
export function describeEvent(e: SimEvent): string | null {
  switch (e.type) {
    case 'OrderPlaced':
      return `Ordered — ${e.order.label}`;
    case 'MedAdministered':
      return `${e.drugName} ${fmtNum(e.dose)} ${e.unit} given (${e.by})`;
    case 'InfusionStarted':
    case 'InfusionRateChanged':
    case 'InfusionStopped':
      return e.label;
    case 'LabOrdered':
      return `${e.panelName} sent${e.stat ? ' STAT' : ''}`;
    case 'LabResulted': {
      const abn = e.results.filter((r) => r.flag !== 'normal').length;
      return `${e.panelName} resulted${abn ? ` (${abn} abnormal)` : ''}`;
    }
    case 'ImagingResulted':
      return `${e.study.toUpperCase()} resulted`;
    case 'AlarmRaised':
      return `ALARM — ${e.label}`;
    case 'ProcedureStarted':
      return `${e.name} started`;
    case 'ProcedureStepCompleted':
      return `${e.prompt}${e.skipped ? ' (skipped)' : ''}`;
    case 'ProcedureComplication':
      return `Complication — ${e.label}`;
    case 'ProcedureCompleted':
      return `${e.name} complete`;
    case 'ProcedureAborted':
      return 'Procedure aborted';
    case 'SterileFieldContaminated':
      return `Sterile field contaminated (${e.what})`;
    case 'LinePlaced':
      return `${e.line.type.toUpperCase()} placed — ${e.line.site}`;
    case 'NibpMeasured':
      return `NIBP ${Math.round(e.sbp)}/${Math.round(e.dbp)}`;
    case 'RhythmChanged':
      return `Rhythm ${e.from} to ${e.to}`;
    case 'ScenarioScriptedEvent':
      return e.label ?? null;
    case 'ScenarioEnded':
      return `Scenario ended — ${e.outcome.toUpperCase()}`;
    default:
      return null;
  }
}

/** Download the full event log as night-float-log.json. */
export function downloadLog(): void {
  const blob = new Blob([exportLogJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'night-float-log.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Key bindings shown in the menu card and the settings reference. */
export const CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['W A S D', 'move'],
  ['Mouse', 'look (click the room to capture)'],
  ['E · F · C · V', 'context actions on what you look at'],
  ['Tab', 'workstation / chart'],
  ['Q', 'verbal orders'],
  ['1 – 6', 'tool hotbar'],
  ['Space', 'pause / resume'],
  ['[ ]  or  - +', 'time compression'],
  ['Esc', 'close panel · settings'],
];
