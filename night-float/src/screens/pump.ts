/**
 * Infusion pump stack (SPEC §7.3) — one row per channel: drug, rate, dose
 * line, VTBI/infused, run-state chip. Zoom hit regions: rate up/down (+/-10%)
 * and run/pause toggle per channel. Occluded channels flash amber.
 */
import type { DeviceScreenInstance, EngineHandle } from '../contracts/runtime';
import type { PumpChannelState } from '../contracts/patient';
import { dispatch } from '../bridge/session';
import { MONO, ScreenPainter } from './device-screen';

const W = 512;
const H = 640;
const TOP_H = 46;

const INK = '#dae5ed';
const DIM = '#60747f';
const AMBER = '#ffb64a';

function fmtRate(r: number): string {
  return r >= 100 ? String(Math.round(r)) : r.toFixed(1);
}

export function createPumpScreen(engine: EngineHandle): DeviceScreenInstance {
  const painter = new ScreenPainter('pump', W, H, 20);

  function bumpRate(ch: PumpChannelState, dir: 1 | -1): void {
    let rate: number;
    if (dir === 1) rate = ch.rateMlHr <= 0 ? 1 : Math.round(ch.rateMlHr * 1.1 * 10) / 10;
    else rate = ch.rateMlHr <= 1 ? 0 : Math.round(ch.rateMlHr * 0.9 * 10) / 10;
    dispatch({ type: 'SetPump', channelId: ch.id, rateMlHr: rate });
  }

  function draw(realTimeS: number): void {
    const c = painter.ctx;
    const patient = engine.getPatient();
    const pumps = patient.devices.pumps;
    painter.clearRegions();

    c.fillStyle = '#080b0e';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#0c1115';
    c.fillRect(0, 0, W, TOP_H);
    painter.text('NF PUMP', 14, TOP_H / 2, 17, INK, 'left', MONO, '700');
    painter.text(`${pumps.length} CH`, W - 14, TOP_H / 2, 13, DIM, 'right');
    c.strokeStyle = 'rgba(140,180,205,0.14)';
    c.beginPath();
    c.moveTo(0, TOP_H - 0.5);
    c.lineTo(W, TOP_H - 0.5);
    c.stroke();

    if (pumps.length === 0) {
      painter.text('NO CHANNELS', W / 2, H / 2, 16, DIM, 'center');
      return;
    }

    const rowH = Math.min(148, Math.floor((H - TOP_H - 8) / pumps.length));
    pumps.forEach((ch, i) => drawRow(ch, TOP_H + 4 + i * rowH, rowH - 6, realTimeS, i));
  }

  function drawRow(ch: PumpChannelState, y: number, h: number, realT: number, idx: number): void {
    const c = painter.ctx;
    const infusion = engine.getPatient().infusions.find((f) => f.channelId === ch.id);
    const free = !ch.drugId && !ch.label;
    const flash = ch.occluded && (realT * 2) % 1 < 0.5;

    painter.rounded(8, y, W - 16, h, 9);
    c.fillStyle = flash ? 'rgba(255,182,74,0.16)' : 'rgba(255,255,255,0.035)';
    c.fill();
    c.strokeStyle = ch.occluded ? AMBER : 'rgba(255,255,255,0.12)';
    c.lineWidth = ch.occluded ? 1.6 : 1;
    painter.rounded(8.5, y + 0.5, W - 17, h - 1, 9);
    c.stroke();

    const pad = 20;
    painter.text(String.fromCharCode(65 + idx), pad, y + 20, 12, DIM); // A/B/C/D
    painter.text(
      free ? '— free —' : ch.label || ch.drugId || '',
      pad + 20,
      y + 20,
      17,
      free ? DIM : INK,
      'left',
      MONO,
      free ? '' : '700',
    );

    // state chip
    const chipTxt = ch.occluded ? 'OCCLUDED' : ch.running ? 'RUN' : 'HOLD';
    const chipBg = ch.occluded ? AMBER : ch.running ? '#61d99a' : '#5a6a76';
    painter.chip(W - 118, y + 8, 96, 24, chipTxt, '#0a0d10', chipBg);

    if (!free) {
      // rate + dose
      painter.text(fmtRate(ch.rateMlHr), pad + 16, y + h / 2 + 14, 40, ch.running ? INK : DIM, 'left', MONO, '700');
      painter.text('mL/h', pad + 120, y + h / 2 + 20, 12, DIM);
      if (infusion) {
        painter.text(`${infusion.doseRate} ${infusion.doseUnit}`, pad + 16, y + h - 16, 13, '#9fd8ef');
      }
      painter.text(
        `VTBI ${Math.max(0, Math.round(ch.vtbiMl - ch.infusedMl))} / ${Math.round(ch.vtbiMl)} mL`,
        W - 128,
        y + h - 16,
        12,
        DIM,
        'right',
      );

      // controls: rate up / down, run-pause
      const bx = W - 118;
      const bh = Math.min(34, (h - 44) / 2);
      painter.button(bx, y + 38, 44, bh, '', () => bumpRate(ch, 1), { glyph: 'up', color: INK });
      painter.button(bx + 52, y + 38, 44, bh, '', () => bumpRate(ch, -1), { glyph: 'down', color: INK });
      painter.button(
        bx,
        y + 42 + bh,
        96,
        bh,
        '',
        () => dispatch({ type: 'SetPump', channelId: ch.id, running: !ch.running }),
        { glyph: ch.running ? 'pause' : 'play', color: ch.running ? AMBER : '#61d99a' },
      );
    }
  }

  return {
    device: 'pump',
    canvas: painter.canvas,
    update(realTimeS: number): void {
      if (painter.due(realTimeS)) draw(realTimeS);
    },
    click(x: number, y: number): void {
      painter.click(x, y);
    },
  };
}
