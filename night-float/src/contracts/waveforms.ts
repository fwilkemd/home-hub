/**
 * WaveformParams — the ONLY thing the render layer reads to draw tracings.
 * The engine maps PatientState -> WaveformParams once per tick; screens
 * synthesize samples at render rate from these params (never from raw
 * engine internals).
 */
import type { RhythmId, VentMode } from './ids';

export interface EcgParams {
  rhythm: RhythmId;
  /** effective ventricular rate (bpm); ignored for vf/asystole */
  rate: number;
  /** overall gain, 1 = normal */
  amplitude: number;
  /** premature-beat frequency per minute (hook for ectopy) */
  ectopyPerMin: number;
}

export interface PlethParams {
  /** false = no pulsatile signal (pulseless rhythm, probe off) */
  present: boolean;
  rate: number;
  /** 0..1 amplitude scale (peripheral perfusion) */
  perfusion: number;
  /** 0..1 respiratory amplitude modulation */
  respSwing: number;
}

export interface ArtParams {
  /** false until an arterial line exists */
  present: boolean;
  rate: number;
  sbp: number;
  dbp: number;
  /** 0..1 respiratory swing of the baseline — the PPV hook (SPEC §7.1) */
  respSwing: number;
  /** 0..1 waveform damping (overdamped line) */
  damped: number;
  /** false = pulseless (flat-ish line at ~CVP) */
  pulsatile: boolean;
}

export interface RespParams {
  rate: number;
  /** 0..1 */
  amplitude: number;
}

export interface CapnoParams {
  /** false until intubated */
  present: boolean;
  rate: number;
  etco2: number;
  /** 0..1 upslope of the alveolar plateau (obstruction hook) */
  plateauSlope: number;
}

export interface WaveformParams {
  /** deterministic seed so every consumer's BeatClock agrees on irregular rhythms */
  beatSeed: number;
  ecg: EcgParams;
  pleth: PlethParams;
  art: ArtParams;
  resp: RespParams;
  capno: CapnoParams;
}

/**
 * Parameters for the ventilator screen's pressure/flow/volume curves,
 * produced by the engine's single-compartment lung model.
 * TODO(MEDICAL): fidelity of the lung model itself lives in the engine stub.
 */
export interface VentWaveParams {
  connected: boolean;
  standby: boolean;
  mode: VentMode;
  /** total breaths/min actually delivered (set rate or spontaneous) */
  rate: number;
  /** inspiratory time seconds */
  tiS: number;
  peep: number;
  fio2: number;
  /** pressure above PEEP driving the breath (PC/PS) or resulting (VC) */
  drivePressure: number;
  /** set tidal volume (VC) */
  targetVtMl: number;
  /** achieved expiratory tidal volume */
  measuredVteMl: number;
  complianceMlPerCmH2o: number;
  resistanceCmH2oPerLps: number;
  ppeak: number;
  pplat: number;
  /** true when breaths are patient-triggered (PS) */
  spontaneous: boolean;
}
