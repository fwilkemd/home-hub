/**
 * Nurse-side infusion + pump-channel mechanics: channel assignment (up to 4),
 * dose-rate -> ml/hr programming, titration, stop. Split from the task engine
 * so each file stays single-purpose.
 */
import type { DrugDefinition } from '../../contracts/content';
import type { Order } from '../../contracts/orders';
import type { Infusion, PumpChannelState } from '../../contracts/patient';
import { getDrug } from '../../data/drugs';
import type { EngineCtx } from '../types';
import { doseRateToMlHr } from '../pharmacology/kinetics';

const MAX_PUMP_CHANNELS = 4;

export interface InfusionOps {
  hangInfusion(order: Order, drug: DrugDefinition, rate: number): void;
  applyRateChange(infusion: Infusion, newRate: number): void;
  stopInfusion(infusion: Infusion): void;
  orderForInfusion(infusionId: string): string | undefined;
}

export function createInfusionOps(ctx: EngineCtx, say: (text: string) => void): InfusionOps {
  const infusionOrder = new Map<string, string>(); // infusionId -> orderId

  function findChannel(): PumpChannelState | null {
    const pumps = ctx.patient.devices.pumps;
    const free = pumps.find((ch) => !ch.running && ch.drugId === null);
    if (free) return free;
    if (pumps.length < MAX_PUMP_CHANNELS) {
      const ch: PumpChannelState = {
        id: `ch-${pumps.length + 1}`,
        drugId: null,
        label: '',
        rateMlHr: 0,
        vtbiMl: 0,
        infusedMl: 0,
        running: false,
        occluded: false,
      };
      pumps.push(ch);
      return ch;
    }
    return null;
  }

  function emitChannel(ch: PumpChannelState): void {
    ctx.emit({ type: 'PumpChannelChanged', channel: { ...ch } });
  }

  function infusionLabel(drug: DrugDefinition, rate: number): string {
    return `${drug.name} ${rate} ${drug.infusion?.doseUnit ?? ''}`.trim();
  }

  function applyRateChange(infusion: Infusion, newRate: number): void {
    const drug = getDrug(infusion.drugId);
    if (!drug) return;
    infusion.doseRate = newRate;
    const channel = ctx.patient.devices.pumps.find((c) => c.id === infusion.channelId);
    if (channel) {
      channel.rateMlHr = doseRateToMlHr(drug, newRate, ctx.weightKg());
      channel.running = true;
      emitChannel(channel);
    }
    const label = infusionLabel(drug, newRate);
    ctx.emit({
      type: 'InfusionRateChanged',
      infusionId: infusion.id,
      drugId: drug.id,
      doseRate: newRate,
      doseUnit: infusion.doseUnit,
      label,
    });
    const orderId = infusionOrder.get(infusion.id);
    if (orderId) {
      ctx.emit({ type: 'OrderModified', orderId, label, rate: newRate, rateUnit: infusion.doseUnit });
    }
  }

  function hangInfusion(order: Order, drug: DrugDefinition, rate: number): void {
    const existing = ctx.patient.infusions.find((i) => i.drugId === drug.id);
    if (existing) {
      // already running -> reprogram instead of double-hanging
      applyRateChange(existing, rate);
      ctx.emit({ type: 'OrderCompleted', orderId: order.id });
      return;
    }
    const channel = findChannel();
    if (!channel) {
      say('No free pump channel, doc.');
      ctx.emit({ type: 'OrderDiscontinued', orderId: order.id });
      return;
    }
    const infusion: Infusion = {
      id: ctx.nextId('inf'),
      drugId: drug.id,
      doseRate: rate,
      doseUnit: drug.infusion?.doseUnit ?? 'ml/hr',
      channelId: channel.id,
      startedAt: ctx.now(),
    };
    ctx.patient.infusions.push(infusion);
    infusionOrder.set(infusion.id, order.id);
    channel.drugId = drug.id;
    channel.label = drug.name;
    channel.rateMlHr = doseRateToMlHr(drug, rate, ctx.weightKg());
    channel.vtbiMl = drug.concentration.volumeMl;
    channel.infusedMl = 0;
    channel.running = true;
    ctx.emit({ type: 'InfusionStarted', infusion: { ...infusion }, label: infusionLabel(drug, rate) });
    emitChannel(channel);
    ctx.emit({ type: 'OrderCompleted', orderId: order.id });
  }

  function stopInfusion(infusion: Infusion): void {
    const drug = getDrug(infusion.drugId);
    const idx = ctx.patient.infusions.findIndex((i) => i.id === infusion.id);
    if (idx >= 0) ctx.patient.infusions.splice(idx, 1);
    const channel = ctx.patient.devices.pumps.find((c) => c.id === infusion.channelId);
    if (channel) {
      channel.running = false;
      channel.rateMlHr = 0;
      channel.drugId = null;
      channel.label = '';
      emitChannel(channel);
    }
    ctx.emit({
      type: 'InfusionStopped',
      infusionId: infusion.id,
      drugId: infusion.drugId,
      label: `${drug?.name ?? infusion.drugId} stopped`,
    });
    const orderId = infusionOrder.get(infusion.id);
    if (orderId) ctx.emit({ type: 'OrderDiscontinued', orderId });
    infusionOrder.delete(infusion.id);
  }

  return {
    hangInfusion,
    applyRateChange,
    stopInfusion,
    orderForInfusion: (id) => infusionOrder.get(id),
  };
}
