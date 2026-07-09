/**
 * Re-render-safe view of the mirrored procedure runtime. The engine mutates
 * ONE runtime object in place and the bridge mirrors that same reference into
 * the store every sync — so `useHub((s) => s.procedure)` alone never
 * re-renders on step advances (Object.is-equal selector output). Subscribing
 * to a derived version string keyed on everything the UI shows makes React
 * repaint whenever the runtime's contents move; reads off the live object
 * then see fresh data.
 */
import { useHub } from '../../bridge/store';
import type { ProcedureRuntime } from '../../contracts/runtime';

function version(p: ProcedureRuntime | null): string {
  if (!p) return '';
  let v = `${p.procedureId}|${p.startedAt}|${p.stepIndex}|${p.contaminated ? 'c' : ''}|`;
  for (const st of p.steps) v += st.status[0]; // p / a / d / s
  return v;
}

export function useProcedure(): ProcedureRuntime | null {
  useHub((s) => version(s.procedure)); // change detector
  return useHub((s) => s.procedure);
}
