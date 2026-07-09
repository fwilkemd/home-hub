/**
 * Ultrasound machine screen (SPEC §8) — the headline feature. Composites the
 * procedural renderer (us-views + us-speckle) inside a sector clip, applies
 * window-quality degradation and the depth/gain knobs, and draws the machine
 * chrome (view label, FROZEN badge, freeze/save/depth/gain buttons).
 * Procedural mode renders a linear-probe rectangle with vessel targets and a
 * needle overlay driven by the running procedure's step progress.
 */
import type { DeviceScreenInstance, EngineHandle } from '../contracts/runtime';
import { US_VIEW_LABELS } from '../contracts/ids';
import { BeatClock, breathPhase, clamp, gauss, valueNoiseC } from '../engine/waveforms';
import { dispatch } from '../bridge/session';
import { hubActions, hubStore } from '../bridge/store';
import { MONO, ScreenPainter } from './device-screen';
import {
  ctx2d,
  fanPath,
  makeSpeckleTiles,
  nearFieldHaze,
  radialGain,
  specklePass,
} from './us-speckle';
import { drawProcedural, drawView, defaultFindingsFor, type UsDraw } from './us-views';

const W = 896;
const H = 672;
const TOP_H = 42;
const BTN_H = 58;
const AX = W / 2;
const AY = TOP_H + 12;
const FAN_R = H - BTN_H - 10 - AY;
const HALF_ANGLE = 0.62;
const INK = '#d5dee6';
const DIM = '#5d6f7c';

export function createUsScreen(engine: EngineHandle): DeviceScreenInstance {
  const painter = new ScreenPainter('us_machine', W, H, 30);
  const scene = document.createElement('canvas');
  scene.width = W;
  scene.height = H;
  const sctx = ctx2d(scene);
  const low = document.createElement('canvas'); // downscale buffer for blur
  low.width = Math.floor(W / 3);
  low.height = Math.floor(H / 3);
  const lctx = ctx2d(low);
  const tiles = makeSpeckleTiles(engine.scenario.seed);
  const clock = new BeatClock(engine.getWaveformParams().beatSeed);

  let animT = 0; // frozen-aware animation time base
  let lastReal: number | null = null;
  let renderedKey = ''; // what the scene canvas currently shows

  function depthCm(depth: number, procedural: boolean): number {
    return procedural ? 2 + 2 * depth : 6 * depth;
  }

  /** Needle/wire state derived from whatever procedure runtime exists. */
  function proceduralState(): { needleDepth01: number; wobblePx: number; wireIn: boolean } {
    const proc = hubStore.getState().procedure;
    if (!proc) return { needleDepth01: 0.15, wobblePx: 1, wireIn: false };
    const frac = proc.stepIndex / Math.max(1, proc.steps.length - 1);
    const active = proc.steps[proc.stepIndex];
    const holding = !!active && active.status !== 'done' && active.interaction.includes('hold');
    const wobblePx = holding
      ? 2.4 * Math.sin(animT * 3.1) + 1.6 * valueNoiseC(clock.seed ^ 0x6f, animT * 1.7)
      : 0.8 * valueNoiseC(clock.seed ^ 0x6f, animT * 0.9);
    const wireIn = proc.steps.some(
      (s) =>
        s.status === 'done' &&
        (s.id.toLowerCase().includes('wire') || s.prompt.toLowerCase().includes('wire')),
    );
    return { needleDepth01: clamp(0.12 + frac * 1.05, 0, 1), wobblePx, wireIn };
  }

  function renderScene(procedural: boolean): void {
    const us = hubStore.getState().us;
    const params = engine.getWaveformParams();
    const patient = engine.getPatient();
    const view = us.activeView;
    const q = clamp(us.quality, 0, 1);
    const dCm = depthCm(us.depth, procedural);
    const pxPerCm = FAN_R / dCm;

    clock.update({ rhythm: params.ecg.rhythm, rate: params.ecg.rate }, animT);
    const beat = clock.phaseAt(animT);
    const pulse = beat.inBeat ? gauss(beat.phase, 0.32, 0.16) : 0;

    sctx.save();
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, W, H);
    // tissue base so the field is never dead black
    const base = sctx.createLinearGradient(0, AY, 0, AY + FAN_R);
    base.addColorStop(0, '#232323');
    base.addColorStop(1, '#181818');
    sctx.fillStyle = base;
    sctx.fillRect(0, 0, W, H);

    const d: UsDraw = {
      ctx: sctx,
      apexX: AX,
      apexY: AY,
      pxPerCm,
      fanR: FAN_R,
      halfAngle: HALF_ANGLE,
      t: animT,
      seed: engine.scenario.seed,
      pulse,
      respPhase: breathPhase(params.resp.rate, animT),
    };
    if (procedural) {
      drawProcedural(d, proceduralState());
    } else if (view) {
      drawView(d, view, patient.us[view] ?? defaultFindingsFor(view));
    }

    // animated speckle: fine multiplicative grain + coarse drift + an additive
    // shimmer that keeps even the dark field alive
    specklePass(sctx, tiles[0], 1.45, animT * 4.2, animT * 2.4, W, H, 1);
    specklePass(sctx, tiles[1], 2.5, -animT * 3.1, animT * 5.0, W, H, 0.5);
    specklePass(sctx, tiles[0], 1.1, -animT * 6.0, animT * 7.5, W, H, 0.075, 'lighter');
    if (q < 0.85) specklePass(sctx, tiles[2], 2.0, animT * 6.5, -animT * 3.7, W, H, (0.85 - q) * 0.8);

    radialGain(sctx, AX, AY, FAN_R, clamp(us.gain, 0, 1), W, H);
    nearFieldHaze(sctx, AX, AY, FAN_R);

    // window-quality degradation: contrast washout + blur via downscale
    if (q < 0.95) {
      sctx.fillStyle = `rgba(128,128,128,${(1 - q) * 0.3})`;
      sctx.fillRect(0, 0, W, H);
      const s = clamp(0.3 + 0.7 * q, 0.3, 1);
      const lw = Math.max(8, Math.floor(low.width * s));
      const lh = Math.max(8, Math.floor(low.height * s));
      lctx.clearRect(0, 0, low.width, low.height);
      lctx.drawImage(scene, 0, 0, lw, lh);
      sctx.imageSmoothingEnabled = true;
      sctx.globalAlpha = (1 - q) * 0.85;
      sctx.drawImage(low, 0, 0, lw, lh, 0, 0, W, H);
      sctx.globalAlpha = 1;
    }
    sctx.restore();
  }

  function draw(realTimeS: number): void {
    const c = painter.ctx;
    const us = hubStore.getState().us;
    const procedural = us.mode === 'procedural';
    const hasImage = procedural || !!us.activeView;
    painter.clearRegions();

    const dt = lastReal === null ? 0 : Math.min(0.25, realTimeS - lastReal);
    lastReal = realTimeS;
    if (!us.frozen) animT += dt; // freeze stops the animation time base

    c.fillStyle = '#05070a';
    c.fillRect(0, 0, W, H);

    if (hasImage) {
      const key = `${us.mode}|${us.activeView}|${us.depth}|${us.gain}|${Math.round(us.quality * 40)}`;
      if (!us.frozen || key !== renderedKey) {
        renderScene(procedural);
        renderedKey = key;
      }
      c.save();
      if (procedural) {
        painter.rounded(AX - 320, AY, 640, FAN_R, 6);
        c.clip();
      } else {
        fanPath(c, AX, AY, 16, FAN_R, HALF_ANGLE);
        c.clip();
      }
      c.drawImage(scene, 0, 0);
      c.restore();
      // sector outline + depth ruler
      c.strokeStyle = 'rgba(210,225,235,0.10)';
      c.lineWidth = 1;
      if (procedural) {
        painter.rounded(AX - 320.5, AY + 0.5, 641, FAN_R - 1, 6);
        c.stroke();
      } else {
        fanPath(c, AX, AY, 16, FAN_R, HALF_ANGLE);
        c.stroke();
      }
      const dCm = depthCm(us.depth, procedural);
      const pxPerCm = FAN_R / dCm;
      for (let cm = 2; cm <= dCm; cm += 2) {
        const r = cm * pxPerCm;
        const tx = procedural ? AX + 328 : AX + Math.sin(HALF_ANGLE) * r + 10;
        const ty = procedural ? AY + r : AY + Math.cos(HALF_ANGLE) * r;
        if (ty > H - BTN_H - 14) break;
        c.fillStyle = 'rgba(210,225,235,0.4)';
        c.fillRect(tx, ty - 1, 5, 2);
        if (cm % 4 === 0) painter.text(String(cm), tx + 9, ty, 10, DIM);
      }
    } else {
      drawIdle();
    }

    drawChrome(us, procedural, hasImage);
  }

  function drawIdle(): void {
    const c = painter.ctx;
    c.strokeStyle = 'rgba(213,222,230,0.14)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(AX, H / 2 - 40, 74, 0.65 * Math.PI, 2.35 * Math.PI);
    c.stroke();
    painter.text('NF-500', AX, H / 2 - 40, 34, 'rgba(213,222,230,0.6)', 'center', MONO, '700');
    painter.text('SELECT WINDOW', AX, H / 2 + 64, 16, DIM, 'center');
    painter.text('place probe on patient', AX, H / 2 + 90, 13, 'rgba(93,111,124,0.7)', 'center');
  }

  function drawChrome(
    us: ReturnType<typeof hubStore.getState>['us'],
    procedural: boolean,
    hasImage: boolean,
  ): void {
    const c = painter.ctx;
    c.fillStyle = '#0a0e13';
    c.fillRect(0, 0, W, TOP_H);
    c.strokeStyle = 'rgba(210,225,235,0.12)';
    c.beginPath();
    c.moveTo(0, TOP_H - 0.5);
    c.lineTo(W, TOP_H - 0.5);
    c.stroke();
    painter.text('NF-500', 14, TOP_H / 2, 15, INK, 'left', MONO, '700');
    const label = procedural
      ? 'PROCEDURE — LINEAR'
      : us.activeView
        ? US_VIEW_LABELS[us.activeView].toUpperCase()
        : 'NO WINDOW';
    painter.text(label, AX, TOP_H / 2, 16, hasImage ? '#a8d8ea' : DIM, 'center', MONO, '700');
    const gainDb = Math.round((us.gain - 0.5) * 40);
    painter.text(
      `D ${depthCm(us.depth, procedural).toFixed(0)}cm  G ${gainDb >= 0 ? '+' : ''}${gainDb}dB  MI 0.8  TIS 0.4`,
      W - 14,
      TOP_H / 2,
      12,
      DIM,
      'right',
    );
    if (us.frozen) {
      painter.chip(W - 108, TOP_H + 10, 94, 26, 'FROZEN', '#101418', '#ffb64a');
    }

    // bottom controls
    const y = H - BTN_H + 8;
    const bh = BTN_H - 16;
    painter.button(
      12,
      y,
      140,
      bh,
      us.frozen ? 'UNFREEZE' : 'FREEZE',
      () => {
        const frozen = !hubStore.getState().us.frozen;
        hubActions.setUs({ frozen });
        dispatch({ type: 'UsFreeze', frozen });
      },
      { active: us.frozen, color: '#ffcf87', disabled: !hasImage },
    );
    painter.button(
      164,
      y,
      140,
      bh,
      'SAVE CLIP',
      () => {
        const view = hubStore.getState().us.activeView;
        if (!view) return;
        dispatch({ type: 'UsSaveClip', view, dataUrl: painter.canvas.toDataURL('image/png') });
      },
      { color: '#9fd8ef', disabled: !us.activeView },
    );
    painter.label('DEPTH', 342, y + bh / 2, 12, DIM);
    painter.button(408, y, 52, bh, '', () => hubActions.setUs({ depth: clamp(hubStore.getState().us.depth - 0.5, 1, 3) }), { glyph: 'minus', color: INK });
    painter.button(466, y, 52, bh, '', () => hubActions.setUs({ depth: clamp(hubStore.getState().us.depth + 0.5, 1, 3) }), { glyph: 'plus', color: INK });
    painter.label('GAIN', 566, y + bh / 2, 12, DIM);
    painter.button(622, y, 52, bh, '', () => hubActions.setUs({ gain: clamp(hubStore.getState().us.gain - 0.1, 0, 1) }), { glyph: 'minus', color: INK });
    painter.button(680, y, 52, bh, '', () => hubActions.setUs({ gain: clamp(hubStore.getState().us.gain + 0.1, 0, 1) }), { glyph: 'plus', color: INK });
    // gain meter
    const mx = 746;
    c.fillStyle = 'rgba(255,255,255,0.10)';
    c.fillRect(mx, y + bh / 2 - 4, 130, 8);
    c.fillStyle = '#9fd8ef';
    c.fillRect(mx, y + bh / 2 - 4, 130 * us.gain, 8);
  }

  return {
    device: 'us_machine',
    canvas: painter.canvas,
    update(realTimeS: number): void {
      if (painter.due(realTimeS)) draw(realTimeS);
    },
    click(x: number, y: number): void {
      painter.click(x, y);
    },
  };
}
