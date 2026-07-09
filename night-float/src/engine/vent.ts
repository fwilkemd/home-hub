/**
 * Ventilator + single-compartment lung model (SPEC §7.2).
 * VC: square flow -> ppeak = peep + Vt/C + R*flow, pplat = peep + Vt/C.
 * PC/PS: Vt = drivePressure * C. Produces VentWaveParams for the vent screen.
 * TODO(MEDICAL): the entire lung model is a placeholder — real version wants
 * flow shapes, auto-PEEP, patient effort interaction, and leak/occlusion.
 */
import type { VentSettings, VentState } from '../contracts/patient';
import type { VentWaveParams } from '../contracts/waveforms';
import type { EngineCtx } from './types';
import { clamp } from './types';

/** Clamp ranges for settable values. TODO(MEDICAL): sane clinical bounds. */
const LIMITS: Record<string, [number, number]> = {
  setRr: [4, 40],
  setVtMl: [200, 800],
  peep: [0, 20],
  fio2: [0.21, 1],
  pinsp: [5, 40],
  psupp: [0, 30],
};

export interface VentHandle {
  tick(t: number, dt: number): void;
  /** merge + clamp settings; emits VentSettingsChanged. connect also clears standby. */
  applySettings(
    settings: Partial<VentSettings>,
    by: 'player' | 'rt' | 'scenario',
    connect?: boolean,
  ): void;
  getWave(): VentWaveParams;
  /** breaths/min actually delivered right now (0 when not ventilating) */
  deliveredRate(): number;
  isVentilating(): boolean;
  /** seconds since the last delivered/triggered breath (for the apnea alarm) */
  secondsSinceBreath(): number;
}

export function createVent(ctx: EngineCtx, getSpontRr: () => number): VentHandle {
  let delivered = 0;
  let noBreathS = 0;
  let wave: VentWaveParams = buildWave();

  function vent(): VentState {
    return ctx.patient.devices.vent;
  }

  function isVentilating(): boolean {
    return vent().connected && !vent().standby;
  }

  function buildWave(): VentWaveParams {
    const v = vent();
    const e = ctx.effective;
    // effective mechanics (drug/scenario-modifiable) TODO(MEDICAL)
    const compliance = clamp(e['lungComplianceMlPerCmH2o'] ?? 50, 5, 150);
    const resistance = clamp(e['airwayResistanceCmH2oPerLps'] ?? 10, 2, 60);
    const ventilating = isVentilating();
    const spont = getSpontRr();

    let rate: number;
    let spontaneous = false;
    if (!ventilating) {
      rate = 0;
    } else if (v.mode === 'PS') {
      rate = spont; // pure support: patient must trigger TODO(MEDICAL): backup rate
      spontaneous = spont > 0;
    } else {
      rate = Math.max(v.setRr, spont); // assist-control-ish TODO(MEDICAL)
      spontaneous = spont > v.setRr;
    }

    // inspiratory time: ~1s, shorter at high rates TODO(MEDICAL): I:E control
    const tiS = rate > 0 ? clamp(Math.min(1.0, (60 / rate) * 0.33), 0.4, 1.5) : 1.0;

    let vt: number;
    let drive: number;
    if (v.mode === 'VC') {
      vt = v.setVtMl;
      drive = vt / compliance; // resulting driving pressure
    } else if (v.mode === 'PC') {
      drive = v.pinsp;
      vt = drive * compliance;
    } else {
      drive = v.psupp;
      // effort scales support-mode volumes TODO(MEDICAL): muscle pressure model
      const effort = 0.6 + 0.7 * clamp(e['respDrive'] ?? 0.5, 0, 1);
      vt = drive * compliance * effort;
    }

    const flowLps = tiS > 0 ? vt / 1000 / tiS : 0;
    const ppeak =
      v.mode === 'VC' ? v.peep + vt / compliance + resistance * flowLps : v.peep + drive;
    const pplat = v.peep + vt / compliance;
    const measuredVteMl = ventilating && rate > 0 ? Math.round(vt) : 0;

    return {
      connected: v.connected,
      standby: v.standby,
      mode: v.mode,
      rate: Math.round(rate * 10) / 10,
      tiS,
      peep: v.peep,
      fio2: v.fio2,
      drivePressure: Math.round(drive * 10) / 10,
      targetVtMl: v.setVtMl,
      measuredVteMl,
      complianceMlPerCmH2o: Math.round(compliance * 10) / 10,
      resistanceCmH2oPerLps: Math.round(resistance * 10) / 10,
      ppeak: Math.round(ppeak * 10) / 10,
      pplat: Math.round(pplat * 10) / 10,
      spontaneous,
    };
  }

  function tick(_t: number, dt: number): void {
    wave = buildWave();
    delivered = isVentilating() ? wave.rate : 0;
    if (isVentilating() && delivered <= 0) noBreathS += dt;
    else noBreathS = 0;
  }

  function applySettings(
    settings: Partial<VentSettings>,
    by: 'player' | 'rt' | 'scenario',
    connect?: boolean,
  ): void {
    const v = vent();
    for (const [key, raw] of Object.entries(settings)) {
      if (raw == null) continue;
      if (key === 'mode') {
        v.mode = raw as VentState['mode'];
        continue;
      }
      const lim = LIMITS[key];
      if (!lim) continue;
      (v as unknown as Record<string, number>)[key] = clamp(Number(raw), lim[0], lim[1]);
    }
    if (connect) {
      v.connected = true;
      v.standby = false; // connecting the circuit takes it out of standby
    }
    ctx.emit({ type: 'VentSettingsChanged', vent: { ...v, alarmLimits: { ...v.alarmLimits } }, by });
    wave = buildWave();
  }

  return {
    tick,
    applySettings,
    getWave: () => wave,
    deliveredRate: () => delivered,
    isVentilating,
    secondsSinceBreath: () => noBreathS,
  };
}
