/**
 * First-person laryngoscope view (SPEC §9.3): a procedural 2D airway image —
 * oropharynx walls, tongue under the blade, epiglottis, the cord "V" with the
 * dark glottic triangle, and an ETT sliding in from the right whose tip
 * follows tubeDepth 0..1 (~1 = through the cords).
 *
 * Standalone painter, deliberately NOT part of ScreensHandle: the procedure
 * overlay host creates one lazily per procedure and pumps update() from its
 * own rAF blit loop. Self-throttles to 30 fps like the device screens.
 *
 * TODO(MEDICAL): geometry is impressionistic and the view grade comes from
 * `physiology.airwayGrade` (1 full cords / 2 posterior half / 3 epiglottis
 * only) — a placeholder scalar until the medical pass defines real airway
 * difficulty modeling.
 */
import type { EngineHandle } from '../contracts/runtime';
import { clamp } from '../engine/waveforms';
import { hash01 } from '../engine/rng';
import { ctx2d, makeSpeckleTiles, specklePass } from './us-speckle';

export const LARYNGOSCOPY_W = 896;
export const LARYNGOSCOPY_H = 600;

export interface LaryngoscopyPainter {
  canvas: HTMLCanvasElement;
  update(realTimeS: number): void;
  setTubeDepth(v01: number): void;
  getTubeDepth(): number;
}

const W = LARYNGOSCOPY_W;
const H = LARYNGOSCOPY_H;
const CX = W / 2;

/** Tube path: enters bottom-right, curves to the glottic target. */
const TUBE_P0 = { x: W + 40, y: 512 };
const TUBE_C = { x: CX + 262, y: 458 };
/** Depth at which the tip reaches the glottis plane (rest of the travel is "through"). */
const PASS_DEPTH = 0.6;

function smoothstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

export function createLaryngoscopyPainter(engine: EngineHandle): LaryngoscopyPainter {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = ctx2d(canvas);
  const seed = engine.scenario.seed ^ 0x1a5f;
  const tiles = makeSpeckleTiles(seed);

  let tubeDepth = 0.12;
  let animT = 0;
  let lastReal: number | null = null;
  let lastDraw = -Infinity;

  const bez = (t: number, target: { x: number; y: number }): { x: number; y: number } => {
    const u = 1 - t;
    return {
      x: u * u * TUBE_P0.x + 2 * u * t * TUBE_C.x + t * t * target.x,
      y: u * u * TUBE_P0.y + 2 * u * t * TUBE_C.y + t * t * target.y,
    };
  };

  function drawTube(target: { x: number; y: number }): void {
    if (tubeDepth < 0.02) return;
    const through = clamp((tubeDepth - PASS_DEPTH) / (1 - PASS_DEPTH), 0, 1);
    const tipT = tubeDepth < PASS_DEPTH ? 0.1 + (tubeDepth / PASS_DEPTH) * 0.9 : 1;
    const path = (fromT: number, toT: number): void => {
      c.beginPath();
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const p = bez(fromT + ((toT - fromT) * i) / n, target);
        if (i === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      }
    };
    c.save();
    c.lineCap = 'round';
    // shaft + a light core so the PVC reads as a cylinder
    path(0, tipT);
    c.strokeStyle = '#e9ece9';
    c.lineWidth = 30;
    c.stroke();
    path(0, tipT);
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 12;
    c.stroke();
    // through the cords: a stub sinks into the dark triangle
    if (through > 0) {
      const tip = bez(1, target);
      c.fillStyle = `rgba(214,220,214,${0.5 * (1 - through * 0.7)})`;
      c.beginPath();
      c.ellipse(tip.x, tip.y + 10 + through * 16, 15, 9 + through * 5, 0, 0, Math.PI * 2);
      c.fill();
    }
    // black depth marks slide toward the cords as the tube advances.
    // TODO(MEDICAL): mark spacing/cm labels are decorative placeholders.
    const shift = through * 0.4;
    for (let k = 0; k < 4; k++) {
      const band = k === 2; // the wide "cord marker" band
      const mt = tipT - 0.085 * (k + 1) + shift;
      if (mt <= 0.04 || mt >= 0.985) continue;
      const p = bez(mt, target);
      const q = bez(mt + 0.01, target);
      const ang = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
      c.strokeStyle = 'rgba(20,20,22,0.9)';
      c.lineWidth = band ? 9 : 3.5;
      c.beginPath();
      c.moveTo(p.x - Math.cos(ang) * 14, p.y - Math.sin(ang) * 14);
      c.lineTo(p.x + Math.cos(ang) * 14, p.y + Math.sin(ang) * 14);
      c.stroke();
    }
    // bevel + murphy eye near the tip
    if (tipT > 0.2 && through < 0.6) {
      const p = bez(tipT - 0.015, target);
      c.fillStyle = 'rgba(30,30,34,0.55)';
      c.beginPath();
      c.ellipse(p.x - 5, p.y - 7, 4.5, 2.8, 0.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function draw(): void {
    // grade + breathing from the live engine (deterministic aside from state)
    const grade = Math.round(clamp(engine.getPatient().physiology.airwayGrade ?? 1, 1, 3));
    const bp = clamp(engine.getBreathPhase(), 0, 1);
    const insp = bp < 0.35 ? smoothstep(bp / 0.35) : 1 - smoothstep((bp - 0.35) / 0.65);
    const dy = insp * 5 - 2.5; // gentle laryngeal rise with the breath
    const open = 0.4 + 0.6 * insp; // cords abduct on inspiration

    // ---- posterior pharynx backdrop
    const bg = c.createRadialGradient(CX, 320, 40, CX, 320, 520);
    bg.addColorStop(0, '#221012');
    bg.addColorStop(0.55, '#4c262b');
    bg.addColorStop(1, '#67343a');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    // piriform pockets flanking the inlet
    for (const s of [-1, 1]) {
      c.fillStyle = 'rgba(18,7,8,0.55)';
      c.beginPath();
      c.ellipse(CX + s * 178, 372 + dy, 66, 108, s * 0.28, 0, Math.PI * 2);
      c.fill();
    }

    // ---- laryngeal inlet: vestibule shadow, glottis, cords, arytenoids
    const apexY = 238 + dy;
    const postY = 412 + dy;
    const tubeSpread = 14 * smoothstep((tubeDepth - 0.52) / 0.18);
    const half = 56 + 26 * open + tubeSpread;
    const target = { x: CX + 4, y: apexY + (postY - apexY) * 0.62 };

    const vest = c.createRadialGradient(CX, (apexY + postY) / 2, 20, CX, (apexY + postY) / 2, 240);
    vest.addColorStop(0, 'rgba(30,12,13,0.85)');
    vest.addColorStop(1, 'rgba(30,12,13,0)');
    c.fillStyle = vest;
    c.fillRect(0, 0, W, H);

    // false cords (dim pink, lateral)
    c.lineCap = 'round';
    for (const s of [-1, 1]) {
      c.strokeStyle = '#b57a76';
      c.lineWidth = 27;
      c.beginPath();
      c.moveTo(CX + s * 10, apexY - 6);
      c.lineTo(CX + s * (half + 27), postY - 4);
      c.stroke();
    }
    // glottic triangle (the dark way in)
    c.fillStyle = '#070304';
    c.beginPath();
    c.moveTo(CX, apexY);
    c.lineTo(CX - half * 0.84, postY);
    c.quadraticCurveTo(CX, postY + 14, CX + half * 0.84, postY);
    c.closePath();
    c.fill();
    // faint tracheal rings deep in the lumen
    if (tubeDepth < PASS_DEPTH) {
      c.strokeStyle = 'rgba(190,170,165,0.14)';
      c.lineWidth = 5;
      for (let i = 0; i < 2; i++) {
        const ry = apexY + (postY - apexY) * (0.58 + i * 0.2);
        const rw = half * (0.34 + i * 0.16);
        c.beginPath();
        c.arc(CX, ry + 26, rw, Math.PI * 1.15, Math.PI * 1.85);
        c.stroke();
      }
    }
    // true cords: the pale V
    for (const s of [-1, 1]) {
      c.strokeStyle = '#e9d8cd';
      c.lineWidth = 22;
      c.beginPath();
      c.moveTo(CX + s * 3, apexY + 2);
      c.lineTo(CX + s * half, postY);
      c.stroke();
      c.strokeStyle = 'rgba(250,242,235,0.9)';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(CX + s * 2, apexY + 4);
      c.lineTo(CX + s * (half - 9), postY - 2);
      c.stroke();
    }
    // arytenoid mounds (posterior)
    for (const s of [-1, 1]) {
      c.fillStyle = '#cb9184';
      c.beginPath();
      c.ellipse(CX + s * (half + 4), postY + 17, 34, 21, s * 0.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,235,225,0.18)';
      c.beginPath();
      c.ellipse(CX + s * (half + 1), postY + 11, 16, 8, s * 0.2, 0, Math.PI * 2);
      c.fill();
    }

    // ---- ETT (under the epiglottis flap so a covering flap occludes it)
    drawTube(target);

    // ---- epiglottis: grade sets how far the flap hangs over the view
    const epiY = grade === 1 ? 152 + dy : grade === 2 ? 272 + dy : 400 + dy;
    const flap = c.createLinearGradient(0, epiY - 170, 0, epiY + 8);
    flap.addColorStop(0, '#b97f6e');
    flap.addColorStop(1, '#e2b39c');
    c.fillStyle = flap;
    c.beginPath();
    c.moveTo(CX - 216, epiY - 138);
    c.quadraticCurveTo(CX, epiY - 186, CX + 216, epiY - 138);
    c.lineTo(CX + 188, epiY - 26);
    c.quadraticCurveTo(CX, epiY + 10, CX - 188, epiY - 26);
    c.closePath();
    c.fill();
    // lit free margin + soft shadow it casts on whatever is below
    c.strokeStyle = 'rgba(245,214,190,0.85)';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(CX - 188, epiY - 26);
    c.quadraticCurveTo(CX, epiY + 10, CX + 188, epiY - 26);
    c.stroke();
    const shade = c.createLinearGradient(0, epiY + 2, 0, epiY + 56);
    shade.addColorStop(0, 'rgba(0,0,0,0.42)');
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = shade;
    c.beginPath();
    c.moveTo(CX - 188, epiY - 24);
    c.quadraticCurveTo(CX, epiY + 12, CX + 188, epiY - 24);
    c.lineTo(CX + 188, epiY + 62);
    c.lineTo(CX - 188, epiY + 62);
    c.closePath();
    c.fill();

    // ---- tongue mass along the bottom, blade pressing into it
    const tongue = c.createLinearGradient(0, 380, 0, H);
    tongue.addColorStop(0, '#b06a70');
    tongue.addColorStop(1, '#7e414c');
    c.fillStyle = tongue;
    c.beginPath();
    c.moveTo(-20, H + 20);
    c.lineTo(-20, 452);
    c.quadraticCurveTo(220, 352, 452, 462);
    c.quadraticCurveTo(660, 552, W + 20, 512);
    c.lineTo(W + 20, H + 20);
    c.closePath();
    c.fill();
    c.strokeStyle = '#b8bfc7';
    c.lineWidth = 24;
    c.beginPath();
    c.arc(298, 792, 342, -1.82, -1.18);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(298, 792, 352, -1.78, -1.24);
    c.stroke();

    // ---- moisture glints (deterministic), speckle, scope light, vignette
    for (let i = 0; i < 7; i++) {
      const gx = W * (0.12 + 0.76 * hash01(seed, 90 + i));
      const gy = H * (0.1 + 0.55 * hash01(seed, 140 + i));
      const tw = 0.5 + 0.5 * Math.sin(animT * (1.1 + hash01(seed, 190 + i)) + i * 2.2);
      c.fillStyle = `rgba(255,240,235,${0.05 + 0.1 * tw})`;
      c.beginPath();
      c.ellipse(gx, gy, 10 + 8 * hash01(seed, 240 + i), 4, hash01(seed, 290 + i) * 3, 0, Math.PI * 2);
      c.fill();
    }
    specklePass(c, tiles[1], 2.2, animT * 1.6, animT * 1.1, W, H, 0.16);
    specklePass(c, tiles[0], 1.3, -animT * 2.2, animT * 2.8, W, H, 0.05, 'lighter');
    const light = c.createRadialGradient(CX, 300, 10, CX, 300, 300);
    light.addColorStop(0, 'rgba(255,246,235,0.12)');
    light.addColorStop(1, 'rgba(255,246,235,0)');
    c.save();
    c.globalCompositeOperation = 'screen';
    c.fillStyle = light;
    c.fillRect(0, 0, W, H);
    c.restore();
    const vig = c.createRadialGradient(CX, 305, 150, CX, 305, 500);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.72, 'rgba(0,0,0,0.28)');
    vig.addColorStop(1, 'rgba(0,0,0,0.82)');
    c.fillStyle = vig;
    c.fillRect(0, 0, W, H);
  }

  return {
    canvas,
    update(realTimeS: number): void {
      if (realTimeS - lastDraw < 1 / 30) return; // 30 fps throttle
      lastDraw = realTimeS;
      const dt = lastReal === null ? 0 : Math.min(0.25, realTimeS - lastReal);
      lastReal = realTimeS;
      animT += dt;
      draw();
    },
    setTubeDepth(v01: number): void {
      tubeDepth = clamp(v01, 0, 1);
    },
    getTubeDepth: () => tubeDepth,
  };
}
