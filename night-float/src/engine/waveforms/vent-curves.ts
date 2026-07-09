/**
 * Ventilator pressure/flow/volume curves for one breath, as a pure function
 * of VentWaveParams and breath phase 0..1 (SPEC §7.2).
 *
 * VC: constant inspiratory flow, Paw ramps to ppeak, brief inspiratory hold
 *     at pplat, passive exponential expiration.
 * PC/PS: square pressure at peep+drivePressure with exponentially decaying
 *     inspiratory flow; PS adds a small trigger dip.
 * Volume is the consistent integral shape, scaled to targetVt/measuredVte.
 *
 * TODO(MEDICAL): single-compartment RC model with cosmetic time constants —
 * the real version should honor patient compliance/resistance dynamics,
 * flow-cycling in PS, and auto-PEEP.
 *
 * Units out: paw cmH2O, flow L/min (+insp/-exp), vol mL above FRC.
 */
import type { VentWaveParams } from '../../contracts/waveforms';
import { clamp } from './wave-utils';

export interface VentCurveSample {
  paw: number;
  flow: number;
  vol: number;
}

export function ventCurves(params: VentWaveParams, phase01: number): VentCurveSample {
  if (!params.connected || params.standby) return { paw: 0, flow: 0, vol: 0 };

  const rate = clamp(params.rate, 4, 60);
  const period = 60 / rate;
  const ti = clamp(params.tiS, 0.3, Math.max(0.35, period * 0.67));
  const te = Math.max(0.25, period - ti);
  const p = ((phase01 % 1) + 1) % 1;
  const t = p * period;

  const compliance = Math.max(5, params.complianceMlPerCmH2o);
  const resistance = Math.max(2, params.resistanceCmH2oPerLps);
  const tau = (resistance * compliance) / 1000; // seconds (C in L/cmH2O)
  const peep = params.peep;

  if (params.mode === 'VC') {
    const vt = Math.max(50, params.targetVtMl);
    const tFlow = ti * 0.86; // constant-flow segment
    const qi = vt / tFlow; // mL/s
    if (t < tFlow) {
      const paw = peep + (params.ppeak - params.pplat) + (params.pplat - peep) * (t / tFlow);
      return { paw, flow: (qi * 60) / 1000, vol: qi * t };
    }
    if (t < ti) {
      return { paw: params.pplat, flow: 0, vol: vt }; // inspiratory hold
    }
    const tex = t - ti;
    const k = Math.exp(-tex / tau);
    const kEnd = Math.exp(-te / tau);
    return {
      paw: peep + (params.pplat - peep) * Math.exp(-tex / 0.08),
      flow: (-(vt / tau) * k * 60) / 1000,
      vol: vt * ((k - kEnd) / (1 - kEnd)), // normalized to land exactly at 0
    };
  }

  // -------- PC / PS: square pressure, decelerating flow
  const dp = Math.max(2, params.drivePressure);
  const vte = Math.max(50, params.measuredVteMl);
  if (t < ti) {
    const riseTau = 0.05;
    let paw = peep + dp * (1 - Math.exp(-t / riseTau));
    if (params.spontaneous && t < 0.12) {
      paw -= 2.5 * Math.sin((Math.PI * t) / 0.12); // patient trigger dip
    }
    const k = Math.exp(-t / tau);
    const kTi = Math.exp(-ti / tau);
    return {
      paw,
      flow: (dp / resistance) * k * 60, // L/s -> L/min
      vol: vte * ((1 - k) / (1 - kTi)),
    };
  }
  const tex = t - ti;
  const k = Math.exp(-tex / tau);
  const kEnd = Math.exp(-te / tau);
  return {
    paw: peep + dp * Math.exp(-tex / 0.07),
    flow: (-(vte / tau) * k * 60) / 1000,
    vol: vte * ((k - kEnd) / (1 - kEnd)),
  };
}
