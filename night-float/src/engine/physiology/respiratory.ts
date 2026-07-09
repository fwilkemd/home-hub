/**
 * Respiratory module: SpO2 from FiO2 + shunt (venous-admixture-shaped
 * placeholder, slow time constant so desats TREND rather than jump), RR from
 * drive/sedation/paralysis, EtCO2 once intubated. Spontaneous rate feeds the
 * vent (PS mode / assist triggering) via derived.spontRr.
 */
import type { PhysioCtx } from './integrator';
import { approach, clamp, clamp01 } from '../types';

export function respiratory(p: PhysioCtx, dt: number): void {
  const e = p.effective;
  const v = p.patient.vitals;
  const pulseless = v.rhythm === 'vf' || v.rhythm === 'asystole';
  const ventilating = p.vent.isVentilating();
  const vent = p.patient.devices.vent;

  // ---- spontaneous respiratory rate --------------------------------------
  // TODO(MEDICAL): chemoreceptor drive (CO2/O2), not a linear drive scalar.
  const drive = clamp01(e['respDrive'] ?? 0.5);
  const sedation = clamp01(e['sedation'] ?? 0);
  const paralysis = clamp01(e['paralysis'] ?? 0);
  let spont = (4 + 26 * drive) * (1 - 0.75 * sedation);
  if (paralysis >= 0.9 || drive <= 0.02 || pulseless) spont = 0; // apneic
  else if (spont < 5) spont = 5; // agonal floor TODO(MEDICAL)
  p.derived.spontRr = spont;

  // displayed RR: vent-delivered when on the circuit, else spontaneous
  const rrTarget = ventilating ? p.vent.deliveredRate() : spont;
  const rrNoise = rrTarget > 0 && !ventilating ? p.noise('rr', 0.6, 22) : 0;
  v.rr = clamp(approach(v.rr, rrTarget + rrNoise, dt, 8), 0, 60);
  if (rrTarget <= 0 && v.rr < 0.5) v.rr = 0;

  // ---- SpO2 ---------------------------------------------------------------
  // FiO2: vent when connected, else supplemental O2 (physiology.fio2, room
  // air 0.21 default). TODO(MEDICAL): device-specific FiO2 (NC/NRB/HFNC).
  const fio2 = ventilating ? vent.fio2 : clamp(e['fio2'] ?? 0.21, 0.21, 1);

  // PEEP recruitment shrinks effective shunt when ventilated.
  // TODO(MEDICAL): recruitment/derecruitment dynamics, PEEP titration curve.
  const peep = ventilating ? vent.peep : 0;
  const recruit = ventilating ? 0.6 * Math.min(1, peep / 10) : 0;
  let shunt = clamp01((e['shuntFraction'] ?? 0.05) * (1 - recruit));

  // No effective ventilation (apnea off the vent) -> gas exchange collapses.
  // TODO(MEDICAL): apneic desaturation should follow an FRC/VO2 trajectory.
  const isVentilated = ventilating ? p.vent.deliveredRate() > 0 : v.rr > 2;
  if (!isVentilated) shunt = 1;

  // End-capillary sat rises steeply with FiO2 then plateaus. TODO(MEDICAL).
  const capSat = 100 * (1 - 0.055 * Math.exp(-fio2 / 0.18));
  // Mixed venous sat falls with poor perfusion. TODO(MEDICAL): SvO2 = f(DO2/VO2).
  const svo2 = 60 + 22 * clamp01(e['perfusionEff'] ?? 0.8);
  // Venous admixture blend TODO(MEDICAL): real shunt equation over O2 CONTENT.
  let spo2Target = (1 - shunt) * capSat + shunt * svo2;
  if (!isVentilated) spo2Target = Math.min(spo2Target, 42); // apneic slide TODO(MEDICAL)
  if (pulseless) spo2Target = 34; // no delivery; pleth is gone anyway TODO(MEDICAL)

  // slow time constant so desaturation TRENDS (SPEC: ~30-60s)
  const tauSpo2 = spo2Target < v.spo2 ? 35 : 25;
  v.spo2 = clamp(approach(v.spo2, spo2Target + p.noise('spo2', 0.35, 30), dt, tauSpo2), 20, 100);

  // ---- EtCO2 (only meaningful with an ETT + capno line) -------------------
  const hasEtt = p.patient.lines.some((l) => l.type === 'ett');
  if (hasEtt) {
    // TODO(MEDICAL): EtCO2 from CO2 production / alveolar ventilation.
    let etTarget = clamp(45 - 0.45 * (v.rr - 12), 22, 55);
    if (v.rr <= 1) etTarget = 8; // no breaths, no waveform plateau
    if (pulseless) etTarget = 11; // low-flow state TODO(MEDICAL)
    v.etco2 = clamp(
      approach(v.etco2 ?? etTarget, etTarget + p.noise('etco2', 0.5, 25), dt, 15),
      3,
      90,
    );
  } else {
    v.etco2 = undefined;
  }
}
