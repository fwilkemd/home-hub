/**
 * Procedural portable chest X-ray painter (SPEC §5.4). Registered with the
 * bridge media layer at createScreens() time; the event applier calls it when
 * imaging results. Pure-ish: deterministic per (patient, seed) via hash01.
 *
 * TODO(MEDICAL): findings mapping (effusion blunting, B-line haze, ETT tip
 * position) is impressionistic — the medical pass owns what a film shows.
 */
import type { CxrPainter } from '../bridge/media';
import type { PatientState } from '../contracts/patient';
import { hash01 } from '../engine/rng';
import { clamp } from '../engine/waveforms';
import { ctx2d } from './us-speckle';

const W = 640;
const H = 768;

function gray(v: number, a = 1): string {
  const b = Math.round(255 * clamp(v, 0, 1));
  return `rgba(${b},${b},${b},${a})`;
}

function noiseTile(seed: number): HTMLCanvasElement {
  const S = 96;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = ctx2d(cv);
  const img = ctx.createImageData(S, S);
  let p = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v = Math.round(255 * (0.42 + 0.5 * hash01(seed, x + y * S)));
      img.data[p++] = v;
      img.data[p++] = v;
      img.data[p++] = v;
      img.data[p++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function makeCxrPainter(): CxrPainter {
  return (patient: PatientState, findingsText: string, seed: number): string => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = ctx2d(cv);
    const cx = W / 2;

    // film background + soft-tissue body
    c.fillStyle = '#08080a';
    c.fillRect(0, 0, W, H);
    const body = c.createRadialGradient(cx, H * 0.48, 60, cx, H * 0.48, W * 0.62);
    body.addColorStop(0, gray(0.34));
    body.addColorStop(0.75, gray(0.26));
    body.addColorStop(1, gray(0.1));
    c.fillStyle = body;
    c.fillRect(W * 0.06, H * 0.05, W * 0.88, H * 0.92);

    // lung fields (darker), textured with multiplied hash noise
    const lung = (side: -1 | 1): void => {
      c.save();
      c.beginPath();
      c.ellipse(cx + side * W * 0.21, H * 0.42, W * 0.17, H * 0.27, side * 0.08, 0, Math.PI * 2);
      c.clip();
      c.fillStyle = gray(0.12);
      c.fillRect(0, 0, W, H);
      // faint vascular markings radiating from the hilum
      c.strokeStyle = gray(0.3, 0.5);
      c.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const a = -0.9 + 1.8 * hash01(seed, 20 + i + (side + 1) * 50);
        c.beginPath();
        c.moveTo(cx + side * W * 0.1, H * 0.42);
        c.lineTo(
          cx + side * W * (0.1 + 0.26 * Math.cos(a)),
          H * (0.42 + 0.3 * Math.sin(a)),
        );
        c.stroke();
      }
      c.restore();
    };
    lung(-1);
    lung(1);
    // sub-diaphragmatic soft tissue so the film base is not empty black
    c.fillStyle = gray(0.3, 0.85);
    c.fillRect(W * 0.1, H * 0.72, W * 0.8, H * 0.2);

    // findings from the ultrasound lung views (cheap correlate)
    const lungViews = [
      { v: patient.us.lung_ant_l, post: patient.us.lung_post_l, side: 1 as const }, // patient L = viewer right
      { v: patient.us.lung_ant_r, post: patient.us.lung_post_r, side: -1 as const },
    ];
    for (const lf of lungViews) {
      const eff = Math.max(
        lf.v?.kind === 'lung' ? lf.v.effusion : 0,
        lf.post?.kind === 'lung' ? lf.post.effusion : 0,
      );
      const bl = Math.max(
        lf.v?.kind === 'lung' ? lf.v.bLines : 0,
        lf.post?.kind === 'lung' ? lf.post.bLines : 0,
      );
      if (eff > 0.3) {
        // blunted costophrenic angle: opacity pooling at the lateral base
        c.fillStyle = gray(0.42, 0.9);
        c.beginPath();
        c.moveTo(cx + lf.side * W * 0.1, H * 0.72);
        c.lineTo(cx + lf.side * W * 0.38, H * (0.7 - 0.09 * eff));
        c.lineTo(cx + lf.side * W * 0.38, H * 0.74);
        c.quadraticCurveTo(cx + lf.side * W * 0.24, H * 0.76, cx + lf.side * W * 0.1, H * 0.74);
        c.closePath();
        c.fill();
      }
      if (bl > 3) {
        c.fillStyle = gray(0.35, 0.3 + 0.03 * bl);
        c.beginPath();
        c.ellipse(cx + lf.side * W * 0.21, H * 0.56, W * 0.16, H * 0.12, 0, 0, Math.PI * 2);
        c.fill();
      }
    }

    // mediastinum + heart (size hinted by cardiac lvScale)
    const cardiac = patient.us.plax ?? patient.us.a4c;
    const lvScale = cardiac?.kind === 'cardiac' ? cardiac.lvScale : 1;
    c.fillStyle = gray(0.4);
    c.fillRect(cx - W * 0.06, H * 0.16, W * 0.12, H * 0.5);
    c.beginPath();
    c.ellipse(cx + W * 0.05, H * 0.52, W * 0.155 * clamp(lvScale, 0.7, 1.6), H * 0.13, 0.35, 0, Math.PI * 2);
    c.fillStyle = gray(0.44);
    c.fill();

    // spine hint behind the mediastinum
    c.fillStyle = gray(0.5, 0.25);
    for (let i = 0; i < 12; i++) c.fillRect(cx - 12, H * 0.14 + i * H * 0.048, 24, H * 0.028);

    // diaphragm arcs
    c.strokeStyle = gray(0.55, 0.9);
    c.lineWidth = 5;
    for (const side of [-1, 1] as const) {
      c.beginPath();
      c.arc(cx + side * W * 0.2, H * 0.78, W * 0.21, Math.PI * 1.15, Math.PI * 1.85);
      c.stroke();
    }

    // ribs + clavicles
    c.strokeStyle = gray(0.62, 0.4);
    c.lineWidth = 6;
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 9; i++) {
        const y = H * (0.17 + i * 0.062);
        c.beginPath();
        c.arc(cx + side * W * 0.05, y + W * 0.3, W * 0.36, Math.PI * 1.28, Math.PI * 1.62);
        c.stroke();
      }
      c.beginPath();
      c.arc(cx + side * W * 0.16, H * 0.2, W * 0.2, Math.PI * 1.1, Math.PI * 1.5);
      c.stroke();
    }

    // ETT: bright stripe from top midline ending above the carina
    if (patient.lines.some((l) => l.type === 'ett')) {
      const tipY = H * 0.335;
      c.fillStyle = gray(0.92, 0.9);
      c.fillRect(cx - 4, H * 0.055, 8, tipY - H * 0.055);
      c.fillRect(cx - 12, tipY - 3, 24, 6); // tip marker
    }

    // film grain (multiply) + vignette
    const tile = noiseTile(seed);
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = 0.85;
    for (let y = 0; y < H; y += 96) for (let x = 0; x < W; x += 96) c.drawImage(tile, x, y);
    c.restore();
    const vig = c.createRadialGradient(cx, H / 2, H * 0.28, cx, H / 2, H * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vig;
    c.fillRect(0, 0, W, H);

    // labels
    c.font = '700 17px ui-monospace, Menlo, monospace';
    c.fillStyle = gray(0.85);
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText('PORTABLE — AP', 16, 14);
    c.font = '12px ui-monospace, Menlo, monospace';
    c.fillStyle = gray(0.6);
    c.fillText(patient.demographics.name.toUpperCase(), 16, 38);
    c.fillText('NF IMAGING', 16, H - 26);
    if (findingsText) {
      c.textAlign = 'right';
      c.fillStyle = gray(0.45);
      c.fillText('SEE REPORT', W - 16, H - 26);
    }
    c.font = '700 20px ui-monospace, Menlo, monospace';
    c.fillStyle = gray(0.8);
    c.textAlign = 'right';
    c.fillText('L', W - 20, 14); // patient-left marker

    return cv.toDataURL('image/png');
  };
}
