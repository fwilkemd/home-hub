/**
 * Waveform synthesis — pure functions of WaveformParams/VentWaveParams and
 * time (SPEC §7). No three/react/zustand, no Math.random: everything is
 * deterministic via the shared BeatClock + hash noise.
 */
export { BeatClock } from './beat-clock';
export type { BeatClockParams, BeatPhaseInfo } from './beat-clock';
export { ecgSample } from './ecg';
export { plethSample } from './pleth';
export { artSample } from './art';
export { respSample, breathPhase, INSP_FRACTION } from './resp';
export { capnoSample } from './capno';
export { ventCurves } from './vent-curves';
export type { VentCurveSample } from './vent-curves';
export { clamp, lerp, smoothstep, gauss, valueNoise1d, valueNoiseC } from './wave-utils';
