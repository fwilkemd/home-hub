const $ = (id) => document.getElementById(id)

const LEAF_SVG = (seed) => {
  const pts = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, w = 14 + 22 * Math.sin(t * Math.PI) * (i % 2 ? 1 : 0.6) + Math.sin(seed + i) * 3
    pts.push([50 + w, 8 + t * 84])
  }
  const left = pts.map(([x, y]) => [100 - x, y]).reverse()
  const d = 'M50,6 ' + pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' ' + left.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z'
  let veins = ''
  for (let i = 1; i < 6; i++) { const y = 14 + i * 14; veins += `<path d="M50,${y} L${50 + 12 + i * 3},${y + 10}" /><path d="M50,${y} L${50 - 12 - i * 3},${y + 10}" />` }
  return `<svg viewBox="0 0 100 100"><g fill="none" stroke="#5a4634" stroke-width="1.2" opacity="0.8"><path d="${d}" fill="rgba(90,70,52,0.12)"/><path d="M50,6 L50,94"/>${veins}</g></svg>`
}

export class Journal {
  constructor(input, ui) {
    this.input = input; this.ui = ui
    this.el = $('journal'); this.page = $('journal-page'); this.tabs = [...document.querySelectorAll('.journal-tabs button')]
    this.entries = { journal: [], ledger: [], leaves: [] }
    this.tab = 'journal'; this.index = 0; this.open = false; this.enabled = false
    this.tabs.forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)))
    input.on('KeyJ', () => this.enabled && !this.blocked && this.toggle())
    input.on('Escape', () => this.open && this.toggle())
    input.on('ArrowRight', () => this.open && this.nav(1)); input.on('ArrowLeft', () => this.open && this.nav(-1))
    input.on('KeyD', () => this.open && this.nav(1)); input.on('KeyA', () => this.open && this.nav(-1))
  }
  add(tab, entry) {
    this.entries[tab].push(entry)
    if (this.enabled && !this.open) this.ui.hint(`${tab === 'ledger' ? 'ledger' : tab === 'leaves' ? 'leaf traced' : 'journal'} · new entry · J`)
    setTimeout(() => this.ui.hint(null), 4200)
  }
  toggle() {
    this.open = !this.open
    this.el.classList.toggle('on', this.open)
    if (this.open) { this.input.unlock(); this.render() } else this.input.lock()
    this.onToggle && this.onToggle(this.open)
  }
  setTab(t) { this.tab = t; this.index = this.entries[t].length - 1; this.tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === t)); this.render() }
  nav(d) { const n = this.entries[this.tab].length; if (!n) return; this.index = (this.index + d + n) % n; this.render() }
  render() {
    const list = this.entries[this.tab]
    if (this.tab === 'leaves') {
      this.page.innerHTML = list.length ? `<h3>leaf tracings · a little family which just keeps growing</h3><div class="leaves">${list.map((l, i) => `<div class="leaf">${LEAF_SVG(i * 1.7)}<span>${l.name}</span></div>`).join('')}</div>` : `<p class="empty">No tracings yet. Find a leaf worth keeping.</p>`
      $('journal-nav').textContent = ''
      return
    }
    if (!list.length) { this.page.innerHTML = `<p class="empty">${this.tab === 'ledger' ? 'The file is empty. It fills as the day does.' : 'Nothing written yet.'}</p>`; $('journal-nav').textContent = ''; return }
    if (this.index < 0 || this.index >= list.length) this.index = list.length - 1
    const e = list[this.index]
    $('journal-nav').textContent = `${this.index + 1} / ${list.length} · ← →`
    if (this.tab === 'ledger') this.page.innerHTML = `<h3>${e.title}</h3><div class="doc">${e.text}${e.sig ? `<span class="sig">${e.sig}</span>` : ''}</div>`
    else this.page.innerHTML = `<h3>${e.title}</h3><div class="hand">${e.text}</div>`
  }
}
