/**
 * Ultrasound structure painters (SPEC §8.2) — parametric grayscale primitives
 * per UsViewId, bound to USFindings and animated (beat-synced contraction,
 * respiratory motion, lung sliding, B-line sway). Everything is drawn in cm
 * from the fan apex so the depth knob rescales anatomy for free.
 *
 * TODO(MEDICAL): all geometry is impressionistic — shapes/sizes/motion are
 * tuned so each view "reads", not for anatomic fidelity.
 */
import type { UsViewId } from '../contracts/ids';
import type {
  USAbdFindings,
  USCardiacFindings,
  USFindings,
  USIvcFindings,
  USLungFindings,
} from '../contracts/patient';
import { hash01 } from '../engine/rng';
import { clamp, lerp, valueNoiseC } from '../engine/waveforms';

const TWO_PI = Math.PI * 2;

export interface UsDraw {
  ctx: CanvasRenderingContext2D;
  apexX: number;
  apexY: number;
  pxPerCm: number;
  fanR: number;
  halfAngle: number;
  t: number;
  seed: number;
  /** 0..1 systolic contraction envelope, beat-synced with the monitor. */
  pulse: number;
  /** 0..1 breath phase (0 = inspiration onset). */
  respPhase: number;
}

const gray = (v: number, a = 1): string => {
  const b = Math.round(255 * clamp(v, 0, 1));
  return `rgba(${b},${b},${b},${a})`;
};

function ell(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot = 0,
): void {
  c.beginPath();
  c.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), rot, 0, TWO_PI);
}

/** Cardiac chamber: bright speckled wall + anechoic cavity. */
function chamber(
  d: UsDraw,
  xCm: number,
  yCm: number,
  rxCm: number,
  ryCm: number,
  rot: number,
  wallCm: number,
  wallBright: number,
): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const wall = wallCm * k * (1 + 0.45 * d.pulse); // systolic wall thickening
  const x = d.apexX + xCm * k;
  const y = d.apexY + yCm * k;
  ell(c, x, y, rxCm * k + wall, ryCm * k + wall, rot);
  c.fillStyle = gray(wallBright);
  c.fill();
  ell(c, x, y, rxCm * k, ryCm * k, rot);
  c.fillStyle = '#060606';
  c.fill();
}

// ================================================================ cardiac
function contractionScale(f: USCardiacFindings, pulse: number): number {
  return 1 - (0.06 + 0.32 * clamp(f.contractility, 0, 1)) * pulse;
}

/** Pericardium + anechoic effusion rim around a heart bundle. */
function pericardium(d: UsDraw, xCm: number, yCm: number, rxCm: number, ryCm: number, rot: number, effusion: number): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const rim = effusion * 1.1 * k;
  const x = d.apexX + xCm * k;
  const y = d.apexY + yCm * k;
  ell(c, x, y, rxCm * k + rim + 0.14 * k, ryCm * k + rim + 0.14 * k, rot);
  c.fillStyle = gray(0.82);
  c.fill();
  if (rim > 0.5) {
    ell(c, x, y, rxCm * k + rim, ryCm * k + rim, rot);
    c.fillStyle = '#020202';
    c.fill();
  }
  ell(c, x, y, rxCm * k, ryCm * k, rot);
  c.fillStyle = gray(0.34);
  c.fill();
}

function drawPlax(d: UsDraw, f: USCardiacFindings): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const s = contractionScale(f, d.pulse);
  const sway = 0.1 * Math.sin(TWO_PI * d.respPhase);
  c.save();
  c.translate(sway * k, 0);
  pericardium(d, 0.2, 6.2, 4.6, 3.1, -0.1, f.effusion);
  chamber(d, -0.5, 4.0, 1.9 * f.rvScale, 0.8 * f.rvScale, -0.16, 0.24, 0.62); // RV
  // aorta / LVOT corridor
  c.save();
  const a = { x: d.apexX + 1.5 * k, y: d.apexY + 5.1 * k };
  c.translate(a.x, a.y);
  c.rotate(-0.12);
  c.fillStyle = gray(0.8);
  c.fillRect(0, -0.75 * k, 2.6 * k, 1.5 * k);
  c.fillStyle = '#070707';
  c.fillRect(0, -0.48 * k, 2.6 * k, 0.96 * k);
  c.restore();
  chamber(d, -0.9, 6.5, 2.55 * f.lvScale * s, 1.5 * f.lvScale * s, -0.12, 0.5, 0.78); // LV
  chamber(d, 2.6, 7.5, 1.35, 1.15, 0.25, 0.24, 0.68); // LA
  // mitral leaflet flicks open in diastole
  const open = (1 - d.pulse) * (0.55 + 0.45 * Math.sin(TWO_PI * d.t * 1.3));
  const mx = d.apexX + 1.15 * k;
  const my = d.apexY + 6.35 * k;
  c.strokeStyle = gray(0.92);
  c.lineWidth = 0.09 * k;
  c.beginPath();
  c.moveTo(mx, my);
  c.lineTo(mx - 1.15 * k * Math.cos(0.35 + open * 0.9), my + 1.15 * k * Math.sin(0.35 + open * 0.9));
  c.stroke();
  c.restore();
}

function drawPsax(d: UsDraw, f: USCardiacFindings): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const s = contractionScale(f, d.pulse);
  pericardium(d, 0, 6.0, 3.3, 3.0, 0, f.effusion);
  chamber(d, -2.4, 4.9, 1.7 * f.rvScale, 0.95 * f.rvScale, 0.55, 0.22, 0.58); // RV crescent
  const cav = 1.5 * f.lvScale * s;
  chamber(d, 0.2, 6.1, cav, cav * 0.96, 0, 0.72, 0.8); // LV donut
  // papillary muscles
  c.fillStyle = gray(0.75);
  for (const ang of [2.3, 0.85]) {
    const px = d.apexX + (0.2 + Math.cos(ang) * cav * 0.62) * k;
    const py = d.apexY + (6.1 + Math.sin(ang) * cav * 0.62) * k;
    ell(c, px, py, 0.3 * k, 0.24 * k, ang);
    c.fill();
  }
}

/** Shared 4-chamber bundle (a4c upright, subxiphoid tilted). */
function fourChambers(d: UsDraw, cx: number, cy: number, rot: number, f: USCardiacFindings): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const s = contractionScale(f, d.pulse);
  c.save();
  c.translate(d.apexX + cx * k, d.apexY + cy * k);
  c.rotate(rot);
  c.translate(-d.apexX, -d.apexY);
  pericardium(d, 0.1, 5.6, 3.2, 3.6, 0, f.effusion);
  const dv = 0.32 * d.pulse; // annular plane excursion toward the apex
  chamber(d, 1.15, 4.1 + dv * 0.4, 1.25 * f.lvScale * s, 1.85 * f.lvScale * s, 0.05, 0.42, 0.78); // LV
  chamber(d, -1.2, 4.15 + dv * 0.4, 1.0 * f.rvScale * s, 1.55 * f.rvScale * s, -0.05, 0.26, 0.6); // RV
  chamber(d, 1.1, 7.4 - dv, 1.15, 1.2, 0, 0.22, 0.66); // LA
  chamber(d, -1.05, 7.35 - dv, 1.0, 1.1, 0, 0.22, 0.62); // RA
  // septum + AV plane
  c.fillStyle = gray(0.85);
  c.fillRect(d.apexX - 0.14 * k, d.apexY + 2.6 * k, 0.28 * k, 3.6 * k);
  c.fillRect(d.apexX - 2.2 * k, d.apexY + (6.05 - dv) * k, 4.5 * k, 0.2 * k);
  c.restore();
}

function drawA4c(d: UsDraw, f: USCardiacFindings): void {
  fourChambers(d, 0, 0, 0, f);
}

function drawSubxiphoid(d: UsDraw, f: USCardiacFindings): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  // liver wedge between probe and heart
  c.fillStyle = gray(0.42);
  c.beginPath();
  c.moveTo(d.apexX - 4.2 * k, d.apexY + 0.4 * k);
  c.quadraticCurveTo(d.apexX - 1 * k, d.apexY + 2.6 * k, d.apexX + 2.4 * k, d.apexY + 3.4 * k);
  c.lineTo(d.apexX + 4.6 * k, d.apexY + 0.4 * k);
  c.closePath();
  c.fill();
  fourChambers(d, 0.9, 1.6, -0.62, f);
}

// ================================================================ ivc
function drawIvc(d: UsDraw, f: USIvcFindings): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  // liver parenchyma above
  c.fillStyle = gray(0.44);
  c.fillRect(d.apexX - 5.5 * k, d.apexY + 0.5 * k, 11 * k, 4.4 * k);
  // sniff collapse during inspiration
  const insp = Math.pow(Math.sin(Math.PI * clamp(d.respPhase / 0.4, 0, 1)), 2);
  const dia = Math.max(0.15, f.diameterCm * (1 - clamp(f.collapse, 0, 1) * insp));
  const cy = d.apexY + 5.4 * k;
  const wobble = (x: number): number => 0.1 * k * valueNoiseC(d.seed ^ 0x77, x * 0.02 + d.t * 0.15);
  c.fillStyle = '#040404';
  c.beginPath();
  const x0 = d.apexX - 4.6 * k;
  const x1 = d.apexX + 4.6 * k;
  c.moveTo(x0, cy - (dia / 2) * k + wobble(x0));
  for (let x = x0; x <= x1; x += 14) c.lineTo(x, cy - (dia / 2) * k + wobble(x));
  for (let x = x1; x >= x0; x -= 14) c.lineTo(x, cy + (dia / 2) * k + wobble(x + 999));
  c.closePath();
  c.fill();
  c.strokeStyle = gray(0.72);
  c.lineWidth = 0.1 * k;
  c.stroke();
  // hepatic vein joining from above + RA at the right end
  c.strokeStyle = gray(0.55);
  c.lineWidth = 0.28 * k;
  c.beginPath();
  c.moveTo(d.apexX - 2.6 * k, d.apexY + 3.2 * k);
  c.lineTo(d.apexX - 1.4 * k, cy - (dia / 2) * k);
  c.stroke();
  ell(c, d.apexX + 4.9 * k, cy - 0.3 * k, 1.3 * k, 1.05 * k, -0.4);
  c.fillStyle = '#050505';
  c.fill();
}

// ================================================================ lung
function drawLung(d: UsDraw, f: USLungFindings, posterior: boolean): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const yP = 3.2; // pleural depth cm
  const rP = yP * k;
  const a0 = Math.PI / 2 - d.halfAngle * 0.9;
  const a1 = Math.PI / 2 + d.halfAngle * 0.9;
  // soft-tissue layers
  for (const [depth, b] of [
    [1.1, 0.5],
    [2.1, 0.42],
  ] as const) {
    c.strokeStyle = gray(b, 0.8);
    c.lineWidth = 0.32 * k;
    c.beginPath();
    c.arc(d.apexX, d.apexY, depth * k, a0, a1);
    c.stroke();
  }
  const effusion = clamp(f.effusion, 0, 1);
  const showALines = f.bLines < 0.5 && effusion < 0.2;
  // A-lines: dim pleural echoes at multiples of the pleural depth
  if (showALines) {
    for (let m = 2; m <= 4; m++) {
      if (m * rP > d.fanR) break;
      c.strokeStyle = gray(0.8, 0.34 / (m - 1));
      c.lineWidth = 0.14 * k;
      c.beginPath();
      c.arc(d.apexX, d.apexY, m * rP, Math.PI / 2 - d.halfAngle * 0.45, Math.PI / 2 + d.halfAngle * 0.45);
      c.stroke();
    }
  }
  // pleural line
  c.save();
  c.shadowColor = '#ffffff';
  c.shadowBlur = 6;
  c.strokeStyle = gray(0.95);
  c.lineWidth = 0.16 * k;
  c.beginPath();
  c.arc(d.apexX, d.apexY, rP, a0 + 0.12, a1 - 0.12);
  c.stroke();
  c.restore();
  // sliding shimmer: specks translating along the line when sliding
  for (let i = 0; i < 26; i++) {
    const base = hash01(d.seed, 300 + i);
    const u = f.sliding ? (base + d.t * 0.045) % 1 : base;
    const ang = Math.PI / 2 + (u - 0.5) * 2 * (d.halfAngle * 0.82);
    const rr = rP + (hash01(d.seed, 330 + i) - 0.5) * 0.16 * k;
    const tw = 0.45 + 0.55 * Math.sin(d.t * 7 + i * 2.4);
    c.fillStyle = gray(1, 0.5 * tw);
    c.fillRect(d.apexX + Math.cos(ang) * rr - 1, d.apexY + Math.sin(ang) * rr - 1, 2.6, 2.6);
  }
  // B-lines: comet-tail rays from the pleura to the fan edge
  const n = Math.round(clamp(f.bLines, 0, 10));
  if (n > 0) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const sway = 0.03 * Math.sin(d.t * 1.1 + i * 2.1);
      const ang = Math.PI / 2 + (hash01(d.seed, 40 + i) - 0.5) * 2 * (d.halfAngle * 0.75) + sway;
      const gx = Math.cos(ang);
      const gy = Math.sin(ang);
      const grad = c.createLinearGradient(
        d.apexX + gx * rP,
        d.apexY + gy * rP,
        d.apexX + gx * d.fanR,
        d.apexY + gy * d.fanR,
      );
      grad.addColorStop(0, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0.18)');
      c.strokeStyle = grad;
      c.lineWidth = 0.26 * k * (0.8 + 0.4 * hash01(d.seed, 60 + i));
      c.beginPath();
      c.moveTo(d.apexX + gx * rP, d.apexY + gy * rP);
      c.lineTo(d.apexX + gx * d.fanR, d.apexY + gy * d.fanR);
      c.stroke();
    }
    c.restore();
  }
  // pleural effusion (posterior windows): anechoic wedge + atelectatic tongue
  if (effusion > 0 && posterior) {
    const depth = (yP + 0.2) * k;
    const wedge = 3.0 * effusion * k;
    c.fillStyle = 'rgba(3,3,3,0.92)';
    c.beginPath();
    c.arc(d.apexX, d.apexY, depth + wedge, a0 + 0.1, a1 - 0.1);
    c.arc(d.apexX, d.apexY, depth, a1 - 0.1, a0 + 0.1, true);
    c.closePath();
    c.fill();
    // diaphragm at the bottom of the wedge
    c.strokeStyle = gray(0.9);
    c.lineWidth = 0.2 * k;
    c.beginPath();
    c.arc(d.apexX, d.apexY, depth + wedge, a0 + 0.14, a1 - 0.14);
    c.stroke();
    // atelectatic tongue swaying in the fluid
    const rot = 0.05 * Math.sin(d.t * 0.9);
    c.save();
    c.translate(d.apexX, d.apexY + depth);
    c.rotate(rot);
    c.fillStyle = gray(0.5);
    c.beginPath();
    c.moveTo(-0.4 * k, 0);
    c.lineTo(0.5 * k, wedge * 0.85);
    c.lineTo(-1.3 * k, wedge * 0.7);
    c.closePath();
    c.fill();
    c.restore();
  }
  // rib shadows framing the window (drawn last so they occlude)
  for (const side of [-1, 1]) {
    const rx = d.apexX + side * 2.7 * k;
    c.fillStyle = gray(0.82);
    ell(c, rx, d.apexY + 2.75 * k, 0.55 * k, 0.22 * k, 0);
    c.fill();
    c.fillStyle = 'rgba(0,0,0,0.8)';
    c.beginPath();
    c.moveTo(rx - 0.55 * k, d.apexY + 2.85 * k);
    c.lineTo(rx + 0.55 * k, d.apexY + 2.85 * k);
    c.lineTo(rx + 1.15 * k, d.apexY + d.fanR);
    c.lineTo(rx - 1.15 * k, d.apexY + d.fanR);
    c.closePath();
    c.fill();
  }
}

// ================================================================ abdomen
function drawAbd(d: UsDraw, f: USAbdFindings, view: 'ruq' | 'luq' | 'pelvis'): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const ff = clamp(f.freeFluid, 0, 1);
  if (view === 'pelvis') {
    // bladder: anechoic with posterior acoustic enhancement
    ell(c, d.apexX, d.apexY + 5.4 * k, 2.3 * k, 1.65 * k, 0);
    c.fillStyle = gray(0.62);
    c.fill();
    ell(c, d.apexX, d.apexY + 5.4 * k, 2.15 * k, 1.5 * k, 0);
    c.fillStyle = '#030303';
    c.fill();
    c.save();
    c.globalCompositeOperation = 'lighter';
    const grad = c.createLinearGradient(0, d.apexY + 6.6 * k, 0, d.apexY + 9.5 * k);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grad;
    c.fillRect(d.apexX - 1.9 * k, d.apexY + 6.6 * k, 3.8 * k, 3 * k);
    c.restore();
    if (ff > 0) {
      c.fillStyle = 'rgba(3,3,3,0.9)';
      ell(c, d.apexX + 0.4 * k, d.apexY + 7.6 * k, 2.4 * k, (0.14 + 0.7 * ff) * k, 0.12);
      c.fill();
    }
    return;
  }
  const m = view === 'ruq' ? 1 : -1; // mirror for the left side
  // liver / spleen parenchyma
  const orgR = view === 'ruq' ? 3.2 : 2.4;
  ell(c, d.apexX - m * 1.1 * k, d.apexY + 5.0 * k, orgR * k, orgR * 0.78 * k, -m * 0.18);
  c.fillStyle = gray(0.5);
  c.fill();
  // portal/hepatic vessel hints
  c.strokeStyle = '#0a0a0a';
  c.lineWidth = 0.16 * k;
  for (let i = 0; i < 2; i++) {
    c.beginPath();
    c.moveTo(d.apexX - m * (0.4 + i * 1.3) * k, d.apexY + 4.2 * k);
    c.lineTo(d.apexX - m * (1.5 + i * 1.1) * k, d.apexY + 5.6 * k);
    c.stroke();
  }
  // diaphragm: bright arc hugging the organ's upper edge
  c.strokeStyle = gray(0.95);
  c.lineWidth = 0.22 * k;
  c.beginPath();
  c.arc(d.apexX - m * 0.8 * k, d.apexY + 5.1 * k, orgR * 1.12 * k, -2.5, -0.65);
  c.stroke();
  // kidney: bright capsule, darker cortex, echogenic sinus
  const kx = d.apexX + m * 1.7 * k;
  const ky = d.apexY + 6.9 * k;
  const rot = m * -0.5;
  ell(c, kx, ky, 1.75 * k, 1.05 * k, rot);
  c.fillStyle = gray(0.85);
  c.fill();
  ell(c, kx, ky, 1.58 * k, 0.88 * k, rot);
  c.fillStyle = gray(0.28);
  c.fill();
  ell(c, kx, ky, 0.85 * k, 0.42 * k, rot);
  c.fillStyle = gray(0.68);
  c.fill();
  // free fluid: anechoic stripe in the hepatorenal / splenorenal space
  if (ff > 0) {
    c.save();
    c.strokeStyle = 'rgba(2,2,2,0.94)';
    c.lineWidth = (0.16 + 0.75 * ff) * k;
    c.beginPath();
    c.ellipse(kx, ky, 1.95 * k, 1.25 * k, rot, Math.PI * (m > 0 ? 0.95 : -0.05), Math.PI * (m > 0 ? 1.55 : 0.55), false);
    c.stroke();
    c.restore();
  }
}

// ================================================================ procedural
export interface ProceduralState {
  /** 0..1 needle-tip travel toward the vein center. */
  needleDepth01: number;
  /** px of hand-tremor wobble applied perpendicular to the needle. */
  wobblePx: number;
  /** guidewire visible inside the vein (post-wire steps). */
  wireIn: boolean;
}

/** Linear-probe procedural window: vein + artery cross-sections + needle. */
export function drawProcedural(d: UsDraw, p: ProceduralState): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const cx = d.apexX;
  // fascia layers
  for (const [depth, b] of [
    [0.8, 0.5],
    [1.5, 0.4],
  ] as const) {
    c.strokeStyle = gray(b, 0.85);
    c.lineWidth = 0.16 * k;
    c.beginPath();
    c.moveTo(cx - 5 * k, d.apexY + depth * k);
    for (let x = -5; x <= 5; x += 0.5) {
      c.lineTo(cx + x * k, d.apexY + (depth + 0.08 * valueNoiseC(d.seed ^ 0x91, x * 2)) * k);
    }
    c.stroke();
  }
  const veinX = cx - 0.7 * k;
  const veinY = d.apexY + 2.6 * k;
  // vein: large oval, thin wall, gentle respirophasic size change
  const vScale = 1 + 0.06 * Math.sin(TWO_PI * d.respPhase);
  ell(c, veinX, veinY, 1.2 * k * vScale, 0.78 * k * vScale, 0.05);
  c.fillStyle = gray(0.55);
  c.fill();
  ell(c, veinX, veinY, (1.2 * k - 0.07 * k) * vScale, (0.78 * k - 0.07 * k) * vScale, 0.05);
  c.fillStyle = '#040404';
  c.fill();
  // artery: smaller, round, thick bright wall, beat-synced pulsation
  const aR = 0.58 * k * (1 + 0.09 * d.pulse);
  const ax = cx + 1.5 * k;
  const ay = d.apexY + 3.0 * k;
  ell(c, ax, ay, aR + 0.18 * k, aR + 0.18 * k, 0);
  c.fillStyle = gray(0.92);
  c.fill();
  ell(c, ax, ay, aR, aR, 0);
  c.fillStyle = '#050505';
  c.fill();
  if (p.wireIn) {
    c.save();
    c.strokeStyle = gray(1, 0.95);
    c.lineWidth = 0.07 * k;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.moveTo(veinX - 1.0 * k, veinY + 0.15 * k);
    c.quadraticCurveTo(veinX, veinY - 0.25 * k, veinX + 1.0 * k, veinY + 0.1 * k);
    c.stroke();
    c.restore();
  }
  if (p.needleDepth01 > 0.01) {
    const entry = { x: cx - 4.6 * k, y: d.apexY + 0.15 * k };
    const target = { x: veinX, y: veinY };
    const tip = {
      x: lerp(entry.x, target.x, p.needleDepth01),
      y: lerp(entry.y, target.y, p.needleDepth01),
    };
    const nx = target.y - entry.y;
    const ny = -(target.x - entry.x);
    const nl = Math.hypot(nx, ny) || 1;
    const wob = p.wobblePx;
    const ox = (nx / nl) * wob;
    const oy = (ny / nl) * wob;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const [off, a] of [
      [0, 0.95],
      [4, 0.3],
      [8, 0.14],
    ] as const) {
      c.strokeStyle = `rgba(255,255,255,${a})`;
      c.lineWidth = off === 0 ? 3 : 2;
      c.beginPath();
      c.moveTo(entry.x + ox, entry.y + oy + off);
      c.lineTo(tip.x + ox, tip.y + oy + off);
      c.stroke();
    }
    // tip: bright dot + ring-down tail
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath();
    c.arc(tip.x + ox, tip.y + oy, 3.2, 0, TWO_PI);
    c.fill();
    const rd = c.createLinearGradient(0, tip.y, 0, tip.y + 2.2 * k);
    rd.addColorStop(0, 'rgba(255,255,255,0.4)');
    rd.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rd;
    c.fillRect(tip.x + ox - 1.5, tip.y + oy, 3, 2.2 * k);
    c.restore();
  }
}

// ================================================================ dispatch
export function drawView(d: UsDraw, view: UsViewId, f: USFindings): void {
  switch (view) {
    case 'plax':
      return drawPlax(d, f.kind === 'cardiac' ? f : DEFAULT_CARDIAC);
    case 'psax':
      return drawPsax(d, f.kind === 'cardiac' ? f : DEFAULT_CARDIAC);
    case 'a4c':
      return drawA4c(d, f.kind === 'cardiac' ? f : DEFAULT_CARDIAC);
    case 'subxiphoid':
      return drawSubxiphoid(d, f.kind === 'cardiac' ? f : DEFAULT_CARDIAC);
    case 'ivc':
      return drawIvc(d, f.kind === 'ivc' ? f : DEFAULT_IVC);
    case 'lung_ant_l':
    case 'lung_ant_r':
      return drawLung(d, f.kind === 'lung' ? f : DEFAULT_LUNG, false);
    case 'lung_post_l':
    case 'lung_post_r':
      return drawLung(d, f.kind === 'lung' ? f : DEFAULT_LUNG, true);
    case 'ruq':
    case 'luq':
    case 'pelvis':
      return drawAbd(d, f.kind === 'abdominal' ? f : DEFAULT_ABD, view);
  }
}

const DEFAULT_CARDIAC: USCardiacFindings = {
  kind: 'cardiac',
  contractility: 0.6,
  lvScale: 1,
  rvScale: 1,
  effusion: 0,
};
const DEFAULT_IVC: USIvcFindings = { kind: 'ivc', diameterCm: 1.8, collapse: 0.3 };
const DEFAULT_LUNG: USLungFindings = { kind: 'lung', sliding: true, bLines: 0, effusion: 0 };
const DEFAULT_ABD: USAbdFindings = { kind: 'abdominal', freeFluid: 0 };

/** Sensible per-view defaults when the patient has no findings for a view. */
export function defaultFindingsFor(view: UsViewId): USFindings {
  switch (view) {
    case 'plax':
    case 'psax':
    case 'a4c':
    case 'subxiphoid':
      return DEFAULT_CARDIAC;
    case 'ivc':
      return DEFAULT_IVC;
    case 'lung_ant_l':
    case 'lung_ant_r':
    case 'lung_post_l':
    case 'lung_post_r':
      return DEFAULT_LUNG;
    case 'ruq':
    case 'luq':
    case 'pelvis':
      return DEFAULT_ABD;
  }
}
