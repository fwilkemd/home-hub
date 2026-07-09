import * as THREE from 'three'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'
import { Text } from 'troika-three-text'
// Bundled font so in-VR text never fetches from a CDN (must work offline).
import uiFontUrl from './assets/ui-font.ttf?url'

import { SimEngine } from '../sim/engine'
import { parseCatalog, ContentValidationError, type CatalogData, type ScenarioData } from '../sim/schema'
import catalogRaw from '../../content/interventions.json'
import { buildRoom, BED, CLOCK_POS, MONITOR_POS } from './room'
import { PatientMonitor } from './monitor'
import { DesktopControls } from './desktopControls'
import { Interactions } from './interactions'
import { SoundKit } from './audio'
import { Locomotion } from './locomotion'
import { OrderPanel } from './panels/orderPanel'
import { MessageFeed, ChartPanel, ExamCard } from './panels/infoPanels'
import { DebugPanel, type SimClock } from './panels/debugPanel'
import { UI, makeText } from './ui'
import { loadScenarioEntries, showPicker } from './picker'
import { showDebrief } from './debrief'

// ---- content: validate loudly before anything renders ------------------------

let catalog: CatalogData | null = null
let catalogError: string | null = null
try {
  catalog = parseCatalog(catalogRaw)
} catch (err) {
  catalogError = err instanceof ContentValidationError ? err.message : String(err)
}

showPicker(loadScenarioEntries(), catalogError, (scenario) => startApp(scenario, catalog!))

// ---- the app ------------------------------------------------------------------

function startApp(scenario: ScenarioData, catalogData: CatalogData): void {
  const engine = new SimEngine(scenario, catalogData, { seed: (Math.random() * 2 ** 31) | 0 })
  const clock: SimClock = { paused: false, timeScale: 1 }

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.xr.enabled = true
  renderer.xr.setFoveation(1)
  document.body.appendChild(renderer.domElement)
  document.body.appendChild(VRButton.createButton(renderer))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 30)

  // Rig: in XR the local-floor origin sits here (standing beside the bed);
  // on desktop the camera itself is moved by the controls.
  const rig = new THREE.Group()
  rig.position.set(1.3, 0, 0.4)
  rig.add(camera)
  scene.add(rig)
  camera.position.set(0, 1.6, 0)
  camera.lookAt(0, 1.4, -2.2)
  const eyeStart = new THREE.Vector3(1.3, 1.6, 0.4)

  const { monitorScreen, tabletScreen } = buildRoom(scene)

  // ---- sounds + interactions
  const sounds = new SoundKit()
  camera.add(sounds.listener)
  sounds.attachAlarm(monitorScreen)

  const desktop = new DesktopControls(camera, renderer.domElement)
  const interactions = new Interactions(renderer, camera, () => desktop.locked, scene, rig)
  desktop.lockGate = () => !interactions.mouseHovering
  interactions.onAnySelect = () => {
    sounds.unlock()
    sounds.startHum()
    sounds.click()
  }
  const locomotion = new Locomotion(renderer, rig, camera, scene)

  // Controller grip models so hands are visible in-headset
  const controllerModelFactory = new XRControllerModelFactory()
  for (const i of [0, 1]) {
    const grip = renderer.xr.getControllerGrip(i)
    grip.add(controllerModelFactory.createControllerModel(grip))
    rig.add(grip)
  }

  // ---- monitor + silence button
  const monitor = new PatientMonitor({ arterialLine: scenario.arterialLine })
  ;(monitorScreen.material as THREE.MeshBasicMaterial).map = monitor.texture
  const pushVitals = () =>
    monitor.setVitals(engine.snapshot(), engine.rhythm, {
      time: engine.time,
      alarmed: engine.alarmedVars(),
      silenced: engine.alarmsSilenced,
    })
  pushVitals()

  const silenceButton = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.07, 0.03),
    new THREE.MeshBasicMaterial({ color: 0x25333c }),
  )
  silenceButton.name = 'silence'
  silenceButton.position.set(MONITOR_POS.x + 0.44, MONITOR_POS.y - 0.38, MONITOR_POS.z + 0.02)
  scene.add(silenceButton)
  const silenceLabel = makeText('SILENCE', 0.024, UI.ink, { anchorX: 'center', anchorY: 'middle' })
  silenceLabel.position.set(0, 0, 0.017)
  silenceButton.add(silenceLabel)
  interactions.register(silenceButton, {
    onSelect: () => engine.silenceAlarms(120),
    onHoverStart: () => (silenceButton.material as THREE.MeshBasicMaterial).color.setHex(0x3a5464),
    onHoverEnd: () => (silenceButton.material as THREE.MeshBasicMaterial).color.setHex(0x25333c),
  })

  // ---- wall clock (troika, regenerated only when the minute:second changes)
  const clockText = new Text()
  clockText.text = '00:00'
  clockText.font = uiFontUrl
  clockText.fontSize = 0.09
  clockText.color = 0x1c242a
  clockText.anchorX = 'center'
  clockText.anchorY = 'middle'
  clockText.position.set(CLOCK_POS.x + 0.03, CLOCK_POS.y, CLOCK_POS.z)
  clockText.rotation.y = Math.PI / 2
  clockText.sync()
  scene.add(clockText)

  // ---- panels
  const roomCenter = new THREE.Vector3(eyeStart.x, 1.5, eyeStart.z)
  const orderPanel = new OrderPanel(engine, interactions, sounds, tabletScreen, scene, roomCenter)
  const feed = new MessageFeed(
    engine, interactions, sounds, scene, camera,
    new THREE.Vector3(1.8, 1.72, MONITOR_POS.z + 0.01),
  )
  const chart = new ChartPanel(engine, interactions, scene, new THREE.Vector3(-1.8, 1.72, MONITOR_POS.z + 0.01))
  const examCard = new ExamCard(
    interactions, scene,
    new THREE.Vector3(BED.x - 0.75, 1.35, BED.centerZ + 0.1), roomCenter,
  )
  const debugPanel = new DebugPanel(
    engine, interactions, clock, scene,
    new THREE.Vector3(-1.7, 1.35, 0.6), roomCenter,
  )

  // ---- exam colliders (invisible, raycastable)
  const regions: [string, THREE.Vector3, THREE.Vector3][] = [
    ['head', new THREE.Vector3(0.4, 0.32, 0.4), new THREE.Vector3(BED.x, 0.8, BED.headZ + 0.3)],
    ['chest', new THREE.Vector3(0.66, 0.32, 0.55), new THREE.Vector3(BED.x, 0.82, BED.headZ + 0.85)],
    ['abdomen', new THREE.Vector3(0.66, 0.28, 0.45), new THREE.Vector3(BED.x, 0.8, BED.headZ + 1.32)],
    ['extremities', new THREE.Vector3(0.62, 0.28, 0.75), new THREE.Vector3(BED.x, 0.76, BED.headZ + 1.9)],
  ]
  for (const [region, size, pos] of regions) {
    const collider = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z))
    collider.name = `exam:${region}`
    collider.visible = false
    collider.position.copy(pos)
    scene.add(collider)
    interactions.register(collider, {
      onSelect: () => examCard.show(region, engine.examine(region)),
    })
  }

  // ---- debug panel toggles: long-press the wall clock, or ` on desktop
  const clockHitbox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.45))
  clockHitbox.visible = false
  clockHitbox.position.set(CLOCK_POS.x, CLOCK_POS.y, CLOCK_POS.z)
  scene.add(clockHitbox)
  interactions.register(clockHitbox, { onLongPress: () => debugPanel.toggle() })
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') debugPanel.toggle()
  })

  // ---- HUD
  const hud = document.getElementById('hud')!
  hud.style.display = 'block'
  const hudClock = document.getElementById('sim-clock')!
  document.getElementById('scenario-title')!.textContent = scenario.title
  const hint = document.getElementById('hint')!
  hint.style.display = ''
  const crosshair = document.getElementById('crosshair')!
  desktop.onLockChange((locked) => {
    hint.style.display = locked ? 'none' : ''
    crosshair.style.display = locked ? '' : 'none'
  })
  renderer.xr.addEventListener('sessionstart', () => {
    hint.style.display = 'none'
    sounds.unlock()
    sounds.startHum()
  })
  renderer.xr.addEventListener('sessionend', () => (hint.style.display = ''))

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // ---- per-sim-tick sync
  let lastBeepAt = -10
  const onTick = () => {
    pushVitals()
    orderPanel.tick()
    feed.tick()
    chart.tick()
    debugPanel.tick()

    const label = formatSimTime(engine.time)
    if (clockText.text !== label) {
      clockText.text = label
      clockText.sync()
    }
    hudClock.textContent = `sim ${label}${clock.paused ? '  ⏸' : clock.timeScale !== 1 ? `  ${clock.timeScale}×` : ''}`

    if (engine.alarmsAudible() && engine.time - lastBeepAt >= 2) {
      lastBeepAt = engine.time
      sounds.alarmBeep()
    }
  }
  onTick()

  // ---- endpoint → debrief
  let debriefShown = false
  const maybeEndSession = () => {
    if (!engine.ended || debriefShown) return
    debriefShown = true
    const finish = () => {
      hud.style.display = 'none'
      hint.style.display = 'none'
      crosshair.style.display = 'none'
      const vrButton = document.getElementById('VRButton')
      if (vrButton) vrButton.style.display = 'none'
      if (document.pointerLockElement) document.exitPointerLock()
      showDebrief(engine, () => location.reload())
    }
    const session = renderer.xr.getSession()
    if (session) void session.end().then(finish, finish)
    else finish()
  }

  // ---- main loop: fixed-timestep 1 Hz sim tick via accumulator
  let accumulator = 0
  let lastTime: number | null = null

  renderer.setAnimationLoop((now: number) => {
    const dtReal = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.25)
    lastTime = now
    const dtSim = clock.paused ? 0 : dtReal * clock.timeScale

    accumulator += dtSim
    let ticked = false
    while (accumulator >= 1) {
      accumulator -= 1
      engine.tick()
      ticked = true
      if (engine.ended) {
        accumulator = 0
        break
      }
    }
    if (ticked) {
      onTick()
      maybeEndSession()
    }

    monitor.advance(dtSim)
    interactions.update()
    locomotion.update()
    feed.frame(now)
    examCard.frame(now)
    if (!renderer.xr.isPresenting) desktop.update(dtReal)
    renderer.render(scene, camera)
  })

  // Console escape hatches while the headset is on your desk
  Object.defineProperty(window, 'simTimeScale', {
    get: () => clock.timeScale,
    set: (v: number) => (clock.timeScale = v),
  })
  ;(window as unknown as { sim: SimEngine }).sim = engine

  if (import.meta.env.DEV) {
    // Dev/test hook: screen-space coords of a named interactive mesh, so the
    // flat build can be driven by automation. Stripped from production.
    ;(window as unknown as Record<string, unknown>).__icu = {
      engine,
      clock,
      screenXY(name: string): { x: number; y: number } | null {
        let found: THREE.Object3D | null = null
        scene.traverse((o) => {
          if (!found && o.name === name) found = o
        })
        if (!found) return null
        const v = (found as THREE.Object3D).getWorldPosition(new THREE.Vector3()).project(camera)
        if (v.z > 1) return null
        return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight }
      },
    }
  }
}

function formatSimTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
