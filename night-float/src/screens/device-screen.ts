/**
 * DeviceScreen plumbing shared by every screen (SPEC §7): a fixed-resolution
 * offscreen canvas redrawn at most `fps` times per second from update(), plus
 * a hit-region registry rebuilt on every draw so click(x, y) — forwarded by
 * the UI zoom overlay in CANVAS coordinates — lands on the right control.
 * The world maps the same canvas onto a 3D screen mesh as an emissive
 * texture; we only draw and handle clicks here.
 */
import { bus } from '../bridge/bus';
import type { DeviceId } from '../contracts/ids';

export interface HitRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  onClick: () => void;
  label?: string;
}

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
export const SANS = 'ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif';

export interface ButtonOpts {
  color?: string;
  active?: boolean;
  disabled?: boolean;
  fontSize?: number;
  /** small triangle glyph drawn before the label: up / down / right */
  glyph?: 'up' | 'down' | 'play' | 'pause' | 'minus' | 'plus';
}

export class ScreenPainter {
  readonly device: DeviceId;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;

  private regions: HitRegion[] = [];
  private lastDraw = -Infinity;
  private readonly minInterval: number;

  constructor(device: DeviceId, w: number, h: number, fps = 30) {
    this.device = device;
    this.w = w;
    this.h = h;
    this.minInterval = 1 / fps;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error(`no 2d context for ${device} screen`);
    this.ctx = ctx;
  }

  /** Self-throttle: true (and stamps the time) when a redraw is due. */
  due(realTimeS: number): boolean {
    if (realTimeS - this.lastDraw < this.minInterval) return false;
    this.lastDraw = realTimeS;
    return true;
  }

  // ------------------------------------------------------------ hit regions
  clearRegions(): void {
    this.regions.length = 0;
  }

  region(x: number, y: number, w: number, h: number, onClick: () => void, label?: string): void {
    this.regions.push({ x, y, w, h, onClick, label });
  }

  /** Dispatch a zoom-overlay click (canvas coords). Topmost region wins. */
  click(x: number, y: number): void {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        bus.emit('screenClick', { device: this.device });
        r.onClick();
        return;
      }
    }
  }

  // ------------------------------------------------------------ draw helpers
  rounded(x: number, y: number, w: number, h: number, r: number): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  text(
    s: string,
    x: number,
    y: number,
    size: number,
    color: string,
    align: CanvasTextAlign = 'left',
    font = MONO,
    weight = '',
  ): void {
    const c = this.ctx;
    c.font = `${weight ? weight + ' ' : ''}${size}px ${font}`;
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillText(s, x, y);
  }

  /** Small-caps style technical label. */
  label(s: string, x: number, y: number, size: number, color: string): void {
    this.text(s.toUpperCase(), x, y, size, color, 'left', MONO);
  }

  private glyphPath(g: NonNullable<ButtonOpts['glyph']>, cx: number, cy: number, s: number): void {
    const c = this.ctx;
    c.beginPath();
    if (g === 'up') {
      c.moveTo(cx, cy - s);
      c.lineTo(cx + s, cy + s * 0.8);
      c.lineTo(cx - s, cy + s * 0.8);
    } else if (g === 'down') {
      c.moveTo(cx, cy + s);
      c.lineTo(cx + s, cy - s * 0.8);
      c.lineTo(cx - s, cy - s * 0.8);
    } else if (g === 'play') {
      c.moveTo(cx - s * 0.7, cy - s);
      c.lineTo(cx + s, cy);
      c.lineTo(cx - s * 0.7, cy + s);
    } else if (g === 'pause') {
      c.rect(cx - s * 0.8, cy - s, s * 0.6, s * 2);
      c.rect(cx + s * 0.2, cy - s, s * 0.6, s * 2);
    } else if (g === 'minus') {
      c.rect(cx - s, cy - s * 0.28, s * 2, s * 0.56);
    } else {
      c.rect(cx - s, cy - s * 0.28, s * 2, s * 0.56);
      c.rect(cx - s * 0.28, cy - s, s * 0.56, s * 2);
    }
    c.closePath();
  }

  /** Draw a touch-friendly button and register its hit region. */
  button(
    x: number,
    y: number,
    w: number,
    h: number,
    labelText: string,
    onClick: () => void,
    opts: ButtonOpts = {},
  ): void {
    const c = this.ctx;
    const color = opts.color ?? '#9fb4c4';
    const dim = opts.disabled ? 0.35 : 1;
    c.save();
    c.globalAlpha = dim;
    this.rounded(x, y, w, h, 7);
    c.fillStyle = opts.active ? 'rgba(160,200,235,0.22)' : 'rgba(255,255,255,0.055)';
    c.fill();
    c.strokeStyle = opts.active ? color : 'rgba(255,255,255,0.22)';
    c.lineWidth = opts.active ? 1.6 : 1;
    this.rounded(x + 0.5, y + 0.5, w - 1, h - 1, 7);
    c.stroke();
    const fs = opts.fontSize ?? 15;
    let tx = x + w / 2;
    if (opts.glyph) {
      const gs = fs * 0.42;
      const hasLabel = labelText.length > 0;
      const gx = hasLabel ? x + 16 : x + w / 2;
      c.fillStyle = color;
      this.glyphPath(opts.glyph, gx, y + h / 2, gs);
      c.fill();
      if (hasLabel) tx = x + 16 + 10 + (w - 26 - 10) / 2;
    }
    if (labelText) this.text(labelText, tx, y + h / 2 + 0.5, fs, color, 'center', MONO);
    c.restore();
    if (!opts.disabled) this.region(x, y, w, h, onClick, labelText);
  }

  /** Rounded status chip (RUN / OCCLUDED / mode badge...). */
  chip(x: number, y: number, w: number, h: number, s: string, fg: string, bg: string): void {
    const c = this.ctx;
    this.rounded(x, y, w, h, h / 2);
    c.fillStyle = bg;
    c.fill();
    this.text(s, x + w / 2, y + h / 2 + 0.5, h * 0.52, fg, 'center', MONO, '700');
  }

  /** Crossed-bell glyph (alarm silenced) — drawn, never an emoji. */
  bellCrossed(cx: number, cy: number, size: number, color: string): void {
    const c = this.ctx;
    c.save();
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = Math.max(1.4, size * 0.13);
    c.lineCap = 'round';
    c.beginPath(); // bell body
    c.moveTo(cx - size * 0.62, cy + size * 0.35);
    c.quadraticCurveTo(cx - size * 0.5, cy + size * 0.1, cx - size * 0.42, cy - size * 0.15);
    c.quadraticCurveTo(cx - size * 0.3, cy - size * 0.62, cx, cy - size * 0.62);
    c.quadraticCurveTo(cx + size * 0.3, cy - size * 0.62, cx + size * 0.42, cy - size * 0.15);
    c.quadraticCurveTo(cx + size * 0.5, cy + size * 0.1, cx + size * 0.62, cy + size * 0.35);
    c.closePath();
    c.stroke();
    c.beginPath(); // clapper
    c.arc(cx, cy + size * 0.52, size * 0.14, 0, Math.PI * 2);
    c.fill();
    c.beginPath(); // strike-through
    c.moveTo(cx - size * 0.8, cy + size * 0.7);
    c.lineTo(cx + size * 0.8, cy - size * 0.75);
    c.stroke();
    c.restore();
  }
}
