/**
 * Ventilator screen (SPEC §7.2) — standby splash until connected + started;
 * running: Paw / Flow / Volume sweep curves from the pure lung-curve model,
 * numerics, vent-source alarm banner, and zoom-clickable mode buttons +
 * setting steppers that dispatch SetVent.
 */
import type { DeviceScreenInstance, EngineHandle } from '../contracts/runtime';
import type { VentMode } from '../contracts/ids';
import type { VentSettings } from '../contracts/patient';
import { ventCurves, clamp } from '../engine/waveforms';
import { dispatch } from '../bridge/session';
import { MONO, ScreenPainter } from './device-screen';
import { SweepLane } from './sweep';

const W = 1024;
const H = 640;
const TOP_H = 52;
const CTRL_H = 128;
const PLOT_X = 12;
const PLOT_W = 640;
const WINDOW_S = 6;

const INK = '#d9e4ec';
const DIM = '#5f7383';
const LANE_COLORS = { paw: '#e8d24a', flow: '#3fd6e8', vol: '#eef2f5' };

interface LaneSpec {
  id: 'paw' | 'flow' | 'vol';
  label: string;
  unit: string;
  min: number;
  max: number;
  grid: number[];
}

const LANES: LaneSpec[] = [
  { id: 'paw', label: 'PAW', unit: 'cmH2O', min: -5, max: 40, grid: [0, 10, 20, 30, 40] },
  { id: 'flow', label: 'FLOW', unit: 'L/min', min: -60, max: 60, grid: [-60, 0, 60] },
  { id: 'vol', label: 'VOL', unit: 'mL', min: 0, max: 600, grid: [0, 300, 600] },
];

export function createVentScreen(engine: EngineHandle): DeviceScreenInstance {
  const painter = new ScreenPainter('vent', W, H, 30);
  const plotH = H - TOP_H - CTRL_H - 12;
  const laneH = Math.floor(plotH / 3);
  const sweeps = LANES.map(
    (l) => new SweepLane(PLOT_W, laneH - 10, LANE_COLORS[l.id], 2, 4),
  );
  let breathPhase = 0;
  let lastT: number | null = null;

  function setVent(patch: Partial<VentSettings>): void {
    dispatch({ type: 'SetVent', settings: patch, by: 'player' });
  }

  function draw(realTimeS: number): void {
    const c = painter.ctx;
    const vw = engine.getVentWave();
    const vent = engine.getPatient().devices.vent;
    painter.clearRegions();

    c.fillStyle = '#070b0e';
    c.fillRect(0, 0, W, H);

    // ---- top bar
    c.fillStyle = '#0b1116';
    c.fillRect(0, 0, W, TOP_H);
    painter.text('NF VENT', 16, TOP_H / 2, 19, INK, 'left', MONO, '700');
    painter.chip(118, TOP_H / 2 - 14, 62, 28, vw.standby ? 'STBY' : vw.mode, '#0b1116', vw.standby ? DIM : '#8fd0a8');
    drawAlarmBanner(realTimeS);
    c.strokeStyle = 'rgba(140,180,205,0.14)';
    c.beginPath();
    c.moveTo(0, TOP_H - 0.5);
    c.lineTo(W, TOP_H - 0.5);
    c.stroke();

    if (vw.standby || !vw.connected) {
      drawStandby(vw.connected, vent.mode);
      return;
    }

    // ---- advance breath phase (visual time base only) and sweeps
    const t0 = lastT ?? realTimeS - 1 / 30;
    lastT = realTimeS;
    const phaseRate = clamp(vw.rate, 4, 60) / 60; // breaths per second
    breathPhase += (realTimeS - t0) * phaseRate;
    const pxPerSec = PLOT_W / WINDOW_S;
    LANES.forEach((lane, i) => {
      sweeps[i].advance(t0, realTimeS, pxPerSec, (t) => {
        const ph = breathPhase - (realTimeS - t) * phaseRate;
        const s = ventCurves(vw, ((ph % 1) + 1) % 1);
        const v = lane.id === 'paw' ? s.paw : lane.id === 'flow' ? s.flow : s.vol;
        return (v - lane.min) / (lane.max - lane.min);
      });
    });

    // ---- lanes
    LANES.forEach((lane, i) => {
      const y = TOP_H + 6 + i * laneH;
      for (const g of lane.grid) {
        const gy = y + 5 + (1 - (g - lane.min) / (lane.max - lane.min)) * (laneH - 10 - 4) + 2;
        c.strokeStyle = g === 0 ? 'rgba(140,180,205,0.20)' : 'rgba(140,180,205,0.08)';
        c.beginPath();
        c.moveTo(PLOT_X, gy + 0.5);
        c.lineTo(PLOT_X + PLOT_W, gy + 0.5);
        c.stroke();
        painter.text(String(g), PLOT_X + PLOT_W + 6, gy, 10, DIM, 'left');
      }
      sweeps[i].blit(c, PLOT_X, y + 5);
      painter.label(`${lane.label}  ${lane.unit}`, PLOT_X + 6, y + 14, 12, LANE_COLORS[lane.id]);
    });

    drawNumerics(vw);
    drawControls(vent, false);
  }

  function drawAlarmBanner(realT: number): void {
    const alarms = engine.getActiveAlarms().filter((a) => a.source === 'vent');
    if (alarms.length === 0) return;
    const top = [...alarms].sort((a, b) => b.raisedAt - a.raisedAt)[0];
    const simTime = engine.getSimTime();
    const silenced = top.silencedUntil > simTime;
    const flash = (realT * 1.6) % 1 < 0.5;
    const bg = silenced ? '#1a222b' : top.priority === 'crisis' ? (flash ? '#8f1626' : '#38070f') : flash ? '#7d660f' : '#3d3307';
    const c = painter.ctx;
    painter.rounded(220, 8, W - 440, TOP_H - 16, 8);
    c.fillStyle = bg;
    c.fill();
    if (silenced) painter.bellCrossed(240, TOP_H / 2, 10, '#93a7b8');
    painter.text(top.label.toUpperCase(), 220 + (W - 440) / 2, TOP_H / 2, 15, '#fdeef0', 'center', MONO, '700');
  }

  function drawStandby(connected: boolean, mode: VentMode): void {
    const c = painter.ctx;
    c.fillStyle = 'rgba(160,200,230,0.05)';
    c.fillRect(PLOT_X, TOP_H + 10, W - 24, H - TOP_H - 22);
    painter.text('STANDBY', W / 2, H / 2 - 60, 46, 'rgba(217,228,236,0.5)', 'center', MONO, '700');
    painter.text(
      connected ? 'circuit connected — ready to ventilate' : 'no patient circuit',
      W / 2,
      H / 2 - 10,
      17,
      DIM,
      'center',
    );
    if (connected) {
      painter.button(
        W / 2 - 150,
        H / 2 + 34,
        300,
        56,
        'START VENTILATION',
        // Engine contract: any player SetVent while connected leaves standby.
        () => setVent({ mode }),
        { color: '#8fd0a8', fontSize: 17 },
      );
    }
  }

  function drawNumerics(vw: ReturnType<EngineHandle['getVentWave']>): void {
    const x = PLOT_X + PLOT_W + 56;
    const wCol = W - x - 16;
    const cell = (
      row: number,
      col: number,
      label: string,
      value: string,
      unit: string,
      color = INK,
    ) => {
      const cw = wCol / 2;
      const cx = x + col * cw;
      const cy = TOP_H + 14 + row * 76;
      painter.label(label, cx, cy, 12, DIM);
      painter.text(value, cx, cy + 30, 32, color, 'left', MONO, '700');
      painter.ctx.font = `700 32px ${MONO}`;
      const vw = painter.ctx.measureText(value).width;
      if (unit) painter.text(unit, cx + vw + 9, cy + 38, 11, DIM, 'left');
    };
    cell(0, 0, 'PPEAK', String(Math.round(vw.ppeak)), 'cmH2O', LANE_COLORS.paw);
    cell(0, 1, 'PPLAT', String(Math.round(vw.pplat)), 'cmH2O');
    cell(1, 0, 'PEEP', String(Math.round(vw.peep)), 'cmH2O');
    cell(1, 1, 'FIO2', String(Math.round(vw.fio2 * 100)), '%', '#9fd8ef');
    cell(2, 0, 'VTE', String(Math.round(vw.measuredVteMl)), 'mL', LANE_COLORS.vol);
    cell(2, 1, 'MVE', ((vw.measuredVteMl * vw.rate) / 1000).toFixed(1), 'L/min');
    cell(3, 0, 'RATE', String(Math.round(vw.rate)), '/min');
    cell(3, 1, vw.spontaneous ? 'SPONT' : 'CTRL', vw.mode, '');
  }

  function drawControls(vent: VentSettings, disabled: boolean): void {
    const y = H - CTRL_H + 8;
    const c = painter.ctx;
    c.strokeStyle = 'rgba(140,180,205,0.14)';
    c.beginPath();
    c.moveTo(0, y - 8.5);
    c.lineTo(W, y - 8.5);
    c.stroke();

    // mode buttons
    const modes: VentMode[] = ['VC', 'PC', 'PS'];
    modes.forEach((m, i) => {
      painter.button(PLOT_X + i * 74, y, 64, 44, m, () => setVent({ mode: m }), {
        active: vent.mode === m,
        disabled,
        color: '#a8dfc0',
      });
    });

    // contextual steppers
    type Step = { label: string; value: string; dec: () => void; inc: () => void };
    const steps: Step[] = [];
    const rr: Step = {
      label: 'RR',
      value: String(vent.setRr),
      dec: () => setVent({ setRr: clamp(vent.setRr - 1, 4, 40) }),
      inc: () => setVent({ setRr: clamp(vent.setRr + 1, 4, 40) }),
    };
    const peep: Step = {
      label: 'PEEP',
      value: String(vent.peep),
      dec: () => setVent({ peep: clamp(vent.peep - 1, 0, 20) }),
      inc: () => setVent({ peep: clamp(vent.peep + 1, 0, 20) }),
    };
    const fio2: Step = {
      label: 'FIO2 %',
      value: String(Math.round(vent.fio2 * 100)),
      dec: () => setVent({ fio2: clamp(Math.round(vent.fio2 * 100 - 5) / 100, 0.21, 1) }),
      inc: () => setVent({ fio2: clamp(Math.round(vent.fio2 * 100 + 5) / 100, 0.21, 1) }),
    };
    if (vent.mode === 'VC') {
      steps.push(rr, {
        label: 'VT mL',
        value: String(vent.setVtMl),
        dec: () => setVent({ setVtMl: clamp(vent.setVtMl - 25, 200, 800) }),
        inc: () => setVent({ setVtMl: clamp(vent.setVtMl + 25, 200, 800) }),
      });
    } else if (vent.mode === 'PC') {
      steps.push(rr, {
        label: 'PINSP',
        value: String(vent.pinsp),
        dec: () => setVent({ pinsp: clamp(vent.pinsp - 2, 5, 40) }),
        inc: () => setVent({ pinsp: clamp(vent.pinsp + 2, 5, 40) }),
      });
    } else {
      steps.push({
        label: 'PS',
        value: String(vent.psupp),
        dec: () => setVent({ psupp: clamp(vent.psupp - 2, 0, 30) }),
        inc: () => setVent({ psupp: clamp(vent.psupp + 2, 0, 30) }),
      });
    }
    steps.push(peep, fio2);

    const sx = PLOT_X + 3 * 74 + 24;
    const sw = 180;
    steps.forEach((s, i) => {
      const x = sx + i * (sw + 14);
      painter.label(s.label, x + 4, y + 10, 12, DIM);
      painter.text(s.value, x + sw / 2, y + 42, 30, INK, 'center', MONO, '700');
      painter.button(x, y + 62, 56, 44, '', s.dec, { glyph: 'minus', disabled, color: '#9fb4c4' });
      painter.button(x + sw - 56, y + 62, 56, 44, '', s.inc, { glyph: 'plus', disabled, color: '#9fb4c4' });
    });
  }

  return {
    device: 'vent',
    canvas: painter.canvas,
    update(realTimeS: number): void {
      if (painter.due(realTimeS)) draw(realTimeS);
    },
    click(x: number, y: number): void {
      painter.click(x, y);
    },
  };
}
