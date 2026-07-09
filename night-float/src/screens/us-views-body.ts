/**
 * Ultrasound structure painters, part 2 (SPEC §8.2): IVC, lung fields,
 * abdominal/FAST windows and the linear-probe procedural mode. Cardiac views
 * + the view dispatcher live in us-views.ts.
 *
 * TODO(MEDICAL): all geometry is impressionistic — shapes/sizes/motion are
 * tuned so each view "reads", not for anatomic fidelity.
 */
import type {
  USAbdFindings,
  USIvcFindings,
  USLungFindings,
} from '../contracts/patient';
import { hash01 } from '../engine/rng';
import { clamp, lerp, valueNoiseC } from '../engine/waveforms';
import { ell, gray, TWO_PI, type UsDraw } from './us-draw';

// ================================================================ ivc
export function drawIvc(d: UsDraw, f: USIvcFindings): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  // surrounding parenchyma everywhere, liver a touch brighter above the vein
  c.fillStyle = gray(0.4);
  c.fillRect(0, d.apexY + 0.4 * k, d.apexX * 2, d.fanR);
  c.fillStyle = gray(0.5);
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
  c.strokeStyle = '#0a0a0a';
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
export function drawLung(d: UsDraw, f: USLungFindings, posterior: boolean): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const yP = 3.2; // pleural depth cm
  const rP = yP * k;
  const a0 = Math.PI / 2 - d.halfAngle * 0.9;
  const a1 = Math.PI / 2 + d.halfAngle * 0.9;
  // chest-wall soft tissue above the pleura
  c.fillStyle = gray(0.38);
  c.beginPath();
  c.arc(d.apexX, d.apexY, rP - 0.1 * k, Math.PI / 2 - d.halfAngle, Math.PI / 2 + d.halfAngle);
  c.lineTo(d.apexX, d.apexY);
  c.closePath();
  c.fill();
  for (const [depth, b] of [
    [1.1, 0.55],
    [2.1, 0.48],
  ] as const) {
    c.strokeStyle = gray(b, 0.85);
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
  // pleural effusion (posterior windows): anechoic wedge above the diaphragm,
  // bright subdiaphragmatic organ below, atelectatic tongue afloat in the fluid
  if (effusion > 0 && posterior) {
    const depth = (yP + 0.2) * k;
    const wedge = 3.0 * effusion * k;
    c.fillStyle = 'rgba(3,3,3,0.94)';
    c.beginPath();
    c.arc(d.apexX, d.apexY, depth + wedge, a0 + 0.1, a1 - 0.1);
    c.arc(d.apexX, d.apexY, depth, a1 - 0.1, a0 + 0.1, true);
    c.closePath();
    c.fill();
    // diaphragm + organ (liver/spleen) beneath the fluid
    c.fillStyle = gray(0.5);
    c.beginPath();
    c.arc(d.apexX, d.apexY, depth + wedge + 2.6 * k, a0 + 0.12, a1 - 0.12);
    c.arc(d.apexX, d.apexY, depth + wedge, a1 - 0.12, a0 + 0.12, true);
    c.closePath();
    c.fill();
    c.strokeStyle = gray(0.95);
    c.lineWidth = 0.2 * k;
    c.beginPath();
    c.arc(d.apexX, d.apexY, depth + wedge, a0 + 0.14, a1 - 0.14);
    c.stroke();
    // atelectatic tongue swaying in the fluid
    const rot = 0.07 * Math.sin(d.t * 0.9);
    c.save();
    c.translate(d.apexX - 0.3 * k, d.apexY + depth);
    c.rotate(rot);
    c.fillStyle = gray(0.55);
    c.beginPath();
    c.moveTo(-0.55 * k, 0.1 * k);
    c.quadraticCurveTo(0.5 * k, wedge * 0.25, 0.15 * k, wedge * 0.8);
    c.quadraticCurveTo(-0.4 * k, wedge * 0.5, -0.9 * k, 0.3 * k);
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
export function drawAbd(d: UsDraw, f: USAbdFindings, view: 'ruq' | 'luq' | 'pelvis'): void {
  const c = d.ctx;
  const k = d.pxPerCm;
  const ff = clamp(f.freeFluid, 0, 1);
  // soft-tissue backdrop so organs sit in flesh, not in a void
  c.fillStyle = gray(0.34);
  c.fillRect(0, d.apexY + 0.3 * k, d.apexX * 2, d.fanR);
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
  // layered soft tissue: brighter superficial block over darker deep field
  c.fillStyle = gray(0.42);
  c.fillRect(0, d.apexY, cx * 2, 1.9 * k);
  c.fillStyle = gray(0.3);
  c.fillRect(0, d.apexY + 1.9 * k, cx * 2, d.fanR);
  // fascia layers
  for (const [depth, b] of [
    [0.8, 0.55],
    [1.5, 0.45],
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

