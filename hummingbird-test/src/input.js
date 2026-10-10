export class Input {
  constructor(canvas) {
    this.keys = new Set()
    this.dx = 0; this.dy = 0
    this.locked = false
    this.handlers = {}
    this.canvas = canvas
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.keys.add(e.code)
      const h = this.handlers[e.code]; if (h) h.forEach((fn) => fn(e))
      if (['Space', 'KeyE', 'KeyJ'].includes(e.code)) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())
    document.addEventListener('mousemove', (e) => { if (this.locked) { this.dx += e.movementX; this.dy += e.movementY } })
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; if (!this.locked) this.keys.clear() })
  }
  on(code, fn) { (this.handlers[code] ||= []).push(fn); return () => { this.handlers[code] = this.handlers[code].filter((f) => f !== fn) } }
  down(code) { return this.keys.has(code) }
  consumeMouse() { const d = [this.dx, this.dy]; this.dx = 0; this.dy = 0; return d }
  lock() { if (!this.locked) { try { const r = this.canvas.requestPointerLock?.(); r?.catch?.(() => {}) } catch (e) { /* no pointer lock here */ } } }
  unlock() { if (this.locked) document.exitPointerLock?.() }
}
