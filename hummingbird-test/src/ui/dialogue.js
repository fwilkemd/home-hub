import { wait } from './ui.js'
const $ = (id) => document.getElementById(id)

// A script is an array of nodes:
//   { who: 'Jay' | 'Ananelia' | 'inner', text, choices?: [{ text, venom?, heat?, then?: [nodes] }], hold? }
// Nodes run in order; a chosen `then` list is spliced in before the rest.
export class Dialogue {
  constructor(input, state) {
    this.input = input; this.state = state
    this.box = $('dialogue'); this.speaker = $('dlg-speaker'); this.line = $('dlg-line'); this.choices = $('dlg-choices'); this.cont = $('dlg-continue')
    this.active = false
  }
  async run(script, { auto = false } = {}) {
    this.active = true
    this.box.classList.add('on')
    const queue = script.slice()
    while (queue.length) {
      const node = queue.shift()
      if (typeof node === 'function') { const r = node(this.state); if (Array.isArray(r)) queue.unshift(...r); else if (r && r.who) queue.unshift(r); continue }
      await this.show(node, auto)
      if (node.choices) {
        const c = await this.choose(node.choices)
        if (c.heat) this.state.heat = (this.state.heat || 0) + c.heat
        if (c.venom) this.state.venom = (this.state.venom || 0) + 1
        if (c.flag) this.state.flags[c.flag] = true
        if (c.then) queue.unshift(...c.then)
      }
    }
    this.box.classList.remove('on')
    this.active = false
    await wait(300)
  }
  async show(node, auto) {
    const inner = node.who === 'inner'
    this.speaker.textContent = inner ? '' : node.who
    this.speaker.classList.toggle('inner', inner)
    this.line.classList.toggle('inner', inner)
    this.line.style.opacity = 0
    await wait(120)
    this.line.innerHTML = node.text
    this.line.style.transition = 'opacity 0.45s'
    this.line.style.opacity = 1
    this.choices.innerHTML = ''
    this.cont.classList.remove('on')
    if (node.choices) return
    const minHold = node.hold ?? Math.min(2600, 500 + node.text.length * 22)
    if (auto) { await wait(minHold + 500); return }
    await wait(Math.min(minHold, 700))
    this.cont.classList.add('on')
    await this.anyKey()
    this.cont.classList.remove('on')
  }
  anyKey() {
    return new Promise((res) => {
      const offs = ['Space', 'KeyE', 'Enter'].map((c) => this.input.on(c, () => { offs.forEach((o) => o()); res() }))
    })
  }
  choose(choices) {
    return new Promise((res) => {
      const offs = []
      const done = (c) => { offs.forEach((o) => o()); this.choices.innerHTML = ''; res(c) }
      choices.forEach((c, i) => {
        const el = document.createElement('div')
        el.className = 'choice' + (c.venom ? ' venom' : '')
        el.innerHTML = `<span class="n">${i + 1}</span>${c.text}`
        el.addEventListener('click', () => done(c))
        this.choices.appendChild(el)
        offs.push(this.input.on(`Digit${i + 1}`, () => done(c)))
      })
    })
  }
}
