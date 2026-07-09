/**
 * Engine entry — createEngine(scenario) -> EngineHandle (contracts/runtime).
 *
 * Composition root for the pure simulation: clock, log, RNG streams, and the
 * subsystems (scenario scripts, pharmacology, vent, physiology, labs, nurse,
 * bedside, alarms, procedures). Deterministic given a seed: identical
 * commands at identical sim times replay an identical event log (SPEC §4).
 * No three/react/zustand imports — enforced by eslint.
 */
import type { EngineHandle, EngineOptions, EngineSave } from '../contracts/runtime';
import type { ScenarioFile } from '../contracts/content';
import type { SimCommand } from '../contracts/commands';
import type { PatientState, VitalSigns } from '../contracts/patient';
import type { TimeScale } from '../contracts/ids';
import type { SimEventBody } from '../contracts/events';
import type { Order, OrderDraft } from '../contracts/orders';
import { PHYSIOLOGY_DEFAULTS } from '../contracts/patient';
import { getDrug } from '../data/drugs';
import { SimClock, TICK_S } from './clock';
import { EventLog } from './log';
import { makeRng } from './rng';
import type { EngineCtx, RngStreams } from './types';
import { clamp } from './types';
import { createRhythmMachine } from './rhythms';
import { createPharmacology } from './pharmacology';
import { mlHrToDoseRate } from './pharmacology/kinetics';
import { createVent } from './vent';
import { createPhysiology, type PhysiologyHandle } from './physiology/integrator';
import { createEffects } from './scenario/effects';
import { createScenarioRuntime } from './scenario/script';
import { createLabs } from './labs';
import { createBedside } from './bedside';
import { createNurse } from './nurse';
import { createAlarms } from './alarms';
import { createProcedures } from './procedures';
import { buildWaveformParams } from './params';
import { handleVerbalOrder } from './verbal';

const VITALS_SNAPSHOT_EVERY_S = 5;
const RT_RESPONSE_S = 25; // respiratory therapist walk-in delay for vent orders

/** Typed shape of EngineSave.blob (engine-owned; see serialize/restore). */
interface EngineBlob {
  patient: PatientState;
  log: import('../contracts/events').SimEvent[];
  clock: { simTime: number; timeScale: TimeScale };
  pharm: Record<string, number>;
  labs: ReturnType<import('./labs').LabsHandle['serialize']>;
  alarms: ReturnType<import('./alarms').AlarmsHandle['serialize']>;
  scenario: { fired: string[]; tutorialIndex: number };
  nurse: { queue: number; busyWith: string | null };
  effects: import('./scenario/effects').Ramp[];
  rng: Record<keyof RngStreams, number>;
  counters: Record<string, number>;
  lastSnapshotAt: number;
  ended: boolean;
}

export function createEngine(scenario: ScenarioFile, opts: EngineOptions = {}): EngineHandle {
  const clock = new SimClock();
  const log = new EventLog();
  const root = makeRng(opts.seed ?? scenario.seed);
  // All streams forked ONCE, fixed labels, before any next() call (SPEC §4).
  const rng: RngStreams = {
    physio: root.fork('physio'),
    labs: root.fork('labs'),
    complications: root.fork('complications'),
    rhythm: root.fork('rhythm'),
    nibp: root.fork('nibp'),
    nurse: root.fork('nurse'),
  };

  // Deep-clone the scenario's initial patient — the engine owns this object.
  const patient: PatientState = JSON.parse(JSON.stringify(scenario.initialPatient));
  patient.physiology = { ...PHYSIOLOGY_DEFAULTS, ...patient.physiology };

  let ended = false;
  let lastSnapshotAt = -VITALS_SNAPSHOT_EVERY_S;
  const idCounters = new Map<string, number>();
  const pendingRt: Array<{ at: number; order: Order & { kind: 'vent' } }> = [];

  if (opts.onEvent) log.onAppend(opts.onEvent);

  // ------------------------------------------------------------------ ctx
  const ctx: EngineCtx = {
    scenario,
    patient,
    log,
    clock,
    rng,
    effective: { ...patient.physiology },
    drugTargets: {},
    emit: (body: SimEventBody) => log.append(clock.simTime, body),
    now: () => clock.simTime,
    nextId(prefix: string): string {
      const n = (idCounters.get(prefix) ?? 0) + 1;
      idCounters.set(prefix, n);
      return `${prefix}-${n}`;
    },
    dropToRealtime(reason: string): void {
      if (clock.timeScale <= 1) return;
      clock.timeScale = 1;
      ctx.emit({ type: 'TimeScaleChanged', scale: 1, auto: true, reason });
    },
    endScenario(outcome, summary): void {
      if (ended) return;
      ended = true;
      log.append(clock.simTime, { type: 'ScenarioEnded', outcome, summary });
    },
    isEnded: () => ended,
    weightKg: () => patient.demographics.weightKg,
  };

  // ------------------------------------------------------------ subsystems
  const rhythms = createRhythmMachine(ctx);
  const pharm = createPharmacology(ctx, rhythms);
  let physiology: PhysiologyHandle | null = null;
  const vent = createVent(ctx, () => physiology?.derived.spontRr ?? patient.vitals.rr);
  physiology = createPhysiology(ctx, vent);
  const effects = createEffects(ctx, vent, rhythms);
  const scenarioRt = createScenarioRuntime(ctx, effects);
  const labs = createLabs(ctx);
  const bedside = createBedside(ctx);
  const nurse = createNurse(ctx, pharm, labs, bedside);
  const alarms = createAlarms(ctx, vent, {
    onRaised: (a) => {
      if (a.priority === 'crisis') nurse.onCrisisAlarm(a.label);
    },
  });
  const procedures = createProcedures(ctx, effects);

  if (!opts.restore) {
    log.append(0, { type: 'ScenarioStarted', scenarioId: scenario.id, title: scenario.title });
  } else {
    // Slice-level restore (see DECISIONS.md): patient/log/clock/PK levels/
    // lab queues/alarms/script+ramp state/RNG streams come back; in-flight
    // nurse tasks and active procedures do not (saving is blocked mid-
    // procedure by the UI). Physiology noise streams restart harmlessly.
    const blob = opts.restore.blob as EngineBlob;
    for (const k of Object.keys(patient)) delete (patient as Record<string, unknown>)[k];
    Object.assign(patient, JSON.parse(JSON.stringify(blob.patient)));
    clock.restore(blob.clock);
    log.restore(blob.log);
    pharm.restore(blob.pharm);
    labs.restore(blob.labs);
    alarms.restore(blob.alarms);
    scenarioRt.restore(blob.scenario);
    effects.restore(blob.effects ?? []);
    for (const key of Object.keys(rng) as (keyof RngStreams)[]) {
      const s = blob.rng?.[key];
      if (s !== undefined) rng[key].setState(s);
    }
    for (const [k, v] of Object.entries(blob.counters ?? {})) idCounters.set(k, v);
    lastSnapshotAt = blob.lastSnapshotAt ?? clock.simTime;
    ended = blob.ended ?? false;
  }

  // ------------------------------------------------------------------ tick
  function tick(t: number): void {
    if (ended) return;
    const dt = TICK_S;
    effects.tickRamps(t, dt); // base-param ramps first (scripts own base)
    scenarioRt.tickScripts(t, dt);
    // RT applies ordered vent changes after a walk-in delay
    for (let i = 0; i < pendingRt.length; i++) {
      if (pendingRt[i].at <= t) {
        const [due] = pendingRt.splice(i, 1);
        i--;
        vent.applySettings(due.order.settings, 'rt');
        ctx.emit({ type: 'OrderCompleted', orderId: due.order.id });
      }
    }
    pharm.tick(t, dt); // rebuild EFFECTIVE params + drug targets + conversions
    vent.tick(t, dt);
    physiology?.tick(t, dt);
    labs.tick(t, dt);
    nurse.tick(t, dt);
    bedside.tick(t, dt);
    alarms.tick(t, dt);
    scenarioRt.tickEnd(t, dt);
    if (ended) return; // froze this tick — no snapshot after the end event

    if (t - lastSnapshotAt >= VITALS_SNAPSHOT_EVERY_S) {
      lastSnapshotAt = t;
      log.append(t, { type: 'VitalsSnapshot', vitals: { ...patient.vitals } });
    }
  }

  // ------------------------------------------------------------------ orders
  function placeOrder(draft: OrderDraft): Order {
    const order: Order = {
      ...draft,
      id: ctx.nextId('ord'),
      t: clock.simTime,
      status: 'active',
    };
    ctx.emit({ type: 'OrderPlaced', order: { ...order } });
    switch (order.kind) {
      case 'med':
      case 'lab':
      case 'nursing':
        nurse.onOrderPlaced(order);
        break;
      case 'imaging':
        labs.orderImaging(order.id, order.study);
        break;
      case 'vent':
        pendingRt.push({ at: clock.simTime + RT_RESPONSE_S, order });
        ctx.emit({ type: 'NurseSpeech', say: 'Calling RT for the vent change.' });
        break;
    }
    return order;
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
      case 'PlaceOrder':
        placeOrder(cmd.draft);
        break;
      case 'DiscontinueOrder': {
        ctx.emit({ type: 'OrderDiscontinued', orderId: cmd.orderId });
        nurse.cancelByOrder(cmd.orderId);
        // discontinuing an infusion's original order also stops the drip
        for (const inf of [...patient.infusions]) {
          if (nurse.orderForInfusion(inf.id) === cmd.orderId) {
            nurse.enqueueTitrate(inf.id, { stop: true });
          }
        }
        break;
      }
      case 'ModifyInfusion': {
        const infusion = patient.infusions.find((i) => i.id === cmd.infusionId);
        const drug = infusion ? getDrug(infusion.drugId) : undefined;
        if (!infusion || !drug?.infusion) break;
        const newRate = clamp(cmd.doseRate, drug.infusion.min, drug.infusion.max);
        nurse.enqueueTitrate(infusion.id, { newRate });
        break;
      }
      case 'StopInfusion':
        nurse.enqueueTitrate(cmd.infusionId, { stop: true });
        break;
      case 'VerbalOrder':
        handleVerbalOrder(ctx, nurse, placeOrder, cmd.verbal);
        break;
      case 'SilenceAlarm':
        alarms.silence(cmd.alarmId, cmd.durationS);
        break;
      case 'SilenceAllAlarms':
        alarms.silenceAll(cmd.durationS);
        break;
      case 'CycleNibp':
        ctx.emit({ type: 'PlayerAction', action: 'CycleNibp' });
        bedside.requestNibp();
        break;
      case 'SetVent':
        vent.applySettings(cmd.settings, cmd.by ?? 'player');
        break;
      case 'SetPump': {
        const ch = patient.devices.pumps.find((c) => c.id === cmd.channelId);
        if (!ch) break;
        const infusion = patient.infusions.find((i) => i.channelId === ch.id);
        if (cmd.rateMlHr !== undefined) {
          ch.rateMlHr = Math.max(0, cmd.rateMlHr);
          const drug = infusion ? getDrug(infusion.drugId) : undefined;
          if (infusion && drug) {
            infusion.doseRate = mlHrToDoseRate(drug, ch.rateMlHr, ctx.weightKg());
            ctx.emit({
              type: 'InfusionRateChanged',
              infusionId: infusion.id,
              drugId: drug.id,
              doseRate: infusion.doseRate,
              doseUnit: infusion.doseUnit,
              label: `${drug.name} ${infusion.doseRate} ${infusion.doseUnit} (pump)`,
            });
          }
        }
        if (cmd.running !== undefined) ch.running = cmd.running;
        ctx.emit({ type: 'PumpChannelChanged', channel: { ...ch } });
        break;
      }
      case 'PerformExam':
        bedside.performExam(cmd.zone, cmd.mode);
        break;
      case 'EquipTool':
        ctx.emit({ type: 'PlayerAction', action: 'EquipTool', detail: cmd.tool ?? 'none' });
        break;
      case 'UsSetView':
        bedside.setUsView(cmd.view);
        break;
      case 'UsSetQuality':
        bedside.setUsQuality(cmd.quality);
        break;
      case 'UsFreeze':
        bedside.setUsFrozen(cmd.frozen);
        break;
      case 'UsSaveClip':
        // the dataUrl stays bridge-side (media store); the log carries the id
        bedside.saveUsClip(cmd.view);
        break;
      case 'StartProcedure':
        procedures.start(cmd.procedureId, cmd.site);
        break;
      case 'AdvanceProcedureStep':
        procedures.advance(cmd.stepId, cmd.skipped);
        break;
      case 'AbortProcedure':
        procedures.abort();
        break;
      case 'ContaminateSterileField':
        procedures.contaminate(cmd.what);
        break;
      case 'WriteNote':
        log.append(t, { type: 'NoteWritten', text: cmd.text });
        break;
      case 'EndScenario':
        ctx.endScenario('aborted', 'Scenario ended by the player.');
        break;
      default: {
        const exhaustive: never = cmd;
        void exhaustive;
        break;
      }
    }
  }

  // ------------------------------------------------------------------ handle
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
    getWaveformParams: () => buildWaveformParams(ctx),
    getVentWave: () => vent.getWave(),
    getSimTime: () => clock.simTime,
    getTimeScale: () => clock.timeScale as TimeScale,
    getLog: () => log.all(),
    getActiveAlarms: () => alarms.getActive(),
    getBreathPhase: () => physiology?.getBreathPhase() ?? 0,
    isEnded: () => ended,
    serialize: (): EngineSave => ({
      version: 1,
      scenarioId: scenario.id,
      savedAtSim: clock.simTime,
      blob: {
        patient,
        log: log.toJSON(),
        clock: clock.serialize(),
        pharm: pharm.serialize(),
        labs: labs.serialize(),
        alarms: alarms.serialize(),
        scenario: scenarioRt.serialize(),
        nurse: nurse.serialize(),
        effects: effects.serialize(),
        rng: Object.fromEntries(
          (Object.keys(rng) as (keyof RngStreams)[]).map((k) => [k, rng[k].getState()]),
        ) as Record<keyof RngStreams, number>,
        counters: Object.fromEntries(idCounters),
        lastSnapshotAt,
        ended,
      } satisfies EngineBlob,
    }),
    getProcedureRuntime: () => procedures.getRuntime(),
    getNurseView: () => nurse.getView(),
    getTutorialView: () => scenarioRt.getTutorialView(),
  };
  return handle;
}

export { TICK_S };
