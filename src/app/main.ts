import * as THREE from 'three'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js'
import { Text } from 'troika-three-text'
// Bundled font so in-VR text never fetches from a CDN (must work offline).
import uiFontUrl from './assets/ui-font.ttf?url'

import { SimEngine } from '../sim/engine'
import type { ScenarioData } from '../sim/types'
import demoScenario from '../../content/scenarios/demo-placeholder.json'
import { buildRoom, CLOCK_POS } from './room'
import { PatientMonitor } from './monitor'
import { DesktopControls } from './desktopControls'

// ---- simulation -----------------------------------------------------------

const engine = new SimEngine(demoScenario as ScenarioData, { seed: 20260709 })
let timeScale = 1 // debug panel arrives later; keep the hook per spec §3

// ---- renderer / scene ------------------------------------------------------

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

const { monitorScreen } = buildRoom(scene)

const monitor = new PatientMonitor()
;(monitorScreen.material as THREE.MeshBasicMaterial).map = monitor.texture
monitor.setVitals(engine.snapshot(), engine.rhythm)

// Wall clock showing sim time (troika SDF text, regenerated on change only)
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

// Controller models so hands are visible in-headset (ray interaction is M2)
const controllerModelFactory = new XRControllerModelFactory()
for (const i of [0, 1]) {
  const grip = renderer.xr.getControllerGrip(i)
  grip.add(controllerModelFactory.createControllerModel(grip))
  rig.add(grip)
  rig.add(renderer.xr.getController(i))
}

// ---- desktop fallback -------------------------------------------------------

const desktop = new DesktopControls(camera, renderer.domElement)
const hint = document.getElementById('hint')!
desktop.onLockChange((locked) => {
  hint.style.display = locked ? 'none' : ''
})
renderer.xr.addEventListener('sessionstart', () => (hint.style.display = 'none'))
renderer.xr.addEventListener('sessionend', () => (hint.style.display = ''))

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ---- main loop --------------------------------------------------------------

const hudClock = document.getElementById('sim-clock')!
const scenarioLabel = document.getElementById('scenario-title')!
scenarioLabel.textContent = engine.scenario.title

function formatSimTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

let accumulator = 0
let lastTime: number | null = null

renderer.setAnimationLoop((now: number) => {
  const dtReal = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.25)
  lastTime = now
  const dtSim = dtReal * timeScale

  // Fixed-timestep 1 Hz sim tick via accumulator (identical headless/in-headset)
  accumulator += dtSim
  while (accumulator >= 1) {
    accumulator -= 1
    engine.tick()
    monitor.setVitals(engine.snapshot(), engine.rhythm)
    const label = formatSimTime(engine.time)
    if (clockText.text !== label) {
      clockText.text = label
      clockText.sync()
    }
    hudClock.textContent = `sim ${label}`
  }

  monitor.advance(dtSim)
  if (!renderer.xr.isPresenting) desktop.update(dtReal)
  renderer.render(scene, camera)
})

// Debug hook for manual fast-forwarding from the console until the panel exists.
Object.defineProperty(window, 'simTimeScale', {
  get: () => timeScale,
  set: (v: number) => (timeScale = v),
})
