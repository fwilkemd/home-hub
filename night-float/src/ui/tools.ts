/**
 * Hotbar tool table + the equip/time-scale actions shared by the global key
 * handler and the on-screen HUD controls.
 */
import { hubActions, hubStore } from '../bridge/store';
import { dispatch, setTimeScale } from '../bridge/session';
import { TIME_SCALES, type ToolId } from '../contracts/ids';

/** Hotbar order: 1 stethoscope … 6 ETT kit (SPEC §6.3). */
export const HOTBAR_TOOLS: readonly ToolId[] = [
  'stethoscope',
  'us_probe',
  'laryngoscope',
  'cvl_kit',
  'aline_kit',
  'ett_kit',
];

export const TOOL_SHORT: Record<ToolId, string> = {
  stethoscope: 'STETH',
  us_probe: 'PROBE',
  laryngoscope: 'LARYN',
  cvl_kit: 'CVL',
  aline_kit: 'A-LINE',
  ett_kit: 'ETT',
};

/** Equip a hotbar tool; equipping the held tool again unequips it. */
export function equipTool(tool: ToolId): void {
  const next = hubStore.getState().heldTool === tool ? null : tool;
  hubActions.setHeldTool(next);
  dispatch({ type: 'EquipTool', tool: next });
}

/** Step through TIME_SCALES (0 / 1 / 8 / 32), clamped at the ends. */
export function stepTimeScale(dir: 1 | -1): void {
  const cur = hubStore.getState().timeScale;
  const i = Math.max(0, TIME_SCALES.indexOf(cur));
  const next = TIME_SCALES[Math.min(TIME_SCALES.length - 1, Math.max(0, i + dir))];
  if (next !== cur) setTimeScale(next);
}

/** Space: pause toggles between 0x and 1x. */
export function togglePause(): void {
  setTimeScale(hubStore.getState().timeScale === 0 ? 1 : 0);
}
