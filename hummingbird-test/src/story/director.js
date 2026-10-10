import * as THREE from 'three'
import { L, TRAIL, heightAt } from '../world/terrain.js'
import { SCRIPTS, LEDGER, JOURNAL } from './data.js'
import { makeGolfBall, makeFrog, makeLeaf, buildGolfBag } from '../world/props.js'
import { wait } from '../ui/ui.js'

const V = (x, z) => new THREE.Vector3(x, 0, z)   // ground point
const P = (x, y, z) => new THREE.Vector3(x, y, z) // 3D offset
const inject = (script, idx, fn) => { const s = script.slice(); s.splice(idx, 0, fn); return s }

// The day, in order. Each beat sets up its own starting state so you can jump straight to it (?beat=dusk).
export const BEATS = ['car', 'trail', 'weed', 'oak', 'frog', 'dusk', 'bramble', 'alley', 'moon']
// What earlier beats would have put in the journal, applied when jumping ahead.
const UNLOCKS = {
  trail: ['note:moo', 'ledger:intake'], weed: ['ledger:hartToMercer', 'ledger:mercerToHart'],
  oak: [], frog: ['note:spiral', 'leaf:oak · meadow', 'note:ancestree'], dusk: ['note:sawA'], bramble: [], alley: [], moon: [],
}

export class Director {
  constructor(world) {
    this.w = world
    this.state = world.state
    this.hot = null; this.goal = null
    this.balls = []
    this.ended = false
    world.input.on('KeyE', () => {
      if (this.hot && !this.w.dialogue.active && !this.w.journal.open && this.hot.near) { const r = this.hot.resolve; this.hot = null; this.w.ui.prompt(null); r() }
    })
  }
  // ---- helpers ----
  get p() { return this.w.player }
  get jay() { return this.w.jay }
  get ui() { return this.w.ui }
  lock(v) { this.p.locked = v; if (v) this.p.vel.set(0, 0, 0) }
  cine(pos, look, k = 1.5, snap = false) { this.p.cine = { pos: pos.clone(), look: look.clone(), k }; if (snap) this.p.snapCamera() }
  freeCam() { this.p.cine = null; this.p.camYaw = this.p.yaw + Math.PI; this.p.camPitch = 0.18 }
  say(script, opts) { return this.w.dialogue.run(script, opts) }
  objective(kicker, text) { this.ui.objective(kicker, text) }
  walkTo(pos, r) { return new Promise((resolve) => { this.goal = { pos, r, resolve } }) }
  interact(pos, r, text, key = 'E') { return new Promise((resolve) => { this.hot = { pos, r, text, key, resolve, near: false } }) }
  dist(pos) { return Math.hypot(this.p.pos.x - pos.x, this.p.pos.z - pos.z) }
  ledger(k) { this.w.journal.add('ledger', LEDGER[k]) }
  note(k) { this.w.journal.add('journal', JOURNAL[k]) }
  unlock(tag) { const [t, k] = tag.split(':'); if (t === 'note') this.note(k); else if (t === 'ledger') this.ledger(k); else this.w.journal.add('leaves', { name: k }) }
  async hitBall() {
    await this.jay.swing()
    const b = makeGolfBall(); this.w.scene.add(b)
    const from = this.jay.pos.clone().add(P(0, 0.1, 0))
    const a = Math.random() * 6.28
    const hit = Math.random() < 0.6
    const to = hit ? L.oak.clone().add(P(Math.cos(a) * 1.6, 2 + Math.random() * 6, Math.sin(a) * 1.6)) : L.oak.clone().add(P((Math.random() - 0.5) * 30, 0.1, (Math.random() - 0.5) * 30))
    to.y = hit ? to.y : heightAt(to.x, to.z) + 0.05
    this.balls.push({ mesh: b, from, to, t: 0, dur: 0.9, hit })
    this.p.shake = Math.max(this.p.shake, hit ? 0.05 : 0.02)
  }
  startGolf() {
    const jay = this.jay
    jay.visible = true; jay.place(L.golf.x, L.golf.z, Math.atan2(L.oak.x - L.golf.x, L.oak.z - L.golf.z)); jay.pose = 'golf'
    if (!this.bag) this.bag = buildGolfBag(this.w.scene, L.golf.clone().add(V(1.4, 0.6)))
    if (!this.golfLoop) this.golfLoop = (async () => { while (!this.ended) { await wait(5000 + Math.random() * 5000); if (jay.pose === 'golf' && jay.visible) this.hitBall() } })()
  }
  // ---- per-frame ----
  update(dt) {
    const w = this.w
    if (this.goal) { if (this.dist(this.goal.pos) < this.goal.r) { const g = this.goal; this.goal = null; g.resolve() } }
    if (this.hot) {
      const near = this.dist(this.hot.pos) < this.hot.r
      this.hot.near = near
      this.ui.prompt(near && !w.dialogue.active && !w.journal.open ? this.hot.text : null, this.hot.key)
    }
    this.ui.stamina(this.p.stamina, this.p.burning, !this.p.locked && !w.dialogue.active)
    // the oak and the car are solid
    for (const [c, r] of [[L.oak, 2.3], [L.car, 2.6]]) {
      const dx = this.p.pos.x - c.x, dz = this.p.pos.z - c.z, d = Math.hypot(dx, dz)
      if (d < r && d > 0.001) { this.p.pos.x = c.x + (dx / d) * r; this.p.pos.z = c.z + (dz / d) * r }
    }
    // bramble drag
    const inB = w.bramble.inside(this.p.pos.x, this.p.pos.z)
    this.p.speedMul = inB ? 0.32 : 1
    this.ui.scratches(inB)
    if (inB && this.p.speed > 0.2) this.p.shake = Math.max(this.p.shake, 0.03)
    // golf balls
    for (const b of this.balls) {
      b.t += dt; const k = Math.min(1, b.t / b.dur)
      b.mesh.position.lerpVectors(b.from, b.to, k); b.mesh.position.y += Math.sin(k * Math.PI) * 6
      if (k >= 1 && b.hit && !b.dropped) { b.dropped = true; b.to.set(b.to.x + (Math.random() - 0.5) * 3, heightAt(b.to.x, b.to.z) + 0.05, b.to.z + 2 + Math.random() * 3); b.from.copy(b.mesh.position); b.t = 0; b.dur = 0.5; b.hit = false }
    }
    if (this.balls.length > 24) { const b = this.balls.shift(); w.scene.remove(b.mesh) }
    if (this.lightTimer) {
      const t = w.sky.t, mins = Math.max(0, Math.round(((0.75 - t) / 0.13) * 95))
      this.ui.lightLeft(mins > 0 ? `light left · ${Math.floor(mins / 60) ? Math.floor(mins / 60) + 'h ' : ''}${mins % 60}m` : 'dark')
    }
  }

  // ================= the day =================
  async run(from = 'car') {
    const start = Math.max(0, BEATS.indexOf(from))
    const w = this.w
    w.ui.hud(true)
    if (start > 0) {
      for (let i = 1; i <= start; i++) UNLOCKS[BEATS[i]].forEach((t) => this.unlock(t))
      w.journal.enabled = true
      this.p.obj.visible = true
    }
    for (let i = start; i < BEATS.length; i++) await this[`beat_${BEATS[i]}`](i === start)
    // ---- after the day: free roam ----
    const ui = this.ui, p = this.p
    p.poseOverride = null; this.freeCam(); this.lock(false)
    w.hummingbird.hover(L.riparian.clone().add(P(0, 1.2, 0)))
    this.objective('after', 'The riparian patch is upstream. She feels thataways. (the day is over; wander, or read the ledger)')
    await this.walkTo(L.riparian, 5)
    this.lock(true); ui.letterbox(true)
    this.cine(p.pos.clone().add(P(-2, 1.4, 2)), L.riparian.clone().add(P(0, 1.4, 1.2)), 0.8)
    await this.say([{ who: 'inner', text: 'Weren’t till the third time I heard her from a tree. Weren’t till the fifth she heard me.' }, { who: 'inner', text: 'Only on the very last day did melody go both ways. Me to her and her to me.' }])
    await ui.chapter('thank you', 'That is the whole of the prototype. Act 1 continues on the page.', 5000)
    this.ended = true
    ui.letterbox(false); this.freeCam(); this.lock(false)
    this.objective('free roam', 'Wander the meadow by moonlight. Esc to pause.')
  }

  async beat_car() {
    const w = this.w, ui = this.ui, p = this.p, jay = this.jay, car = w.car
    ui.letterbox(true)
    w.sky.setTime(0, true)
    this.lock(true)
    p.obj.visible = false; jay.visible = false
    // the car noses into the wood
    car.position.z = L.car.z + 22; car.position.y = heightAt(car.position.x, car.position.z)
    const camPos = () => car.position.clone().add(P(1.6, 1.9, 7.5)), camLook = () => car.position.clone().add(P(0, 1.2, -12))
    this.cine(camPos(), camLook(), 2, true)
    await ui.chapter('Act 1', 'of mountains & meadows, today', 3000)
    await ui.fade(false)
    const z0 = car.position.z, t0 = performance.now()
    const drive = (async () => { while (car.position.z > L.car.z) { await wait(16); const k = Math.min(1, (performance.now() - t0) / 9000); car.position.z = z0 + (L.car.z - z0) * k; car.position.y = heightAt(car.position.x, car.position.z); this.p.cine.pos.copy(camPos()); this.p.cine.look.copy(camLook()) } })()
    await this.say(SCRIPTS.car)
    await drive
    car.position.y = heightAt(L.car.x, L.car.z)
    // the golden flit across the dash
    await w.hummingbird.dart(car.position.clone().add(P(3, 1.5, -2.4)), car.position.clone().add(P(-4, 1.6, -2.2)), 0.9)
    ui.vision('white'); await wait(200); ui.vision('')
    this.cine(car.position.clone().add(P(-5.5, 2.2, -3)), car.position.clone().add(P(0, 1.2, 0)), 1.2)
    await this.say(SCRIPTS.meadow)
    // Jay tears out of the car
    jay.visible = true; jay.place(car.position.x - 1.3, car.position.z - 0.5, Math.PI)
    jay.goTo(TRAIL.slice(0, 6), 4.8).then(() => { jay.visible = false })
    await wait(2600)
    ui.letterbox(false)
  }

  async beat_trail(entry) {
    const w = this.w, ui = this.ui, p = this.p, car = w.car
    w.sky.setTime(0, entry)
    p.obj.visible = true
    p.setPosition(car.position.x + 1.35, car.position.z - 0.3, Math.PI)
    if (entry) await ui.fade(false)
    this.freeCam(); this.lock(false)
    this.objective('the car', 'Jay left the engine running.')
    await this.interact(car.position.clone().add(P(-1.3, 0, -0.4)), 2.2, 'Turn the keys')
    this.lock(true); await this.say(SCRIPTS.keys); this.lock(false)
    this.note('moo'); w.journal.enabled = true
    // the lock ritual
    this.objective('the car', 'Lock the car.')
    const words = ['Lock the car', 'Lock it again', 'Once more', 'Just to be sure', 'Try not to count']
    for (let i = 0; i < words.length; i++) await this.interact(car.position.clone().add(P(1.6, 0, -0.4)), 3.5, words[i])
    ui.hint('you pressed LOCK five times'); setTimeout(() => ui.hint(null), 3000)
    // the trail
    this.objective('find jay', 'She left a path through the grass. It won’t pick one direction.')
    this.ledger('intake')
    await this.walkTo(L.pondRest, 5)
    this.objective('the pond', 'Breath. Rest by the water.')
    await this.interact(L.pondRest, 3.2, 'Squat by the water')
    this.lock(true); p.poseOverride = 'crouch'
    this.cine(L.pondRest.clone().add(P(4, 1.2, 3)), L.pondRest.clone().add(P(0, 0.9, -4)), 1.2)
    p.stamina = Math.min(p.stamina, 0.15); p.burning = true
    await this.say(SCRIPTS.pond)
    this.ledger('hartToMercer'); this.ledger('mercerToHart')
    p.poseOverride = null; this.freeCam(); this.lock(false)
  }

  async beat_weed(entry) {
    const w = this.w, ui = this.ui, p = this.p, jay = this.jay
    if (entry) { w.sky.setTime(0.1, true); p.setPosition(-40, 76, 0.4); this.freeCam(); this.lock(false); await ui.fade(false) }
    jay.visible = true; jay.place(L.weed.x, L.weed.z, 0); jay.pose = 'spin'
    this.objective('find jay', 'Look – across the meadow, morning light’s picked up her shine.')
    await this.walkTo(L.weed, 7)
    this.lock(true); ui.letterbox(true)
    jay.face(p.pos)
    this.cine(p.pos.clone().add(P(-3, 1.8, 3)), L.weed.clone().add(P(0, 1.2, 0)), 1.2)
    w.sky.setTime(0.2)
    const weed = inject(SCRIPTS.weed, 6, () => { jay.pose = 'idle' })
    await this.say(weed)
    // the episode
    ui.vision('half'); await wait(1200)
    const epScript = inject(SCRIPTS.episode.slice(), 1, () => { ui.vision('black') })
    await this.say(epScript, { auto: true })
    await w.interlude.play('egg')
  }

  async beat_oak() {
    const w = this.w, ui = this.ui, p = this.p, jay = this.jay
    w.sky.setTime(0.42, true)
    p.setPosition(L.oakRest.x, L.oakRest.z, 0.6); p.poseOverride = 'lie'
    jay.place(L.oakRest.x + 1.1, L.oakRest.z + 0.9, 0); jay.pose = 'kneel'; jay.face(p.pos); jay.visible = true
    this.lock(true); ui.letterbox(true)
    this.cine(L.oakRest.clone().add(P(-2.4, 1.7, 2.8)), L.oakRest.clone().add(P(0.4, 0.5, 0)), 1.2, true)
    await ui.fade(false)
    const wake = inject(SCRIPTS.oakWake, 11, () => { jay.pose = 'sit'; jay.place(L.oak.x - 1.2, L.oak.z + 2.4, 0.4); p.poseOverride = 'sit'; p.setPosition(L.oak.x - 0.1, L.oak.z + 2.6, 0.2); this.cine(L.oak.clone().add(P(-2, 1.4, 7)), L.oak.clone().add(P(-0.6, 0.8, 2.4)), 1) })
    await this.say(wake)
    ui.letterbox(false)
    this.note('spiral')
    const leaf = makeLeaf(L.oak.clone().add(V(0.9, 3.4))); w.scene.add(leaf)
    this.objective('under the oak', 'Dump out your brain. Open the journal (J). There’s a fallen leaf worth tracing.')
    await this.interact(leaf.position, 4, 'Trace the leaf')
    w.scene.remove(leaf)
    w.journal.add('leaves', { name: 'oak · meadow' }); this.note('ancestree')
    await wait(1500)
    this.objective('under the oak', 'Rest your eyes. Only for a second…ten, at the most.')
    await this.interact(p.pos, 4, 'Close your eyes')
    await w.interlude.play('sight')
  }

  async beat_frog() {
    const w = this.w, ui = this.ui, p = this.p, jay = this.jay
    w.sky.setTime(0.5, true)
    p.poseOverride = 'sit'; p.setPosition(L.oak.x - 0.1, L.oak.z + 2.6, 0.2)
    jay.visible = true; jay.pose = 'crouch'; jay.place(L.oak.x + 0.9, L.oak.z + 3.3, -2.6); jay.hold(makeFrog())
    this.lock(true)
    this.cine(L.oak.clone().add(P(-2.6, 1.3, 5)), L.oak.clone().add(P(0.4, 0.7, 3)), 1, true)
    ui.letterbox(true)
    await ui.fade(false)
    await this.say(SCRIPTS.frog)
    // the foot on the shoulder
    jay.pose = 'idle'; this.p.shake = 0.12; ui.vision('dim'); await wait(500); ui.vision('')
    await this.say(SCRIPTS.push)
    jay.pose = null; jay.hold(null)
    const toPond = [V(L.oak.x - 8, L.oak.z + 10), V(-20, 62), V(-50, 66), V(L.pondRest.x, L.pondRest.z)]
    jay.goTo(toPond, 2.2).then(() => { jay.visible = false })
    ui.letterbox(false)
    this.note('sawA')
    this.objective('under the oak', 'Rest. One more hour. You don’t have to decide right now.')
    await this.interact(p.pos, 4, 'Give your eyes the say-so')
    await w.interlude.play('branching')
  }

  async beat_dusk() {
    const w = this.w, ui = this.ui, p = this.p
    w.sky.setTime(0.62, true); w.rain.on = true
    p.poseOverride = null; p.setPosition(L.oak.x - 1, L.oak.z + 4, 0.4)
    this.startGolf()
    this.lock(true)
    this.cine(p.pos.clone().add(P(-4, 2.2, 4)), L.golf.clone().add(P(0, 1, 0)), 1, true)
    ui.letterbox(true)
    await ui.fade(false)
    this.hitBall()
    const dusk = inject(inject(SCRIPTS.dusk, 15, () => this.hitBall()), 6, () => { this.cine(L.golf.clone().add(P(-5, 1.6, 4)), L.golf.clone().add(P(0, 1, 0)), 1) })
    await this.say(dusk)
    ui.letterbox(false)
    this.freeCam(); this.lock(false)
  }

  async beat_bramble(entry) {
    const w = this.w, ui = this.ui, p = this.p
    if (entry) { w.sky.setTime(0.66, true); w.rain.on = true; p.setPosition(-30, 72, 0.3); this.startGolf(); this.freeCam(); this.lock(false); await ui.fade(false) }
    this.lightTimer = true; w.sky.rate = 0.0007; w.sky.setTime(0.75)
    this.objective('up creek', 'Go up creek. Alone. Ain’t much light left.')
    await this.walkTo(L.pond.clone().add(V(0, 20)), 14)
    this.lock(true); await this.say(SCRIPTS.pond2); this.lock(false)
    this.objective('the bramble', 'Push through. Shield your face. Keep your arms moving forward.')
    await this.walkTo(L.bramble, 12)
    // progress is measured as you crawl north through it
    const lines = ['Nothing. The bramble holds.', 'The arms push harder.', 'Where is the end.', 'Again.', 'The slightest feeling of give. A feeling of being sucked onward.']
    let shown = -1
    const box = w.bramble.box
    while (!(p.pos.z < box.z0 + 0.5 && p.pos.x > box.x0 && p.pos.x < box.x1)) {
      await wait(100)
      if (w.bramble.inside(p.pos.x, p.pos.z)) {
        const i = Math.min(lines.length - 1, Math.floor(((box.z1 - p.pos.z) / (box.z1 - box.z0)) * lines.length))
        if (i !== shown) { shown = i; ui.hint(lines[i]) }
      }
    }
    ui.hint(null); ui.scratches(false)
    this.lock(true)
    await this.say([{ who: 'inner', text: 'Born of bramble, spawned out the far side, I am a bloody, silent shriek.' }, { who: 'inner', text: 'Come on.' }])
    ui.vision('white'); await wait(1400)
  }

  async beat_alley(entry) {
    const w = this.w, ui = this.ui
    this.lock(true)
    if (entry) ui.fade(false)
    w.alley.start(); ui.letterbox(true); ui.vision('')
    await this.say(SCRIPTS.alley)
    ui.vision('black'); await wait(800)
    w.alley.stop()
    await this.say(SCRIPTS.fall, { auto: true })
    await w.interlude.play('fire')
  }

  async beat_moon() {
    const w = this.w, ui = this.ui, p = this.p, jay = this.jay
    w.sky.setTime(0.97, true); w.rain.on = false; this.lightTimer = false; ui.lightLeft(null)
    jay.visible = false
    this.lock(true)
    p.setPosition(L.creekEnd.x + 2.5, L.creekEnd.z, -1.2); p.poseOverride = 'lie'
    this.cine(L.creekEnd.clone().add(P(5, 2.2, 4)), L.creekEnd.clone().add(P(0, 0.4, -2)), 1, true)
    ui.letterbox(true)
    await ui.fade(false)
    this.cine(L.creekEnd.clone().add(P(-4, 2.6, -6)), L.creekEnd.clone().add(P(-2, 0.3, -1)), 0.25)
    await this.say(SCRIPTS.moon)
    this.ledger('gracie2'); this.ledger('gracie3'); this.ledger('mirror'); this.ledger('gracie1')
    await ui.chapter('end of act 1 · prototype', 'Water’s moonstruck.', 3600)
    ui.letterbox(false)
  }
}
