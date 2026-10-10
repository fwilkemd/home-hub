const $ = (id) => document.getElementById(id)
const SPEED = new URLSearchParams(location.search).has('fast') ? 0.12 : 1 // ?fast shortens scripted waits (testing)
const wait = (ms) => new Promise((r) => setTimeout(r, ms * SPEED))

export class UI {
  constructor(input) {
    this.input = input
    this.el = {
      hud: $('hud'), objective: $('objective'), kicker: $('objective-kicker'), otext: $('objective-text'),
      stamina: $('stamina'), staminaFill: $('stamina-fill'), light: $('light-left'), prompt: $('prompt'), promptKey: $('prompt-key'), promptText: $('prompt-text'), hint: $('hint'),
      letterbox: $('letterbox'), vision: $('vision'), scratches: $('scratches'), fade: $('fade'),
      chapter: $('chapter'), chapterKicker: $('chapter-kicker'), chapterText: $('chapter-text'),
      interlude: $('interlude'), interludeText: $('interlude-text'), interludeContinue: $('interlude-continue'),
      pause: $('pause'),
    }
  }
  hud(on) { this.el.hud.classList.toggle('on', on) }
  objective(kicker, text) {
    const o = this.el.objective
    if (!text) { o.classList.remove('on'); return }
    o.classList.remove('on')
    setTimeout(() => { this.el.kicker.textContent = kicker; this.el.otext.textContent = text; o.classList.add('on') }, 350)
  }
  stamina(v, burning, visible) {
    this.el.stamina.classList.toggle('on', visible); this.el.stamina.classList.toggle('burning', burning)
    this.el.staminaFill.style.width = `${Math.round(v * 100)}%`
  }
  lightLeft(text) { this.el.light.classList.toggle('on', !!text); if (text) this.el.light.textContent = text }
  prompt(text, key = 'E') { this.el.prompt.classList.toggle('on', !!text); if (text) { this.el.promptText.textContent = text; this.el.promptKey.textContent = key } }
  hint(text) { this.el.hint.classList.toggle('on', !!text); if (text) this.el.hint.textContent = text }
  letterbox(on) { this.el.letterbox.classList.toggle('on', on) }
  vision(mode) { this.el.vision.className = 'vision' + (mode ? ' ' + mode : '') }
  scratches(on) { this.el.scratches.classList.toggle('on', on) }
  async fade(toBlack, fast = false) {
    this.el.fade.classList.toggle('fast', fast)
    this.el.fade.classList.toggle('clear', !toBlack)
    await wait(fast ? 450 : 1700)
  }
  async chapter(kicker, text, hold = 2600) {
    this.el.chapterKicker.textContent = kicker; this.el.chapterText.textContent = text
    this.el.chapter.classList.add('on'); await wait(hold); this.el.chapter.classList.remove('on'); await wait(1200)
  }
  interlude(html, showContinue) {
    this.el.interlude.classList.toggle('on', !!html)
    if (html) this.el.interludeText.innerHTML = html
    this.el.interludeContinue.classList.toggle('on', !!showContinue)
  }
  pause(on) { this.el.pause.classList.toggle('on', on) }
  // resolve on the next press of any of these keys
  key(codes = ['Space']) {
    return new Promise((res) => {
      const offs = codes.map((c) => this.input.on(c, () => { offs.forEach((o) => o()); res(c) }))
    })
  }
}
export { wait }
