/**
 * Patient monitor screen (SPEC §7.1) — stacked sweep waveforms (ECG, pleth,
 * resp, art when an a-line exists, capno when intubated), numerics column,
 * wall clock, alarm banner with priority flashing, silence / NIBP controls.
 * This is the money shot: keep the tracings glowing and smooth.
 */
import type { DeviceScreenInstance, EngineHandle } from '../contracts/runtime';
import type { RhythmId } from '../contracts/ids';
import { isEvent, type SimEvent } from '../contracts/events';
import {
  BeatClock,
  ecgSample,
  plethSample,
  respSample,
  artSample,
  capnoSample,
} from '../engine/waveforms';
import { bus } from '../bridge/bus';
import { dispatch } from '../bridge/session';
import { hubStore } from '../bridge/store';
import { MONO, ScreenPainter } from './device-screen';
import { SweepLane } from './sweep';

const W = 1024;
const H = 640;
const TOP_H = 60;
const BOTTOM_H = 54;
const PLOT_X = 10;
const PLOT_W = Math.round(W * 0.72) - PLOT_X; // ~72% for waveforms
const NUM_X = PLOT_X + PLOT_W + 14;
const WINDOW_S = 6.25;

const COLORS = {
  ecg: '#2ee66b',
  pleth: '#35d5e8',
  resp: '#e8d24a',
  art: '#ff5b5b',
  capno: '#ffd75e',
  nibp: '#ff9f43',
  ink: '#dce8f2',
  dim: '#5d7284',
  bg: '#04070a',
};

const RHYTHM_LABELS: Record<RhythmId, string> = {
  sinus: 'SINUS',
  sinus_tach: 'SINUS TACH',
  sinus_brady: 'SINUS BRADY',
  afib: 'AFIB',
  vt: 'VTACH',
  vf: 'VFIB',
  asystole: 'ASYSTOLE',
};

interface LaneDef {
  id: 'ecg' | 'pleth' | 'resp' | 'art' | 'capno';
  label: string;
  color: string;
  ticks?: { v01: number; text: string }[];
}

function priorityWeight(p: string): number {
  return p === 'crisis' ? 3 : p === 'warning' ? 2 : 1;
}

function wallClock(clockStart: string, simTime: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(clockStart);
  const base = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : 3 * 3600;
  const total = Math.floor(base + simTime) % 86400;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(hh)}:${p2(mm)}:${p2(ss)}`;
}

export function createMonitorScreen(engine: EngineHandle): DeviceScreenInstance {
  const painter = new ScreenPainter('monitor', W, H, 30);
  const clock = new BeatClock(engine.getWaveformParams().beatSeed);
  let lanes: { def: LaneDef; sweep: SweepLane; y: number; h: number }[] = [];
  let layoutKey = '';
  let lastT: number | null = null;
  let lastBeatIndex = -1;

  function rebuildLanes(defs: LaneDef[]): void {
    const plotH = H - TOP_H - BOTTOM_H - 8;
    const laneH = Math.floor(plotH / defs.length);
    lanes = defs.map((def, i) => ({
      def,
      sweep: new SweepLane(PLOT_W, laneH - 8, def.color, 2, 5),
      y: TOP_H + 4 + i * laneH,
      h: laneH,
    }));
  }

  /** Latest NIBP measurement from the tail of the event log. */
  function lastNibp(): { sbp: number; dbp: number; map: number; t: number } | null {
    const log = engine.getLog();
    for (let i = log.length - 1, seen = 0; i >= 0 && seen < 50; i--, seen++) {
      const e: SimEvent = log[i];
      if (isEvent(e, 'NibpMeasured')) return { sbp: e.sbp, dbp: e.dbp, map: e.map, t: e.t };
    }
    return null;
  }

  function draw(realTimeS: number): void {
    const c = painter.ctx;
    const params = engine.getWaveformParams();
    const vitals = engine.getVitals();
    const simTime = engine.getSimTime();
    const respRate = params.resp.rate;
    painter.clearRegions();

    clock.update({ rhythm: params.ecg.rhythm, rate: params.ecg.rate }, realTimeS);

    // ---- QRS beep hook: pitch handled by audio, we just announce beats
    const beat = clock.phaseAt(realTimeS);
    if (beat.inBeat && beat.beatIndex !== lastBeatIndex) {
      if (lastBeatIndex >= 0 && params.pleth.present) bus.emit('qrsBeep', { spo2: vitals.spo2 });
      lastBeatIndex = beat.beatIndex;
    }

    // ---- lane set (art/capno appear only when present)
    const defs: LaneDef[] = [
      { id: 'ecg', label: 'II', color: COLORS.ecg },
      { id: 'pleth', label: 'PLETH', color: COLORS.pleth },
      { id: 'resp', label: 'RESP', color: COLORS.resp },
    ];
    if (params.art.present) {
      defs.push({
        id: 'art',
        label: 'ART',
        color: COLORS.art,
        ticks: [
          { v01: 0.5, text: '100' },
          { v01: 1, text: '200' },
        ],
      });
    }
    if (params.capno.present) {
      defs.push({
        id: 'capno',
        label: 'ETCO2',
        color: COLORS.capno,
        ticks: [
          { v01: 0.4, text: '20' },
          { v01: 0.8, text: '40' },
        ],
      });
    }
    const key = defs.map((d) => d.id).join(',');
    if (key !== layoutKey) {
      layoutKey = key;
      rebuildLanes(defs);
      lastT = null;
    }

    // ---- advance sweeps
    const t0 = lastT ?? realTimeS - 1 / 30;
    lastT = realTimeS;
    const pxPerSec = PLOT_W / WINDOW_S;
    for (const lane of lanes) {
      const id = lane.def.id;
      lane.sweep.advance(t0, realTimeS, pxPerSec, (t) => {
        switch (id) {
          case 'ecg':
            return (ecgSample(params.ecg, clock, t) + 0.6) / 2.2;
          case 'pleth':
            return plethSample(params.pleth, clock, t, respRate) / 1.1;
          case 'resp':
            return respSample(params.resp, t) / 1.1;
          case 'art':
            return artSample(params.art, clock, t, respRate) / 200;
          case 'capno':
            return capnoSample(params.capno, t) / 50;
        }
      });
    }

    // ---- background + lanes
    c.fillStyle = COLORS.bg;
    c.fillRect(0, 0, W, H);
    for (const lane of lanes) {
      // hairline separator + faint mid gridline
      c.strokeStyle = 'rgba(120,160,190,0.10)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(PLOT_X, lane.y + lane.h - 0.5);
      c.lineTo(PLOT_X + PLOT_W, lane.y + lane.h - 0.5);
      c.stroke();
      if (lane.def.ticks) {
        for (const tick of lane.def.ticks) {
          const ty = lane.y + 4 + (1 - tick.v01) * (lane.h - 8);
          c.strokeStyle = 'rgba(120,160,190,0.08)';
          c.beginPath();
          c.moveTo(PLOT_X, ty + 0.5);
          c.lineTo(PLOT_X + PLOT_W, ty + 0.5);
          c.stroke();
          painter.text(tick.text, PLOT_X + PLOT_W - 4, ty + 7, 10, COLORS.dim, 'right');
        }
      }
      lane.sweep.blit(c, PLOT_X, lane.y + 4);
      painter.label(lane.def.label, PLOT_X + 6, lane.y + 13, 13, lane.def.color);
    }

    drawTopStrip(realTimeS, simTime);
    drawNumerics(realTimeS, params, vitals, simTime);
    drawButtons();
  }

  function drawTopStrip(realT: number, simTime: number): void {
    const c = painter.ctx;
    c.fillStyle = '#080d12';
    c.fillRect(0, 0, W, TOP_H);
    c.strokeStyle = 'rgba(120,160,190,0.14)';
    c.beginPath();
    c.moveTo(0, TOP_H - 0.5);
    c.lineTo(W, TOP_H - 0.5);
    c.stroke();
    painter.text('ICU 07', 16, TOP_H / 2, 21, COLORS.ink, 'left', MONO, '700');
    painter.text('ADULT', 16 + 92, TOP_H / 2 + 1, 11, COLORS.dim);
    painter.text(
      wallClock(hubStore.getState().clockStart, simTime),
      W - 16,
      TOP_H / 2,
      24,
      COLORS.ink,
      'right',
      MONO,
      '700',
    );

    // ---- alarm banner
    const alarms = engine.getActiveAlarms();
    const bx = 210;
    const bw = W - 210 - 190;
    const by = 8;
    const bh = TOP_H - 16;
    if (alarms.length === 0) {
      painter.text('MONITORING', bx + bw / 2, TOP_H / 2, 12, 'rgba(93,114,132,0.6)', 'center');
      return;
    }
    const top = [...alarms].sort(
      (a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || b.raisedAt - a.raisedAt,
    )[0];
    const silenced = top.silencedUntil > simTime;
    let bg = '#0e4952'; // advisory: steady cyan-dark
    let fg = '#bdeef5';
    if (!silenced && top.priority === 'crisis') {
      bg = (realT * 2) % 1 < 0.5 ? '#8f1626' : '#38070f';
      fg = '#ffe3e8';
    } else if (!silenced && top.priority === 'warning') {
      bg = (realT * 0.75) % 1 < 0.5 ? '#7d660f' : '#3d3307';
      fg = '#fdf2c0';
    } else if (silenced) {
      bg = '#1a222b';
      fg = '#93a7b8';
    }
    painter.rounded(bx, by, bw, bh, 8);
    c.fillStyle = bg;
    c.fill();
    const label = `${top.label.toUpperCase()}${alarms.length > 1 ? `  (+${alarms.length - 1})` : ''}`;
    if (silenced) {
      painter.bellCrossed(bx + 24, by + bh / 2, 12, fg);
      const remain = Math.max(0, Math.ceil(top.silencedUntil - simTime));
      const mm = Math.floor(remain / 60);
      const ss = String(remain % 60).padStart(2, '0');
      painter.text(label, bx + 44, by + bh / 2, 16, fg, 'left', MONO, '700');
      painter.text(`${mm}:${ss}`, bx + bw - 14, by + bh / 2, 16, fg, 'right', MONO, '700');
    } else {
      painter.text(label, bx + bw / 2, by + bh / 2, 17, fg, 'center', MONO, '700');
    }
  }

  function drawNumerics(
    realT: number,
    params: ReturnType<EngineHandle['getWaveformParams']>,
    vitals: ReturnType<EngineHandle['getVitals']>,
    simTime: number,
  ): void {
    const c = painter.ctx;
    const x = NUM_X;
    const wCol = W - NUM_X - 12;
    c.strokeStyle = 'rgba(120,160,190,0.12)';
    c.beginPath();
    c.moveTo(x - 8, TOP_H + 6);
    c.lineTo(x - 8, H - BOTTOM_H - 6);
    c.stroke();

    // HR
    let y = TOP_H + 18;
    painter.label('HR', x, y, 13, COLORS.ecg);
    painter.text('bpm', x + wCol, y, 11, COLORS.dim, 'right');
    const hrText =
      params.ecg.rhythm === 'asystole' || params.ecg.rhythm === 'vf'
        ? '--'
        : String(Math.round(vitals.hr));
    painter.text(hrText, x + wCol - 34, y + 48, 62, COLORS.ecg, 'right', MONO, '700');
    painter.text(RHYTHM_LABELS[vitals.rhythm], x, y + 88, 14, COLORS.ecg);

    // SpO2 + mini pleth bar
    y = TOP_H + 128;
    painter.label('SpO2', x, y, 13, COLORS.pleth);
    painter.text('%', x + wCol, y, 11, COLORS.dim, 'right');
    const spo2Text = params.pleth.present ? String(Math.round(vitals.spo2)) : '--';
    painter.text(spo2Text, x + wCol - 34, y + 38, 52, COLORS.pleth, 'right', MONO, '700');
    const barH = 58;
    const barV = plethSample(params.pleth, clock, realT, params.resp.rate);
    c.fillStyle = 'rgba(53,213,232,0.18)';
    c.fillRect(x + wCol - 20, y + 8, 9, barH);
    c.fillStyle = COLORS.pleth;
    const fillH = Math.min(1, Math.max(0, barV)) * barH;
    c.fillRect(x + wCol - 20, y + 8 + (barH - fillH), 9, fillH);

    // BP: ART when the line exists, else NIBP + staleness stamp
    y = TOP_H + 228;
    if (params.art.present) {
      painter.label('ART', x, y, 13, COLORS.art);
      painter.text('mmHg', x + wCol, y, 11, COLORS.dim, 'right');
      painter.text(
        `${Math.round(vitals.sbp)}/${Math.round(vitals.dbp)}`,
        x,
        y + 34,
        40,
        COLORS.art,
        'left',
        MONO,
        '700',
      );
      painter.text(`(${Math.round(vitals.map)})`, x + wCol, y + 36, 24, COLORS.art, 'right', MONO);
    } else {
      const nibp = lastNibp();
      painter.label('NIBP', x, y, 13, COLORS.nibp);
      painter.text('mmHg', x + wCol, y, 11, COLORS.dim, 'right');
      const sd = nibp ? `${Math.round(nibp.sbp)}/${Math.round(nibp.dbp)}` : '--/--';
      const map = nibp ? `(${Math.round(nibp.map)})` : '';
      painter.text(sd, x, y + 34, 40, COLORS.nibp, 'left', MONO, '700');
      painter.text(map, x + wCol, y + 36, 24, COLORS.nibp, 'right', MONO);
      const stamp = nibp
        ? simTime - nibp.t < 60
          ? 'JUST NOW'
          : `${Math.floor((simTime - nibp.t) / 60)} MIN AGO`
        : 'NO READING';
      painter.text(stamp, x, y + 62, 12, COLORS.dim);
    }

    // RR
    y = TOP_H + 318;
    painter.label('RR', x, y, 13, COLORS.resp);
    painter.text(String(Math.round(vitals.rr)), x + 118, y + 4, 34, COLORS.resp, 'right', MONO, '700');
    painter.text('/min', x + 126, y + 8, 11, COLORS.dim);

    // EtCO2
    if (params.capno.present && vitals.etco2 !== undefined) {
      painter.label('EtCO2', x + wCol / 2 + 8, y, 13, COLORS.capno);
      painter.text(
        String(Math.round(vitals.etco2)),
        x + wCol - 24,
        y + 4,
        34,
        COLORS.capno,
        'right',
        MONO,
        '700',
      );
    }

    // Temp + CVP
    y = TOP_H + 372;
    painter.label('TEMP', x, y, 12, COLORS.dim);
    painter.text(`${vitals.tempC.toFixed(1)}°C`, x + 60, y, 18, COLORS.ink, 'left', MONO);
    if (vitals.cvp !== undefined) {
      painter.label('CVP', x + wCol / 2 + 8, y, 12, COLORS.dim);
      painter.text(String(Math.round(vitals.cvp)), x + wCol / 2 + 58, y, 18, COLORS.ink, 'left', MONO);
    }
  }

  function drawButtons(): void {
    const y = H - BOTTOM_H + 8;
    painter.button(
      PLOT_X,
      y,
      190,
      BOTTOM_H - 16,
      'SILENCE 2 MIN',
      () => dispatch({ type: 'SilenceAllAlarms', durationS: 120 }),
      { color: '#a9c2d6' },
    );
    painter.button(
      PLOT_X + 204,
      y,
      170,
      BOTTOM_H - 16,
      'NIBP NOW',
      () => dispatch({ type: 'CycleNibp' }),
      { color: COLORS.nibp, glyph: 'play' },
    );
  }

  return {
    device: 'monitor',
    canvas: painter.canvas,
    update(realTimeS: number): void {
      if (painter.due(realTimeS)) draw(realTimeS);
    },
    click(x: number, y: number): void {
      painter.click(x, y);
    },
  };
}
