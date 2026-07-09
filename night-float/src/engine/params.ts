/**
 * PatientState -> WaveformParams mapping (SPEC §7.1). Waveform SYNTHESIS
 * lives in src/engine/waveforms (another workstream); this file only decides
 * the parameters the tracings are drawn from.
 * TODO(MEDICAL): mapping fidelity (amplitudes, swings, damping) is stub-level.
 */
import type { WaveformParams } from '../contracts/waveforms';
import { PULSELESS_RHYTHMS } from '../contracts/ids';
import type { EngineCtx } from './types';
import { clamp, clamp01 } from './types';

export function buildWaveformParams(ctx: EngineCtx): WaveformParams {
  const v = ctx.patient.vitals;
  const e = ctx.effective;
  const pulseless = PULSELESS_RHYTHMS.includes(v.rhythm);
  const perfusion = pulseless ? 0 : clamp01(e['perfusionEff'] ?? e['perfusion'] ?? 0.8);

  // Respiratory swing scales UP as volume status drops — the pulse-pressure-
  // variation hook (SPEC §7.1). TODO(MEDICAL): PPV% from heart-lung interaction.
  const volume = clamp01(e['volumeStatus'] ?? 0.5);
  const respSwing = clamp(0.12 + (0.5 - volume) * 0.9, 0.05, 0.65);

  const hasAline = ctx.patient.lines.some((l) => l.type === 'aline');
  const hasEtt = ctx.patient.lines.some((l) => l.type === 'ett');

  return {
    beatSeed: ctx.scenario.seed,
    ecg: {
      rhythm: v.rhythm,
      rate: v.hr,
      amplitude: 1,
      ectopyPerMin: e['ectopyPerMin'] ?? 0, // ectopy hook TODO(MEDICAL)
    },
    pleth: {
      present: !pulseless, // no pulsatile signal without forward flow
      rate: v.hr,
      perfusion,
      respSwing,
    },
    art: {
      present: hasAline,
      rate: v.hr,
      sbp: v.sbp,
      dbp: v.dbp,
      respSwing,
      damped: clamp01(e['alineDamping'] ?? 0), // overdamped-line hook
      pulsatile: !pulseless,
    },
    resp: { rate: v.rr, amplitude: v.rr > 0 ? 0.75 : 0 },
    capno: {
      present: hasEtt,
      rate: v.rr,
      etco2: v.etco2 ?? 0,
      plateauSlope: clamp01(e['capnoPlateauSlope'] ?? 0.12), // obstruction hook
    },
  };
}
