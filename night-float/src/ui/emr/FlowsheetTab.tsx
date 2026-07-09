/**
 * Flowsheet tab: one canvas strip chart (HR / MAP+NIBP dots / SpO2 / RR over
 * the last 45 sim-minutes, wall-clock axis) + a compact numeric table.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useHub } from '../../bridge/store';
import type { FlowsheetPoint } from '../../contracts/runtime';
import { chooseTickStep, drawVitalSeries, setupCanvas, VITAL_SERIES, yFor } from '../canvas';
import { fmtNum, wallClock } from '../format';

const WINDOW_S = 45 * 60;
const STRIP_H = 250;

function drawFlowsheet(
  canvas: HTMLCanvasElement,
  cssW: number,
  data: readonly FlowsheetPoint[],
  simTime: number,
  clockStart: string,
): void {
  const ctx = setupCanvas(canvas, cssW, STRIP_H);
  if (!ctx) return;
  ctx.clearRect(0, 0, cssW, STRIP_H);

  const x0 = 8;
  const x1 = cssW - 8;
  const y0 = 8;
  const y1 = STRIP_H - 24;
  const t1 = Math.max(simTime, data.length > 0 ? data[data.length - 1].t : 0);
  const t0 = Math.max(0, t1 - WINDOW_S);
  const pts = data.filter((p) => p.t >= t0);

  // time grid + wall-clock labels
  const step = chooseTickStep(t1 - t0);
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) {
    const x = x0 + ((t - t0) / Math.max(1, t1 - t0)) * (x1 - x0);
    ctx.strokeStyle = 'rgba(38,48,73,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.fillStyle = '#5a657f';
    ctx.fillText(wallClock(clockStart, t, false), x, STRIP_H - 8);
  }
  ctx.strokeStyle = 'rgba(38,48,73,0.9)';
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

  if (pts.length === 0) {
    ctx.fillStyle = '#5a657f';
    ctx.textAlign = 'center';
    ctx.font = 'italic 12px Inter, sans-serif';
    ctx.fillText('No vitals recorded yet', cssW / 2, STRIP_H / 2);
    return;
  }

  const auto = pts.filter((p) => p.source === 'auto');
  drawVitalSeries(ctx, auto, VITAL_SERIES.hr, x0, x1, y0, y1, t0, t1);
  drawVitalSeries(ctx, auto, VITAL_SERIES.map, x0, x1, y0, y1, t0, t1);
  drawVitalSeries(ctx, auto, VITAL_SERIES.spo2, x0, x1, y0, y1, t0, t1);
  drawVitalSeries(ctx, auto, VITAL_SERIES.rr, x0, x1, y0, y1, t0, t1);

  // NIBP measurements: MAP dot + sbp/dbp whisker
  for (const p of pts) {
    if (p.source !== 'nibp') continue;
    const x = x0 + ((p.t - t0) / Math.max(1, t1 - t0)) * (x1 - x0);
    const spec = VITAL_SERIES.map;
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yFor(p.sbp, spec, y0, y1));
    ctx.lineTo(x, yFor(p.dbp, spec, y0, y1));
    ctx.stroke();
    ctx.fillStyle = spec.color;
    ctx.beginPath();
    ctx.arc(x, yFor(p.map, spec, y0, y1), 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

const LEGEND: { label: string; color: string; range: string }[] = [
  { label: 'HR', color: VITAL_SERIES.hr.color, range: '0–180' },
  { label: 'MAP + NIBP', color: VITAL_SERIES.map.color, range: '0–140' },
  { label: 'SpO2', color: VITAL_SERIES.spo2.color, range: '50–100' },
  { label: 'RR', color: VITAL_SERIES.rr.color, range: '0–50' },
];

export function FlowsheetTab() {
  const flowsheet = useHub((s) => s.flowsheet);
  const simTime = useHub((s) => s.simTime);
  const clockStart = useHub((s) => s.clockStart);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef({ flowsheet, simTime, clockStart });
  dataRef.current = { flowsheet, simTime, clockStart };

  const redraw = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const d = dataRef.current;
    drawFlowsheet(canvas, Math.max(200, wrap.clientWidth - 12), d.flowsheet, d.simTime, d.clockStart);
  }, []);

  // Redraw on data change (render-driven) and on container resize.
  useEffect(() => {
    redraw();
  });
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(redraw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  const lastRows = flowsheet.slice(-10).reverse();

  return (
    <div>
      <div className="legend">
        {LEGEND.map((l) => (
          <span key={l.label} className="key">
            <span className="swatch" style={{ background: l.color }} />
            {l.label} <span className="mono">{l.range}</span>
          </span>
        ))}
      </div>
      <div ref={wrapRef} className="stripwrap">
        <canvas ref={canvasRef} />
      </div>

      <section>
        <h3>Recent readings</h3>
        {lastRows.length === 0 && <p className="empty">Nothing charted yet.</p>}
        {lastRows.length > 0 && (
          <table className="table mono">
            <thead>
              <tr>
                <th>Time</th>
                <th>HR</th>
                <th>BP (MAP)</th>
                <th>SpO2</th>
                <th>RR</th>
                <th>Temp</th>
                <th>Src</th>
              </tr>
            </thead>
            <tbody>
              {lastRows.map((p) => (
                <tr key={p.t + p.source}>
                  <td>{wallClock(clockStart, p.t, false)}</td>
                  <td>{Math.round(p.hr)}</td>
                  <td>
                    {Math.round(p.sbp)}/{Math.round(p.dbp)} ({Math.round(p.map)})
                  </td>
                  <td>{Math.round(p.spo2)}%</td>
                  <td>{Math.round(p.rr)}</td>
                  <td>{fmtNum(p.tempC)}</td>
                  <td className="dim">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
