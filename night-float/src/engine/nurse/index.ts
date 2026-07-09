/**
 * Nurse NPC task engine (SPEC §11): consumes orders into a FIFO task queue
 * (stat labs jump the line), executes one task at a time with sim-time phases
 * and abstract station movement (the world animates the walk), administers
 * meds/infusions through pharmacology + the pump channels, draws labs, cycles
 * NIBP, and barks. Verbal orders build the same tasks with faster handling.
 */
import type { Order } from '../../contracts/orders';
import type { DrugDefinition } from '../../contracts/content';
import type { NurseTaskKind } from '../../contracts/events';
import type { NurseStation } from '../../contracts/ids';
import type { NurseView } from '../../contracts/runtime';
import { getDrug } from '../../data/drugs';
import type { EngineCtx } from '../types';
import type { PharmacologyHandle } from '../pharmacology';
import type { LabsHandle } from '../labs';
import type { BedsideHandle } from '../bedside';
import { createInfusionOps } from './infusions';

const WALK_S = 6; // per-leg walk time; the world's pathing is cosmetic only
const VERBAL_SPEEDUP = 0.65; // verbal orders skip the workstation round-trip
const CRISIS_BARK_COOLDOWN_S = 45;

interface Phase {
  station: NurseStation;
  walkS: number;
  actS: number;
  sayOnAct?: string;
  onDone?: () => void;
}

interface Task {
  id: string;
  kind: NurseTaskKind;
  label: string;
  orderId?: string;
  stat: boolean;
  phases: Phase[];
  phaseIdx: number;
  phaseElapsed: number;
  doneSay?: string;
}

export interface NurseHandle {
  tick(t: number, dt: number): void;
  onOrderPlaced(order: Order): void;
  enqueueTitrate(infusionId: string, opts: { newRate?: number; stop?: boolean; verbal?: boolean }): void;
  cancelByOrder(orderId: string): void;
  onCrisisAlarm(label: string): void;
  getView(): NurseView;
  /** orderId that started an infusion (for OrderModified on titration) */
  orderForInfusion(infusionId: string): string | undefined;
  serialize(): { queue: number; busyWith: string | null };
}

export function createNurse(
  ctx: EngineCtx,
  pharm: PharmacologyHandle,
  labs: LabsHandle,
  bedside: BedsideHandle,
): NurseHandle {
  const queue: Task[] = [];
  let current: Task | null = null;
  let station: NurseStation = 'station';
  let target: NurseStation = 'station';
  let lastCrisisBarkAt = -Infinity;

  const say = (text: string) => ctx.emit({ type: 'NurseSpeech', say: text });
  const infusions = createInfusionOps(ctx, say);

  function finishMedBolus(order: Order, drug: DrugDefinition, dose: number, unit: string, route: string): void {
    ctx.patient.medsGiven.push({ t: ctx.now(), drugId: drug.id, drugName: drug.name, dose, unit, route });
    pharm.applyBolus(drug.id, dose);
    ctx.emit({
      type: 'MedAdministered',
      drugId: drug.id,
      drugName: drug.name,
      dose,
      unit,
      route,
      by: 'nurse',
    });
    ctx.emit({ type: 'OrderCompleted', orderId: order.id });
  }

  // ------------------------------------------------------------ task builders
  function enqueue(task: Task): void {
    if (task.stat) {
      const firstNonStat = queue.findIndex((q) => !q.stat);
      if (firstNonStat >= 0) {
        queue.splice(firstNonStat, 0, task);
        return;
      }
    }
    queue.push(task);
  }

  function makeTask(
    kind: NurseTaskKind,
    label: string,
    phases: Phase[],
    opts: { orderId?: string; stat?: boolean; doneSay?: string } = {},
  ): Task {
    return {
      id: ctx.nextId('task'),
      kind,
      label,
      orderId: opts.orderId,
      stat: opts.stat ?? false,
      phases,
      phaseIdx: 0,
      phaseElapsed: 0,
      doneSay: opts.doneSay,
    };
  }

  function medTask(order: Order & { kind: 'med' }, drug: DrugDefinition, speed: number): void {
    if (order.mode === 'bolus' && drug.bolus) {
      const dose = clampDose(order.dose ?? drug.bolus.default, drug.bolus.min, drug.bolus.max);
      const unit = drug.bolus.doseUnit;
      const route = order.route;
      enqueue(
        makeTask('give_med', order.label, [
          { station: 'supply', walkS: WALK_S, actS: 8 * speed },
          {
            station: 'bedside_right',
            walkS: WALK_S,
            actS: Math.max(drug.bolus.pushS, 2),
            sayOnAct: `Pushing the ${drug.name} now.`,
            onDone: () => finishMedBolus(order, drug, dose, unit, route),
          },
        ], { orderId: order.id, doneSay: 'In.' }),
      );
    } else if (order.mode === 'infusion' && drug.infusion) {
      const rate = clampDose(order.rate ?? drug.infusion.default, drug.infusion.min, drug.infusion.max);
      enqueue(
        makeTask('hang_infusion', order.label, [
          { station: 'supply', walkS: WALK_S, actS: 10 * speed },
          {
            station: 'pump',
            walkS: WALK_S,
            actS: 12 * speed,
            sayOnAct: `Programming the ${drug.name}.`,
            onDone: () => infusions.hangInfusion(order, drug, rate),
          },
        ], { orderId: order.id, doneSay: "Drip's up." }),
      );
    } else {
      say(`${drug.name} can't be given that way.`);
      ctx.emit({ type: 'OrderDiscontinued', orderId: order.id });
    }
  }

  function nursingTask(order: Order & { kind: 'nursing' }, speed: number): void {
    if (order.task === 'cycle_nibp') {
      enqueue(
        makeTask('cycle_nibp', order.label, [
          {
            station: 'bedside_right',
            walkS: WALK_S,
            actS: 30, // cuff time; the measurement lands when it finishes
            sayOnAct: 'Cycling a pressure.',
            onDone: () => {
              bedside.measureNibpNow();
              ctx.emit({ type: 'OrderCompleted', orderId: order.id });
            },
          },
        ], { orderId: order.id }),
      );
    } else if (order.task === 'draw_labs') {
      say('Which panel do you want? Put the lab order in.');
      ctx.emit({ type: 'OrderCompleted', orderId: order.id });
    } else {
      enqueue(
        makeTask(order.task === 'reposition' ? 'reposition' : 'custom', order.label, [
          {
            station: 'bedside_left',
            walkS: WALK_S,
            actS: 22 * speed,
            onDone: () => ctx.emit({ type: 'OrderCompleted', orderId: order.id }),
          },
        ], { orderId: order.id, doneSay: 'Done.' }),
      );
    }
  }

  function onOrderPlaced(order: Order): void {
    const speed = order.verbal ? VERBAL_SPEEDUP : 1;
    switch (order.kind) {
      case 'med': {
        const drug = getDrug(order.drugId);
        if (!drug) {
          say(`We don't stock ${order.drugId}.`);
          ctx.emit({ type: 'OrderDiscontinued', orderId: order.id });
          return;
        }
        medTask(order, drug, speed);
        break;
      }
      case 'lab':
        enqueue(
          makeTask('draw_labs', order.label, [
            { station: 'supply', walkS: WALK_S, actS: 4 * speed },
            {
              station: 'bedside_left',
              walkS: WALK_S,
              actS: (order.stat ? 14 : 20) * speed,
              sayOnAct: 'Drawing labs.',
              onDone: () => labs.orderDrawn(order.id, order.panelId, order.stat),
            },
          ], { orderId: order.id, stat: order.stat, doneSay: 'Labs are off.' }),
        );
        break;
      case 'nursing':
        nursingTask(order, speed);
        break;
      case 'imaging':
      case 'vent':
        break; // radiology / RT handle these (engine index routes them)
    }
  }

  function enqueueTitrate(
    infusionId: string,
    opts: { newRate?: number; stop?: boolean; verbal?: boolean },
  ): void {
    const label = opts.stop ? 'Stop infusion' : 'Titrate infusion';
    enqueue(
      makeTask('titrate_infusion', label, [
        {
          station: 'pump',
          walkS: WALK_S,
          actS: 8 * (opts.verbal ? VERBAL_SPEEDUP : 1),
          sayOnAct: opts.stop ? 'Stopping the drip.' : 'Titrating.',
          onDone: () => {
            const infusion = ctx.patient.infusions.find((i) => i.id === infusionId);
            if (!infusion) {
              say("That drip isn't running.");
              return;
            }
            if (opts.stop) infusions.stopInfusion(infusion);
            else if (opts.newRate !== undefined) infusions.applyRateChange(infusion, opts.newRate);
          },
        },
      ]),
    );
  }

  function cancelByOrder(orderId: string): void {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].orderId === orderId) queue.splice(i, 1);
    }
  }

  function onCrisisAlarm(_label: string): void {
    const t = ctx.now();
    if (t - lastCrisisBarkAt < CRISIS_BARK_COOLDOWN_S) return;
    lastCrisisBarkAt = t;
    say('Doc — look at the monitor.');
  }

  // ------------------------------------------------------------ tick
  function startNext(): void {
    current = queue.shift() ?? null;
    if (!current) return;
    ctx.emit({
      type: 'NurseAction',
      taskId: current.id,
      kind: current.kind,
      phase: 'started',
      say: 'On it.',
      detail: current.label,
    });
  }

  function finishCurrent(): void {
    if (!current) return;
    ctx.emit({
      type: 'NurseAction',
      taskId: current.id,
      kind: current.kind,
      phase: 'done',
      say: current.doneSay,
      detail: current.label,
    });
    current = null;
  }

  function tick(_t: number, dt: number): void {
    if (!current) {
      if (queue.length > 0) startNext();
      else {
        target = 'station';
        station = 'station';
        return;
      }
    }
    if (!current) return;

    const phase = current.phases[current.phaseIdx];
    if (!phase) {
      finishCurrent();
      return;
    }
    target = phase.station;
    const before = current.phaseElapsed;
    current.phaseElapsed += dt;
    if (before < phase.walkS && current.phaseElapsed >= phase.walkS) {
      station = phase.station; // arrived
      if (phase.sayOnAct) say(phase.sayOnAct);
    }
    if (current.phaseElapsed >= phase.walkS + phase.actS) {
      station = phase.station;
      phase.onDone?.();
      current.phaseIdx += 1;
      current.phaseElapsed = 0;
      if (current.phaseIdx >= current.phases.length) finishCurrent();
    }
  }

  function getView(): NurseView {
    return {
      station,
      target,
      busyWith: current ? current.label : null,
      // speech display flows through NurseSpeech events (the bridge stamps
      // real time); the view never carries wall-clock time out of the engine.
      say: null,
      sayUntilReal: 0,
    };
  }

  return {
    tick,
    onOrderPlaced,
    enqueueTitrate,
    cancelByOrder,
    onCrisisAlarm,
    getView,
    orderForInfusion: (id) => infusions.orderForInfusion(id),
    serialize: () => ({ queue: queue.length, busyWith: current?.label ?? null }),
  };
}

function clampDose(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
