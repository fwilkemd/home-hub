import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js'
import { tex } from './textures.js'
import { QUALITY } from '../quality.js'

// Time of day presets. `t` is a 0..1 cursor: morning → noon → dusk → night.
const PRESETS = {
  morning: { el: 11, az: 62, turb: 6, ray: 2.6, mie: 0.006, g: 0.82, sun: '#ffd9a8', sunI: 3.2, envI: 0.9, hemi: '#aac0e0', hemiG: '#54502e', hemiI: 0.35,
    fog: '#d7c9b0', fogD: 0.0017, fogH: 0.03, exposure: 1.0, cloud: '#fff1dc', cloudA: 0.55, night: 0 },
  noon:    { el: 58, az: 20, turb: 3, ray: 1.3, mie: 0.004, g: 0.8, sun: '#fff6e8', sunI: 4.0, envI: 1.0, hemi: '#9dc2ee', hemiG: '#6a6a40', hemiI: 0.35,
    fog: '#cfdcea', fogD: 0.0011, fogH: 0.025, exposure: 0.95, cloud: '#ffffff', cloudA: 0.5, night: 0 },
  dusk:    { el: 3.5, az: -108, turb: 11, ray: 3.2, mie: 0.028, g: 0.95, sun: '#ff9c52', sunI: 2.6, envI: 0.8, hemi: '#9a86b4', hemiG: '#5c4a38', hemiI: 0.4,
    fog: '#c99a82', fogD: 0.003, fogH: 0.035, exposure: 1.05, cloud: '#ffb08a', cloudA: 0.6, night: 0 },
  night:   { el: -14, az: -130, turb: 2, ray: 0.6, mie: 0.002, g: 0.7, sun: '#a9bde6', sunI: 0.5, envI: 0.25, hemi: '#1d2a4a', hemiG: '#0c0e12', hemiI: 0.55,
    fog: '#121a2c', fogD: 0.0038, fogH: 0.05, exposure: 0.85, cloud: '#44506e', cloudA: 0.45, night: 1 },
}
const ORDER = ['morning', 'noon', 'dusk', 'night']
function lerpPreset(a, b, t) {
  const o = {}
  for (const k in a) o[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * t : new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t)
  return o
}
export function presetAt(t) {
  const s = Math.max(0, Math.min(0.9999, t)) * (ORDER.length - 1)
  const i = Math.floor(s)
  return lerpPreset(PRESETS[ORDER[i]], PRESETS[ORDER[Math.min(i + 1, ORDER.length - 1)]], s - i)
}

function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32
  const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(c)
}

export class SkySystem {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer
    // physical sky
    this.sky = new Sky(); this.sky.scale.setScalar(6000); scene.add(this.sky)
    this.skyU = this.sky.material.uniforms
    this.pmrem = new THREE.PMREMGenerator(renderer)
    this.envScene = new THREE.Scene()
    this.envSky = new Sky(); this.envSky.scale.setScalar(6000); this.envScene.add(this.envSky)
    // sun (and moon, by night)
    this.sun = new THREE.DirectionalLight(0xffffff, 3)
    this.sun.castShadow = QUALITY.shadows
    this.sun.shadow.mapSize.set(QUALITY.shadowMap, QUALITY.shadowMap)
    const c = this.sun.shadow.camera
    c.near = 1; c.far = 420; c.left = -60; c.right = 60; c.top = 60; c.bottom = -60
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.05; this.sun.shadow.radius = 2
    this.sunTarget = new THREE.Object3D()
    scene.add(this.sun, this.sunTarget); this.sun.target = this.sunTarget
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3); scene.add(this.hemi)
    // the sun disc the god rays come from
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(42, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff3d0', fog: false }))
    this.sunDisc.frustumCulled = false
    scene.add(this.sunDisc)
    const flare = new Lensflare()
    const ft = tex('lensflare0.png', { wrap: false })
    flare.addElement(new LensflareElement(ft, 420, 0, new THREE.Color('#ffd9a0')))
    flare.addElement(new LensflareElement(ft, 60, 0.6)); flare.addElement(new LensflareElement(ft, 90, 0.75)); flare.addElement(new LensflareElement(ft, 40, 1.0))
    this.sunDisc.add(flare); this.flare = flare
    // stars
    const n = 1800, sp = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, e = Math.acos(Math.random() * 0.98); const r = 2500; sp[i * 3] = Math.cos(a) * Math.sin(e) * r; sp[i * 3 + 1] = Math.cos(e) * r + 50; sp[i * 3 + 2] = Math.sin(a) * Math.sin(e) * r }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ map: starTexture(), size: 14, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }))
    this.stars.frustumCulled = false; scene.add(this.stars)
    // a cloud layer
    const ct = tex('cloud.png', { repeat: 7 })
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0.5, depthWrite: false, fog: false, side: THREE.DoubleSide }))
    this.clouds.rotation.x = -Math.PI / 2; this.clouds.position.y = 420; scene.add(this.clouds)
    this.t = 0; this.target = 0; this.rate = 0.02
    this.sunDir = new THREE.Vector3(0, 1, 0)
    this.fogColor = new THREE.Color(); this.fogDensity = 0.003; this.fogHeight = 0.03; this.exposure = 1; this.night = 0
    this.envT = -1; this.envClock = 0
    this.apply(0, true)
  }
  setTime(t, immediate = false) { this.target = t; if (immediate) { this.t = t; this.apply(t, true) } }
  apply(t, forceEnv = false) {
    const p = presetAt(t)
    const el = THREE.MathUtils.degToRad(p.el), az = THREE.MathUtils.degToRad(p.az)
    const skySun = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - el, az)
    for (const s of [this.skyU, this.envSky.material.uniforms]) {
      s.turbidity.value = p.turb; s.rayleigh.value = p.ray; s.mieCoefficient.value = p.mie; s.mieDirectionalG.value = p.g; s.sunPosition.value.copy(skySun)
    }
    // by night the light is the moon, high and cool
    this.night = p.night
    const moon = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - THREE.MathUtils.degToRad(38), az + 1.2)
    this.sunDir.copy(skySun).lerp(moon, p.night).normalize()
    if (this.sunDir.y < 0.02) this.sunDir.y = 0.02
    this.sun.color.copy(p.sun); this.sun.intensity = p.sunI
    this.hemi.color.copy(p.hemi); this.hemi.groundColor.copy(p.hemiG); this.hemi.intensity = p.hemiI
    this.scene.environmentIntensity = p.envI
    this.fogColor.copy(p.fog); this.fogDensity = p.fogD; this.fogHeight = p.fogH; this.exposure = p.exposure
    this.clouds.material.color.copy(p.cloud); this.clouds.material.opacity = p.cloudA
    this.stars.material.opacity = p.night * 0.9
    this.sunDisc.material.color.copy(p.sun).lerp(new THREE.Color('#ffffff'), 0.5)
    this.sunDisc.visible = p.night < 0.5
    this.flare.visible = p.night < 0.5
    if (forceEnv || Math.abs(t - this.envT) > 0.012) this.rebuildEnv(t)
  }
  rebuildEnv(t) {
    this.envT = t
    const old = this.scene.environment
    const rt = this.pmrem.fromScene(this.envScene)
    this.scene.environment = rt.texture
    if (old) old.dispose()
  }
  update(dt, time, focus) {
    if (Math.abs(this.target - this.t) > 1e-4) {
      const d = this.target - this.t
      this.t += Math.sign(d) * Math.min(Math.abs(d), this.rate * dt)
      this.envClock += dt
      this.apply(this.t, false)
    }
    this.sunTarget.position.copy(focus)
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 200)
    this.sunDisc.position.copy(focus).addScaledVector(this.sunDir, 2800)
    this.sky.position.copy(focus); this.stars.position.copy(focus)
    this.clouds.position.x = focus.x; this.clouds.position.z = focus.z
    this.clouds.material.map.offset.set(time * 0.0025, time * 0.0012)
  }
}

export class Rain {
  constructor(scene) {
    const n = 3200
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(n * 6)
    this.seeds = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { this.seeds[i * 3] = Math.random() * 80 - 40; this.seeds[i * 3 + 1] = Math.random() * 30; this.seeds[i * 3 + 2] = Math.random() * 80 - 40 }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xdfe6ee, transparent: true, opacity: 0, fog: false }))
    this.mesh.frustumCulled = false
    this.n = n; this.on = false; this.a = 0
    scene.add(this.mesh)
  }
  update(dt, time, focus) {
    this.a += ((this.on ? 0.3 : 0) - this.a) * Math.min(1, dt * 0.8)
    this.mesh.material.opacity = this.a
    if (this.a < 0.01) { this.mesh.visible = false; return }
    this.mesh.visible = true
    const p = this.mesh.geometry.attributes.position.array
    for (let i = 0; i < this.n; i++) {
      const x = this.seeds[i * 3] + focus.x, z = this.seeds[i * 3 + 2] + focus.z
      const y = focus.y + ((this.seeds[i * 3 + 1] - time * 9) % 30 + 30) % 30
      p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z
      p[i * 6 + 3] = x + 0.15; p[i * 6 + 4] = y + 0.9; p[i * 6 + 5] = z
    }
    this.mesh.geometry.attributes.position.needsUpdate = true
  }
}
