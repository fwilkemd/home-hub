import * as THREE from 'three'
import { Input } from './input.js'
import { UI } from './ui/ui.js'
import { Dialogue } from './ui/dialogue.js'
import { Journal } from './ui/journal.js'
import { buildTerrain, L } from './world/terrain.js'
import { SkySystem, Rain } from './world/sky.js'
import { Grass, buildFlowers } from './world/grass.js'
import { buildOak, buildWoods, buildMountains, buildBramble } from './world/flora.js'
import { Water } from './world/water.js'
import { buildCar } from './world/props.js'
import { WIND } from './world/textures.js'
import { Player } from './chars/player.js'
import { Jay } from './chars/jay.js'
import { Hummingbird } from './chars/hummingbird.js'
import { loadRig } from './chars/rig.js'
import { Interlude } from './story/interlude.js'
import { Alley } from './story/alley.js'
import { Director } from './story/director.js'
import { QUALITY, START_BEAT } from './quality.js'
import { Post } from './post.js'

const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !QUALITY.post, powerPreference: 'high-performance', stencil: false })
renderer.setPixelRatio(QUALITY.pixelRatio)
renderer.shadowMap.enabled = QUALITY.shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = QUALITY.post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(48, 1, 0.3, 9000)
const input = new Input(canvas)
const ui = new UI(input)
const state = { heat: 0, venom: 0, flags: {} }
const dialogue = new Dialogue(input, state)
const journal = new Journal(input, ui)
const title = document.getElementById('title'), cta = document.getElementById('title-cta')
cta.textContent = 'loading…'

async function boot() {
  const rig = await loadRig()
  scene.add(buildTerrain())
  const sky = new SkySystem(scene, renderer)
  const rain = new Rain(scene)
  const grass = new Grass(scene, QUALITY.grass)
  buildOak(scene)
  buildWoods(scene)
  buildMountains(scene)
  const bramble = buildBramble(scene)
  const water = new Water(scene)
  const car = buildCar(scene)
  const hummingbird = new Hummingbird(scene)
  const jay = new Jay(scene, rig)
  const player = new Player(scene, input, camera, rig)
  player.setPosition(L.car.x + 1.4, L.car.z - 1, Math.PI)
  await buildFlowers(scene)

  const world = { scene, camera, renderer, sky, rain, grass, water, hummingbird, jay, player, bramble, car, ui, dialogue, journal, input, state, override: null }
  world.interlude = new Interlude(world)
  world.alley = new Alley(world)
  const director = new Director(world)
  world.director = director
  window.__hb = world // debug handle: window.__hb.player.setPosition(x, z) teleports
  const post = QUALITY.post ? new Post(renderer, scene, camera, sky) : null

  function resize() {
    const w = window.innerWidth, h = window.innerHeight
    renderer.setSize(w, h, false)
    post && post.setSize(w, h)
    for (const c of [camera, world.interlude.cam, world.alley.cam]) { c.aspect = w / h; c.updateProjectionMatrix() }
  }
  window.addEventListener('resize', resize); resize()

  // ---- title, pause, pointer lock ----
  let started = false, paused = false
  if (START_BEAT !== 'car') document.getElementById('title-sub').textContent = `Act 1 — starting from “${START_BEAT}”`
  cta.textContent = 'click to begin'
  title.addEventListener('click', () => {
    if (started) return
    started = true
    title.classList.add('off')
    input.lock()
    director.run(START_BEAT).catch((e) => console.error(e))
  })
  document.getElementById('pause').addEventListener('click', () => { input.lock() })
  document.addEventListener('pointerlockchange', () => {
    if (!started) return
    const locked = document.pointerLockElement === canvas
    if (!locked && !journal.open) { paused = true; ui.pause(true) }
    if (locked) { paused = false; ui.pause(false) }
  })
  input.on('Escape', () => { if (started && !journal.open && input.locked) input.unlock() })
  journal.onToggle = (open) => { if (!open) input.lock() }

  // ---- loop ----
  const clock = new THREE.Clock()
  let time = 0
  const head = new THREE.Vector3()
  function frame() {
    requestAnimationFrame(frame)
    const dt = Math.min(0.05, clock.getDelta())
    if (paused) return
    time += dt
    WIND.value = time
    if (world.override) {
      world.override.update(dt)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.render(world.override.scene, world.override.camera)
      return
    }
    player.update(dt)
    jay.update(dt)
    hummingbird.update(dt, time)
    sky.update(dt, time, player.pos)
    rain.update(dt, time, player.pos)
    grass.update(time, player.pos, sky)
    water.update(time, sky, dt)
    director.update(dt)
    if (post) {
      renderer.toneMapping = THREE.NoToneMapping
      head.copy(player.pos).y += 1.4
      post.render(dt, player.cine ? (player.cine.look || head) : head, dialogue.active)
    } else renderer.render(scene, camera)
  }
  frame()
}
boot().catch((e) => { console.error(e); cta.textContent = 'failed to load — see console' })
