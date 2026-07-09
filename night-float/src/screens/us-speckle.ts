/**
 * Ultrasound image-pipeline primitives (SPEC §8.2): seamless value-noise
 * speckle tiles (pre-rendered once, deterministic via hash01), the fan/sector
 * clip path, radial depth-gain falloff and the near-field haze band.
 */
import { hash01 } from '../engine/rng';
import { clamp, lerp } from '../engine/waveforms';

export function ctx2d(cv: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  return ctx;
}

const TILE = 128;

/** 2-3 grayscale value-noise tiles at different grains; tile seamlessly. */
export function makeSpeckleTiles(seed: number): HTMLCanvasElement[] {
  return [makeTile(seed ^ 0x1a2b, 5), makeTile(seed ^ 0x3c4d, 9), makeTile(seed ^ 0x5e6f, 15)];
}

function makeTile(seed: number, cellPx: number): HTMLCanvasElement {
  const cells = Math.max(2, Math.round(TILE / cellPx));
  const cv = document.createElement('canvas');
  cv.width = cv.height = TILE;
  const ctx = ctx2d(cv);
  const img = ctx.createImageData(TILE, TILE);
  const lat = (ix: number, iy: number): number =>
    hash01(seed, (((ix % cells) + cells) % cells) + (((iy % cells) + cells) % cells) * 8191);
  let p = 0;
  for (let y = 0; y < TILE; y++) {
    const gy = (y / TILE) * cells;
    const iy = Math.floor(gy);
    const fy = gy - iy;
    const uy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < TILE; x++) {
      const gx = (x / TILE) * cells;
      const ix = Math.floor(gx);
      const fx = gx - ix;
      const ux = fx * fx * (3 - 2 * fx);
      const v = lerp(
        lerp(lat(ix, iy), lat(ix + 1, iy), ux),
        lerp(lat(ix, iy + 1), lat(ix + 1, iy + 1), ux),
        uy,
      );
      const gvRaw = 0.3 + 0.74 * v;
      const gv = Math.round(255 * clamp(gvRaw, 0, 1));
      img.data[p++] = gv;
      img.data[p++] = gv;
      img.data[p++] = gv;
      img.data[p++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Speckle pass: tile drawn tiled with slow deterministic drift. */
export function specklePass(
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  scale: number,
  ox: number,
  oy: number,
  w: number,
  h: number,
  alpha: number,
  op: GlobalCompositeOperation = 'multiply',
): void {
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = alpha;
  const s = TILE * scale;
  const x0 = -(((ox % s) + s) % s);
  const y0 = -(((oy % s) + s) % s);
  for (let y = y0; y < h; y += s) {
    for (let x = x0; x < w; x += s) {
      ctx.drawImage(tile, x, y, s, s);
    }
  }
  ctx.restore();
}

/** Sector path: apex top-center, small probe-face arc, wide bottom arc. */
export function fanPath(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  r0: number,
  r1: number,
  halfAngle: number,
): void {
  const a0 = Math.PI / 2 - halfAngle;
  const a1 = Math.PI / 2 + halfAngle;
  ctx.beginPath();
  ctx.arc(ax, ay, r0, a0, a1);
  ctx.arc(ax, ay, r1, a1, a0, true);
  ctx.closePath();
}

/** Radial depth-gain falloff; the gain knob lifts the mid/far field. */
export function radialGain(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  r1: number,
  gain: number,
  w: number,
  h: number,
): void {
  const grad = ctx.createRadialGradient(ax, ay, 0, ax, ay, r1);
  grad.addColorStop(0, `rgba(0,0,0,${clamp(0.14 * (1 - gain), 0, 1)})`);
  grad.addColorStop(0.45, `rgba(0,0,0,${clamp(0.5 - 0.8 * gain, 0, 0.7)})`);
  grad.addColorStop(1, `rgba(0,0,0,${clamp(0.85 - 1.05 * gain, 0, 0.9)})`);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  if (gain > 0.55) {
    // hot gain washes the whole field out, like the real knob
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(255,255,255,${(gain - 0.55) * 0.3})`;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

/** Near-field haze band right under the probe face. */
export function nearFieldHaze(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  r1: number,
): void {
  const grad = ctx.createRadialGradient(ax, ay, 0, ax, ay, r1 * 0.22);
  grad.addColorStop(0, 'rgba(235,240,245,0.30)');
  grad.addColorStop(0.55, 'rgba(235,240,245,0.10)');
  grad.addColorStop(1, 'rgba(235,240,245,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grad;
  ctx.fillRect(ax - r1 * 0.25, ay, r1 * 0.5, r1 * 0.25);
  ctx.restore();
}
