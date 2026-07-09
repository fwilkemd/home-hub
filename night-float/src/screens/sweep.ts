/**
 * SweepLane — classic patient-monitor sweep rendering: a persistent trace
 * canvas with a moving write head that erases a small gap ahead of itself
 * (the trace is never scroll-translated). Shared by the monitor and vent.
 */
const GAP_PX = 28;

export class SweepLane {
  readonly w: number;
  readonly h: number;
  color: string;
  lineWidth: number;
  glow: number;

  private trace: HTMLCanvasElement;
  private tcx: CanvasRenderingContext2D;
  private x = 0; // write-head position, px (float, wraps at w)
  private lastV: number | null = null;

  constructor(w: number, h: number, color: string, lineWidth = 2, glow = 5) {
    this.w = Math.max(8, Math.floor(w));
    this.h = Math.max(8, Math.floor(h));
    this.color = color;
    this.lineWidth = lineWidth;
    this.glow = glow;
    this.trace = document.createElement('canvas');
    this.trace.width = this.w;
    this.trace.height = this.h;
    const ctx = this.trace.getContext('2d');
    if (!ctx) throw new Error('no 2d context for sweep lane');
    this.tcx = ctx;
  }

  get headX(): number {
    return this.x;
  }

  clear(): void {
    this.tcx.clearRect(0, 0, this.w, this.h);
    this.lastV = null;
  }

  /** clearRect that wraps around the right edge. */
  private eraseSpan(from: number, len: number): void {
    const x0 = ((from % this.w) + this.w) % this.w;
    const first = Math.min(len, this.w - x0);
    this.tcx.clearRect(x0, 0, first, this.h);
    if (len - first > 0) this.tcx.clearRect(0, 0, len - first, this.h);
  }

  /**
   * Advance the write head from time t0 to t1, sampling `value01(t)` in 0..1
   * (0 = bottom of lane, 1 = top) once per pixel column.
   */
  advance(t0: number, t1: number, pxPerSec: number, value01: (t: number) => number): void {
    let dx = (t1 - t0) * pxPerSec;
    if (dx <= 0) return;
    if (dx >= this.w - GAP_PX) {
      // huge time jump — restart the sweep rather than looping many times
      this.clear();
      dx = 1;
      t0 = t1 - 1 / pxPerSec;
    }
    const c = this.tcx;
    // erase the strip we are about to draw plus the gap ahead of the head
    this.eraseSpan(this.x, dx + GAP_PX);

    c.save();
    c.strokeStyle = this.color;
    c.lineWidth = this.lineWidth;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.shadowColor = this.color;
    c.shadowBlur = this.glow;

    let px = this.x; // unwrapped position within this advance
    let pv = this.lastV;
    let remaining = dx;
    while (remaining > 0) {
      const step = Math.min(1, remaining);
      const nx = px + step;
      const tt = t1 - (remaining - step) / pxPerSec; // sample time at column nx
      const v = Math.min(1, Math.max(0, value01(tt)));
      const yNew = (1 - v) * (this.h - 4) + 2;
      const xOld = px % this.w;
      const xNew = nx % this.w;
      if (pv !== null && xNew > xOld) {
        const yOld = (1 - pv) * (this.h - 4) + 2;
        c.beginPath();
        c.moveTo(xOld, yOld);
        c.lineTo(xNew, yNew);
        c.stroke();
      }
      // when the head wraps (xNew <= xOld) we skip one segment: fresh start
      pv = v;
      px = nx;
      remaining -= step;
    }
    c.restore();
    this.x = px % this.w;
    this.lastV = pv;
  }

  /** Composite the persistent trace into a destination context. */
  blit(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
    ctx.drawImage(this.trace, dx, dy);
    // write head: a bright bar at the leading edge
    ctx.save();
    ctx.fillStyle = 'rgba(235,245,255,0.85)';
    ctx.fillRect(dx + Math.floor(this.x), dy + 1, 2, this.h - 2);
    ctx.restore();
  }
}
