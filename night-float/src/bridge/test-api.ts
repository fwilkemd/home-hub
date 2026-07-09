/**
 * window.__nf — the automation surface for Playwright smoke tests and the
 * ?debugcam screenshot tour (SPEC §15). Not for gameplay.
 */
import type { NfTestApi } from '../contracts/runtime';
import type { EmrTab, ViewpointId } from '../contracts/ids';
import type { SimCommand } from '../contracts/commands';
import { hubActions, hubStore } from './store';
import { dispatch, getEngine, getWorld, startScenario, syncNow } from './session';

export function installTestApi(): void {
  const api: NfTestApi = {
    ready: true,
    startScenario: (id: string) => startScenario(id),
    teleport: (v: ViewpointId) => getWorld()?.teleport(v),
    setDebugCam: (on: boolean) => {
      hubActions.set({ debugCam: on });
      getWorld()?.setDebugCam(on);
    },
    dispatch: (cmd: SimCommand) => dispatch(cmd),
    advanceSim: (seconds: number) => {
      getEngine()?.stepSim(seconds);
      syncNow();
    },
    getSnapshot: () => {
      const s = hubStore.getState();
      return {
        phase: s.phase,
        simTime: s.simTime,
        engineEnded: getEngine()?.isEnded() ?? null,
        vitals: s.vitals,
        alarms: s.alarms,
        orders: s.orders,
        mar: s.mar,
      };
    },
    openWorkstation: (tab?: EmrTab) => hubActions.openWorkstation(tab),
    closeWorkstation: () => hubActions.closeWorkstation(),
    openZoom: (device) => hubActions.openZoom(device),
    closeZoom: () => hubActions.closeZoom(),
  };
  window.__nf = api;
}
