/**
 * Engine entry — createEngine(scenario) -> EngineHandle.
 *
 * PHASE 0 SHELL: clock, log, order stamping, time compression and snapshot
 * cadence are real; physiology/pharmacology/labs/rhythms/scenario-scripting
 * are wired in by the engine workstream (Phase 1B) as modules under
 * src/engine/*. Keep this file free of three/react/zustand imports — enforced
 * by eslint (SPEC §4).
 */
import type {
  EngineHandle,
  EngineOptions,
  EngineSave,
  ActiveAlarm,
} from '../contracts/runtime';
import type { ScenarioFile } from '../contracts/content';
import type { SimCommand } from '../contracts/commands';
import type { PatientState, VitalSigns } from '../contracts/patient';
import type { VentWaveParams, WaveformParams } from '../contracts/waveforms';
import type { TimeScale } from '../contracts/ids';
import { SimClock, TICK_S } from './clock';
import { EventLog } from './log';
import { makeRng } from './rng';

const VITALS_SNAPSHOT_EVERY_S = 5;

export function createEngine(scenario: ScenarioFile, opts: EngineOptions = {}): EngineHandle {
  const clock = new SimClock();
  const log = new EventLog();
  const rng = makeRng(opts.seed ?? scenario.seed);
  void rng; // used by subsystems (Phase 1B)

  // Deep-clone the scenario's initial patient — the engine owns this object.
  const patient: PatientState = JSON.parse(JSON.stringify(scenario.initialPatient));

  let ended = false;
  let orderCounter = 0;
  let lastSnapshotAt = -VITALS_SNAPSHOT_EVERY_S;

  if (opts.onEvent) log.onAppend(opts.onEvent);

  log.append(0, { type: 'ScenarioStarted', scenarioId: scenario.id, title: scenario.title });

  // ------------------------------------------------------------------ tick
  function tick(t: number): void {
    if (ended) return;
    // Phase 1B: physiology integration, pharmacology, labs queue, rhythm
    // machine, scenario script + end conditions, nurse tasks, alarms all
    // advance here (each subsystem gets (patient, dt, t)).
    if (t - lastSnapshotAt >= VITALS_SNAPSHOT_EVERY_S) {
      lastSnapshotAt = t;
      log.append(t, { type: 'VitalsSnapshot', vitals: { ...patient.vitals } });
    }
  }

  // ------------------------------------------------------------------ dispatch
  function dispatch(cmd: SimCommand): void {
    if (ended && cmd.type !== 'SetTimeScale') return;
    const t = clock.simTime;
    switch (cmd.type) {
      case 'SetTimeScale': {
        if (clock.timeScale !== cmd.scale) {
          clock.timeScale = cmd.scale;
          log.append(t, { type: 'TimeScaleChanged', scale: cmd.scale, auto: false });
        }
        break;
      }
      case 'PlaceOrder': {
        const order = {
          ...cmd.draft,
          id: `ord-${++orderCounter}`,
          t,
          status: 'active' as const,
        };
        log.append(t, { type: 'OrderPlaced', order });
        break;
      }
      case 'WriteNote': {
        log.append(t, { type: 'NoteWritten', text: cmd.text });
        break;
      }
      case 'EndScenario': {
        endScenario('aborted', 'Scenario ended by the player.');
        break;
      }
      default:
        // Remaining commands are implemented by Phase 1B subsystems.
        log.append(t, { type: 'PlayerAction', action: cmd.type, detail: 'unhandled (phase 0)' });
        break;
    }
  }

  function endScenario(
    outcome: 'success' | 'death' | 'timeout' | 'aborted',
    summary: string,
  ): void {
    if (ended) return;
    ended = true;
    log.append(clock.simTime, { type: 'ScenarioEnded', outcome, summary });
  }

  // ------------------------------------------------------------------ views
  function getWaveformParams(): WaveformParams {
    const v = patient.vitals;
    return {
      beatSeed: scenario.seed,
      ecg: { rhythm: v.rhythm, rate: v.hr, amplitude: 1, ectopyPerMin: 0 },
      pleth: { present: true, rate: v.hr, perfusion: 0.8, respSwing: 0.15 },
      art: {
        present: patient.lines.some((l) => l.type === 'aline'),
        rate: v.hr,
        sbp: v.sbp,
        dbp: v.dbp,
        respSwing: 0.15,
        damped: 0,
        pulsatile: true,
      },
      resp: { rate: v.rr, amplitude: 0.8 },
      capno: {
        present: patient.lines.some((l) => l.type === 'ett'),
        rate: v.rr,
        etco2: v.etco2 ?? 38,
        plateauSlope: 0.1,
      },
    };
  }

  function getVentWave(): VentWaveParams {
    const vent = patient.devices.vent;
    return {
      connected: vent.connected,
      standby: vent.standby,
      mode: vent.mode,
      rate: vent.setRr,
      tiS: 1.0,
      peep: vent.peep,
      fio2: vent.fio2,
      drivePressure: vent.mode === 'VC' ? 12 : vent.pinsp,
      targetVtMl: vent.setVtMl,
      measuredVteMl: vent.setVtMl,
      complianceMlPerCmH2o: patient.physiology.lungComplianceMlPerCmH2o ?? 50,
      resistanceCmH2oPerLps: patient.physiology.airwayResistanceCmH2oPerLps ?? 10,
      ppeak: 22,
      pplat: 18,
      spontaneous: vent.mode === 'PS',
    };
  }

  const handle: EngineHandle = {
    scenario,
    advance(realDtS: number) {
      clock.advance(realDtS, tick);
    },
    stepSim(simSeconds: number) {
      clock.stepSim(simSeconds, tick);
    },
    dispatch,
    getPatient: () => patient,
    getVitals: (): VitalSigns => ({ ...patient.vitals }),
    getWaveformParams,
    getVentWave,
    getSimTime: () => clock.simTime,
    getTimeScale: () => clock.timeScale as TimeScale,
    getLog: () => log.all(),
    getActiveAlarms: (): ActiveAlarm[] => [],
    getBreathPhase: () => {
      const rr = Math.max(patient.vitals.rr, 4);
      const period = 60 / rr;
      return (clock.simTime % period) / period;
    },
    isEnded: () => ended,
    serialize: (): EngineSave => ({
      version: 1,
      scenarioId: scenario.id,
      savedAtSim: clock.simTime,
      blob: { patient, log: log.toJSON(), clock: clock.serialize() },
    }),
  };
  return handle;
}

export { TICK_S };
