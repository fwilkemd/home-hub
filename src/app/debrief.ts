import type { SimEngine } from '../sim/engine'

/**
 * Flat DOM debrief page shown after an endpoint or the time limit: outcome,
 * vitals-over-time canvas chart (no chart library), interleaved action
 * timeline, and a session-log JSON export for the content-authoring workflow.
 */
export function showDebrief(engine: SimEngine, onRestart: () => void): void {
  const ended = engine.ended
  const kind = ended?.kind ?? 'timeout'
  const color = kind === 'success' ? '#3ce06a' : kind === 'fail' ? '#ff6b57' : '#ffb54a'

  const root = document.createElement('div')
  root.id = 'debrief'
  root.innerHTML = `
    <style>
      #debrief { position: fixed; inset: 0; overflow-y: auto; background: #0b0e11; color: #dbe3e8;
                 font-family: system-ui, sans-serif; padding: 32px 24px 64px; z-index: 30; }
      #debrief .inner { max-width: 940px; margin: 0 auto; }
      #debrief h1 { font-size: 28px; margin: 0 0 4px; color: ${color}; }
      #debrief h2 { font-size: 15px; letter-spacing: .08em; color: #8aa0ab; margin: 36px 0 12px; }
      #debrief .meta { color: #8aa0ab; font-size: 14px; }
      #debrief canvas { width: 100%; height: auto; background: #04070a; border: 1px solid #1d2b33; border-radius: 6px; }
      #debrief .timeline { font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.85; }
      #debrief .timeline .tt { color: #8aa0ab; }
      #debrief .timeline .order { color: #3ad2e8; }
      #debrief .timeline .event { color: #ffb54a; }
      #debrief .timeline .alarm { color: #ff6b57; }
      #debrief .timeline .endpoint { color: ${color}; font-weight: 700; }
      #debrief button { background: #1e313c; color: #e8f1f5; border: 1px solid #2f4d5e; border-radius: 6px;
                        padding: 10px 18px; font-size: 14px; cursor: pointer; margin-right: 12px; }
      #debrief button:hover { background: #2f4d5e; }
      #debrief .legend span { display: inline-block; margin-right: 18px; font-size: 13px; }
    </style>
    <div class="inner">
      <h1>${ended ? `${kind.toUpperCase()} — ${escapeHtml(ended.label)}` : 'Session ended'}</h1>
      <div class="meta">${escapeHtml(engine.scenario.title)} · ${fmtTime(engine.time)} elapsed ·
        ${engine.log.filter((l) => l.type === 'order').length} orders · seed ${engine.seed}</div>
      <h2>ACTIONS</h2>
      <p><button id="db-export">Export session log</button><button id="db-restart">Back to scenarios</button></p>
      <h2>VITALS OVER TIME</h2>
      <div class="legend" id="db-legend"></div>
      <canvas id="db-chart" width="1800" height="640"></canvas>
      <h2>TIMELINE</h2>
      <div class="timeline" id="db-timeline"></div>
    </div>`
  document.body.appendChild(root)

  drawChart(root.querySelector('#db-chart')!, root.querySelector('#db-legend')!, engine)
  renderTimeline(root.querySelector('#db-timeline')!, engine)

  root.querySelector('#db-export')!.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(engine.exportSession(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `icu-sim-log-${engine.scenario.id}-seed${engine.seed}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  })
  root.querySelector('#db-restart')!.addEventListener('click', onRestart)
}

const SERIES = [
  { key: 'hr', label: 'HR', color: '#3ce06a' },
  { key: 'map', label: 'MAP', color: '#ff8f4a' },
  { key: 'spo2', label: 'SpO2', color: '#3ad2e8' },
  { key: 'rr', label: 'RR', color: '#e8d13a' },
] as const

function drawChart(canvas: HTMLCanvasElement, legend: HTMLElement, engine: SimEngine): void {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width
  const H = canvas.height
  const m = { l: 70, r: 20, t: 20, b: 46 }
  const history = engine.history
  const tMax = Math.max(history.at(-1)?.t ?? 1, 60)
  const vMax = 200

  ctx.fillStyle = '#04070a'
  ctx.fillRect(0, 0, W, H)

  const x = (t: number) => m.l + ((W - m.l - m.r) * t) / tMax
  const y = (v: number) => H - m.b - ((H - m.t - m.b) * Math.min(v, vMax)) / vMax

  // Gridlines + axes labels
  ctx.strokeStyle = '#152028'
  ctx.fillStyle = '#8aa0ab'
  ctx.font = '20px ui-monospace, monospace'
  ctx.textAlign = 'right'
  for (let v = 0; v <= vMax; v += 40) {
    ctx.beginPath()
    ctx.moveTo(m.l, y(v))
    ctx.lineTo(W - m.r, y(v))
    ctx.stroke()
    ctx.fillText(String(v), m.l - 8, y(v) + 6)
  }
  ctx.textAlign = 'center'
  const minuteStep = Math.max(60, Math.ceil(tMax / 60 / 10) * 60)
  for (let t = 0; t <= tMax; t += minuteStep) {
    ctx.beginPath()
    ctx.moveTo(x(t), m.t)
    ctx.lineTo(x(t), H - m.b)
    ctx.stroke()
    ctx.fillText(`${t / 60}m`, x(t), H - m.b + 28)
  }

  // Order markers
  ctx.strokeStyle = '#2f4d5e'
  for (const entry of engine.log) {
    if (entry.type !== 'order') continue
    ctx.beginPath()
    ctx.moveTo(x(entry.t), m.t)
    ctx.lineTo(x(entry.t), H - m.b)
    ctx.stroke()
  }

  // Series
  const step = Math.max(1, Math.floor(history.length / 1200))
  for (const s of SERIES) {
    ctx.strokeStyle = s.color
    ctx.lineWidth = 2.5
    ctx.beginPath()
    let started = false
    for (let i = 0; i < history.length; i += step) {
      const sample = history[i]!
      const v = sample.values[s.key]
      if (v === undefined) continue
      if (!started) {
        ctx.moveTo(x(sample.t), y(v))
        started = true
      } else {
        ctx.lineTo(x(sample.t), y(v))
      }
    }
    ctx.stroke()
  }

  legend.innerHTML = SERIES.map((s) => `<span style="color:${s.color}">— ${s.label}</span>`).join('')
}

function renderTimeline(el: HTMLElement, engine: SimEngine): void {
  const rows: string[] = []
  for (const entry of engine.log) {
    const cls =
      entry.type === 'order' || entry.type === 'orderActive' || entry.type === 'infusionStopped' ? 'order'
      : entry.type === 'event' ? 'event'
      : entry.type.startsWith('alarm') ? 'alarm'
      : entry.type === 'endpoint' ? 'endpoint'
      : ''
    if (['exam'].includes(entry.type)) continue
    const who = entry.type === 'message' ? `${escapeHtml(entry.ref ?? '')}: ` : ''
    rows.push(
      `<div><span class="tt">${fmtTime(entry.t)}</span>  <span class="${cls}">[${entry.type}]</span> ${who}${escapeHtml(entry.text)}</div>`,
    )
  }
  el.innerHTML = rows.join('') || '<div>No entries.</div>'
}

function fmtTime(t: number): string {
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
