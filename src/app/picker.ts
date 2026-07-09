import { ContentValidationError, parseScenario, type ScenarioData } from '../sim/schema'

export interface ScenarioEntry {
  file: string
  scenario?: ScenarioData
  error?: string
}

/** Load + validate every scenario JSON bundled under /content/scenarios. */
export function loadScenarioEntries(): ScenarioEntry[] {
  const modules = import.meta.glob('../../content/scenarios/*.json', { eager: true, import: 'default' })
  return Object.entries(modules).map(([path, raw]) => {
    const file = path.split('/').at(-1) ?? path
    try {
      return { file, scenario: parseScenario(raw, file) }
    } catch (err) {
      return { file, error: err instanceof ContentValidationError ? err.message : String(err) }
    }
  })
}

/**
 * Pre-VR DOM page: pick a scenario, then the scene starts and the VR button
 * appears. Invalid content files are listed with their validation errors —
 * bad content fails loudly, never silently.
 */
export function showPicker(entries: ScenarioEntry[], fatalError: string | null, onPick: (s: ScenarioData) => void): void {
  const root = document.createElement('div')
  root.id = 'picker'
  root.innerHTML = `
    <style>
      #picker { position: fixed; inset: 0; overflow-y: auto; background: #0b0e11; color: #dbe3e8;
                font-family: system-ui, sans-serif; padding: 48px 24px; z-index: 20; }
      #picker .inner { max-width: 760px; margin: 0 auto; }
      #picker h1 { font-size: 26px; margin: 0; letter-spacing: .02em; }
      #picker .sub { color: #8aa0ab; font-size: 14px; margin: 6px 0 28px; }
      #picker .card { display: block; width: 100%; text-align: left; background: #101a20; color: #e8f1f5;
                      border: 1px solid #27404c; border-radius: 8px; padding: 16px 18px; margin-bottom: 14px;
                      font-size: 16px; cursor: pointer; }
      #picker .card:hover { background: #1e313c; border-color: #3ad2e8; }
      #picker .card .id { color: #8aa0ab; font-size: 13px; font-family: ui-monospace, monospace; margin-top: 4px; }
      #picker .bad { border-color: #ff6b57; cursor: default; }
      #picker .bad:hover { background: #101a20; border-color: #ff6b57; }
      #picker .bad pre { color: #ff9a8b; font-size: 12px; white-space: pre-wrap; margin: 8px 0 0; }
      #picker .fatal { border: 1px solid #ff6b57; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px; }
      #picker .fatal pre { color: #ff9a8b; font-size: 12px; white-space: pre-wrap; }
    </style>
    <div class="inner">
      <h1>ICU VR SIMULATOR</h1>
      <div class="sub">Pick a scenario, then enter VR (or explore flat: click to look, WASD to move).</div>
      <div id="picker-list"></div>
    </div>`
  document.body.appendChild(root)

  const list = root.querySelector('#picker-list')!
  if (fatalError) {
    const div = document.createElement('div')
    div.className = 'fatal'
    div.innerHTML = `<strong>interventions.json failed validation — fix it to continue.</strong><pre></pre>`
    div.querySelector('pre')!.textContent = fatalError
    list.appendChild(div)
    return
  }

  for (const entry of entries) {
    if (entry.scenario) {
      const s = entry.scenario
      const btn = document.createElement('button')
      btn.className = 'card'
      btn.innerHTML = `<div>${escapeHtml(s.title)}</div>
        <div class="id">${escapeHtml(entry.file)} · ${s.timeLimitSec ? `${Math.round(s.timeLimitSec / 60)} min limit` : 'no time limit'}${s.arterialLine ? '' : ' · NIBP cycling'}</div>`
      btn.addEventListener('click', () => {
        root.remove()
        onPick(s)
      })
      list.appendChild(btn)
    } else {
      const div = document.createElement('div')
      div.className = 'card bad'
      div.innerHTML = `<div>${escapeHtml(entry.file)} — failed validation</div><pre></pre>`
      div.querySelector('pre')!.textContent = entry.error ?? 'unknown error'
      list.appendChild(div)
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
