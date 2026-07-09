/**
 * World-internal helpers: deterministic RNG, CanvasTexture painters (all
 * procedural — SPEC §2), geometry merging, disposal. Painters must tolerate
 * a null 2D context (headless DOM) and still return a usable texture.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Deterministic PRNG (mulberry32) — no Math.random anywhere in the world. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const smoothstep = (v: number): number => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- canvas
export interface Painter {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
}
export function makeCanvas(w: number, h: number): Painter {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

export function canvasTexture(
  canvas: HTMLCanvasElement,
  opts: { repeat?: [number, number]; srgb?: boolean } = {},
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------- painters
export function paintFloor(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 512);
  if (ctx) {
    const r = rng(11);
    const tiles = 4;
    const s = 512 / tiles;
    for (let i = 0; i < tiles; i++) {
      for (let j = 0; j < tiles; j++) {
        const v = 82 + Math.floor(r() * 14);
        ctx.fillStyle = `rgb(${v - 4},${v},${v + 8})`;
        ctx.fillRect(i * s, j * s, s, s);
        // faint vinyl streaks
        ctx.globalAlpha = 0.1;
        for (let k = 0; k < 7; k++) {
          const g = 60 + r() * 70;
          ctx.fillStyle = `rgb(${g},${g + 3},${g + 9})`;
          ctx.fillRect(i * s + r() * s, j * s + r() * s, 2 + r() * 26, 1.5);
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.strokeStyle = 'rgba(16,18,24,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= tiles; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, 512);
      ctx.moveTo(0, i * s);
      ctx.lineTo(512, i * s);
      ctx.stroke();
    }
  }
  return canvasTexture(canvas, { repeat: [3.5, 2.9] });
}

export function paintCeiling(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  if (ctx) {
    ctx.fillStyle = '#3c414c';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(12,14,20,0.85)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 128, 0);
      ctx.lineTo(i * 128, 256);
      ctx.moveTo(0, i * 128);
      ctx.lineTo(256, i * 128);
      ctx.stroke();
    }
  }
  return canvasTexture(canvas, { repeat: [5.2, 4.2] });
}

export function paintWallNoise(seed: number): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(128, 128);
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    const r = rng(seed);
    for (let i = 0; i < 500; i++) {
      const g = 235 + r() * 20;
      ctx.fillStyle = `rgba(${g},${g},${g},0.35)`;
      ctx.fillRect(r() * 128, r() * 128, 3, 3);
    }
  }
  return canvasTexture(canvas, { repeat: [6, 3] });
}

/** Night city seen through the window — emissive, very dim (SPEC §6.1). */
export function paintCityNight(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(512, 320);
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, '#0b1730');
    g.addColorStop(0.55, '#081020');
    g.addColorStop(1, '#04070e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 320);
    const r = rng(77);
    // building silhouettes
    let x = 0;
    while (x < 512) {
      const w = 30 + r() * 55;
      const top = 90 + r() * 140;
      ctx.fillStyle = 'rgba(3,5,10,0.9)';
      ctx.fillRect(x, top, w, 320 - top);
      // scattered lit windows
      const cols = Math.floor(w / 12);
      for (let c = 0; c < cols; c++) {
        for (let row = 0; row < 14; row++) {
          if (r() < 0.085) {
            ctx.fillStyle = r() < 0.35 ? 'rgba(159,192,255,0.75)' : 'rgba(255,214,140,0.8)';
            ctx.fillRect(x + 3 + c * 12, top + 6 + row * 14, 4, 5);
          }
        }
      }
      x += w + 2;
    }
    // haze
    ctx.fillStyle = 'rgba(20,34,64,0.18)';
    ctx.fillRect(0, 150, 512, 60);
  }
  return canvasTexture(canvas);
}

export function paintCurtain(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 256);
  if (ctx) {
    for (let x = 0; x < 256; x++) {
      const pleat = 0.5 + 0.5 * Math.sin((x / 256) * Math.PI * 18);
      const base = 118 + pleat * 26;
      ctx.fillStyle = `rgb(${base - 6},${base},${base + 8})`;
      ctx.fillRect(x, 0, 1, 256);
    }
    // woven stripe band
    ctx.fillStyle = 'rgba(96,128,150,0.5)';
    ctx.fillRect(0, 30, 256, 14);
  }
  return canvasTexture(canvas, { repeat: [2.2, 1] });
}

export interface LabelOpts {
  w?: number;
  h?: number;
  bg?: string;
  fg?: string;
  border?: string;
  font?: number;
}
/** Small technical label plate (drawer fronts, gas outlets). No emoji, ever. */
export function paintLabel(text: string, o: LabelOpts = {}): THREE.CanvasTexture {
  const w = o.w ?? 256;
  const h = o.h ?? 64;
  const { canvas, ctx } = makeCanvas(w, h);
  if (ctx) {
    ctx.fillStyle = o.bg ?? '#454b55';
    ctx.fillRect(0, 0, w, h);
    if (o.border) {
      ctx.strokeStyle = o.border;
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    }
    ctx.fillStyle = o.fg ?? '#e8ecf2';
    ctx.font = `600 ${o.font ?? Math.floor(h * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), w / 2, h / 2 + 1);
  }
  return canvasTexture(canvas);
}

/** Red crash-cart front: drawer hairline gaps + small labels (SPEC §6.1). */
export function paintCodeCartFront(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 384);
  if (ctx) {
    ctx.fillStyle = '#8e2430';
    ctx.fillRect(0, 0, 256, 384);
    const rows = 5;
    const labels = ['AIRWAY', 'MEDS 1', 'MEDS 2', 'IV / LINES', 'DEFIB PADS'];
    for (let i = 0; i < rows; i++) {
      const y = (i * 384) / rows;
      ctx.strokeStyle = 'rgba(20,6,8,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(6, y + 5, 244, 384 / rows - 10);
      ctx.fillStyle = '#f3d9c8';
      ctx.fillRect(70, y + 14, 116, 20);
      ctx.fillStyle = '#3a1116';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], 128, y + 24);
      // handle
      ctx.fillStyle = 'rgba(30,10,12,0.9)';
      ctx.fillRect(48, y + 384 / rows - 24, 160, 8);
    }
  }
  return canvasTexture(canvas);
}

export function paintKeyboard(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(256, 96);
  if (ctx) {
    ctx.fillStyle = '#22252c';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#3a3f49';
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 14; c++) ctx.fillRect(6 + c * 18, 8 + r * 20, 14, 14);
    ctx.fillRect(60, 74, 130, 14); // spacebar
  }
  return canvasTexture(canvas);
}

/** Corrugated vent-circuit rings, mapped along tube length. */
export function paintCorrugation(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(64, 64);
  if (ctx) {
    for (let y = 0; y < 64; y++) {
      const ring = 0.5 + 0.5 * Math.sin((y / 64) * Math.PI * 8);
      const v = 120 + ring * 60;
      ctx.fillStyle = `rgba(${v},${v + 6},${v + 10},1)`;
      ctx.fillRect(0, y, 64, 1);
    }
  }
  return canvasTexture(canvas, { repeat: [1, 14] });
}

export function paintBlanket(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(128, 128);
  if (ctx) {
    ctx.fillStyle = '#9aa4b5';
    ctx.fillRect(0, 0, 128, 128);
    const r = rng(5);
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 400; i++) {
      const g = 120 + r() * 80;
      ctx.fillStyle = `rgb(${g},${g + 4},${g + 12})`;
      ctx.fillRect(r() * 128, r() * 128, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#6f7b90';
    ctx.fillRect(0, 8, 128, 10); // border stripe
  }
  return canvasTexture(canvas, { repeat: [2, 3] });
}

/** Static idle screen for the workstation before/without a live canvas. */
export function paintWorkstationScreen(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(320, 200);
  if (ctx) {
    ctx.fillStyle = '#0a0f16';
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = '#12233a';
    ctx.fillRect(0, 0, 320, 26);
    ctx.fillStyle = '#7fa8d0';
    ctx.font = '600 13px monospace';
    ctx.fillText('ICU CHART — LOCKED', 12, 17);
    ctx.fillStyle = '#16202e';
    for (let i = 0; i < 4; i++) ctx.fillRect(20, 48 + i * 32, 280, 18);
    ctx.fillStyle = '#4d648a';
    ctx.font = '11px monospace';
    ctx.fillText('press to open chart', 20, 190);
  }
  return canvasTexture(canvas);
}

// ---------------------------------------------------------------- geometry
export interface BoxSpec {
  size: [number, number, number];
  pos: [number, number, number];
  rotY?: number;
}
/** Merge many boxes sharing one material into a single geometry/draw call. */
export function mergedBoxes(specs: BoxSpec[]): THREE.BufferGeometry {
  const parts = specs.map((s) => {
    const g = new THREE.BoxGeometry(...s.size);
    if (s.rotY) g.rotateY(s.rotY);
    g.translate(...s.pos);
    return g;
  });
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged ?? new THREE.BufferGeometry();
}

/** Cylinder stretched between two world points (arm segments, tubing). */
export function tubeBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

// ---------------------------------------------------------------- disposal
const TEXTURE_SLOTS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'alphaMap', 'aoMap'] as const;

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
    const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const m of mats) {
      const rec = m as unknown as Record<string, unknown>;
      for (const slot of TEXTURE_SLOTS) {
        const t = rec[slot];
        if (t instanceof THREE.Texture) t.dispose();
      }
      m.dispose();
    }
  });
}
