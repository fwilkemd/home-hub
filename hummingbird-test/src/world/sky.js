import * as THREE from 'three'

// Time of day presets. `t` is a 0..1 cursor across the day, lerped by the director.
const PRESETS = {
  morning: { sunEl: 0.22, sunAz: 1.1, sun: '#ffd9a0', sunI: 2.6, hemiSky: '#b8cbe4', hemiGround: '#6a6a44', hemiI: 0.85,
    zenith: '#5d85c6', horizon: '#e9c9a0', glow: '#ffe0b0', fog: '#c7c0ae', fogNear: 120, fogFar: 900, exposure: 1.15 },
  noon:    { sunEl: 0.95, sunAz: 0.4, sun: '#fff4e2', sunI: 3.0, hemiSky: '#b4d2f0', hemiGround: '#74744a', hemiI: 0.95,
    zenith: '#2f6fd1', horizon: '#bcd4ec', glow: '#ffffff', fog: '#b9c8d6', fogNear: 180, fogFar: 1100, exposure: 1.2 },
  dusk:    { sunEl: 0.09, sunAz: -1.9, sun: '#ff9a4a', sunI: 2.6, hemiSky: '#9a8fb8', hemiGround: '#6a5a44', hemiI: 0.6,
    zenith: '#4b4f8c', horizon: '#f3a263', glow: '#ffc27a', fog: '#b48f7c', fogNear: 70, fogFar: 700, exposure: 1.1 },
  night:   { sunEl: 0.55, sunAz: -2.4, sun: '#9db4e0', sunI: 0.45, hemiSky: '#1c2440', hemiGround: '#0d0f12', hemiI: 0.25,
    zenith: '#060a18', horizon: '#1a2238', glow: '#b9c8ff', fog: '#0f1424', fogNear: 60, fogFar: 520, exposure: 0.9 },
}
const ORDER = ['morning', 'noon', 'dusk', 'night']

function lerpPreset(a, b, t) {
  const o = {}
  for (const k in a) {
    if (typeof a[k] === 'number') o[k] = a[k] + (b[k] - a[k]) * t
    else o[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t)
  }
  return o
}
export function presetAt(t) {
  const s = Math.max(0, Math.min(0.9999, t)) * (ORDER.length - 1)
  const i = Math.floor(s)
  return lerpPreset(PRESETS[ORDER[i]], PRESETS[ORDER[Math.min(i + 1, ORDER.length - 1)]], s - i)
}

const skyVert = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const skyFrag = `
uniform vec3 zenith; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir; uniform float night; uniform float time;
varying vec3 vDir;
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
void main(){
  float h = clamp(vDir.y, -0.1, 1.0);
  vec3 col = mix(horizon, zenith, pow(max(h,0.0), 0.55));
  float s = max(dot(normalize(vDir), sunDir), 0.0);
  col += glow * (pow(s, 48.0) * 1.2 + pow(s, 6.0) * 0.18);
  // moon + stars at night
  vec3 st = floor(vDir * 240.0);
  float star = step(0.9985, hash(st)) * night * smoothstep(0.0, 0.3, vDir.y);
  col += vec3(star) * (0.6 + 0.4 * sin(time * 2.0 + hash(st) * 20.0));
  col += vec3(0.9, 0.93, 1.0) * pow(s, 900.0) * 3.0 * night;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer
    this.sun = new THREE.DirectionalLight(0xffffff, 2)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const c = this.sun.shadow.camera
    c.near = 1; c.far = 400; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70
    this.sun.shadow.bias = -0.0008
    this.sun.shadow.normalBias = 0.04
    this.sunTarget = new THREE.Object3D()
    scene.add(this.sun, this.sunTarget)
    this.sun.target = this.sunTarget
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
    scene.add(this.hemi)
    this.uniforms = {
      zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, night: { value: 0 }, time: { value: 0 },
    }
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false }))
    this.dome.renderOrder = -10
    scene.add(this.dome)
    scene.fog = new THREE.Fog(0xcccccc, 100, 900)
    this.t = 0
    this.target = 0
    this.rate = 0.02 // per second, when easing toward target
    this.sunDir = new THREE.Vector3()
    this.apply(0)
  }
  setTime(t, immediate = false) { this.target = t; if (immediate) this.t = t }
  apply(t) {
    const p = presetAt(t)
    const el = p.sunEl * Math.PI * 0.5, az = p.sunAz
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize()
    this.sun.color.copy(p.sun); this.sun.intensity = p.sunI
    this.hemi.color.copy(p.hemiSky); this.hemi.groundColor.copy(p.hemiGround); this.hemi.intensity = p.hemiI
    this.uniforms.zenith.value.copy(p.zenith); this.uniforms.horizon.value.copy(p.horizon); this.uniforms.glow.value.copy(p.glow)
    this.uniforms.sunDir.value.copy(this.sunDir)
    this.uniforms.night.value = Math.max(0, (t - 0.72) / 0.28)
    this.scene.fog.color.copy(p.fog); this.scene.fog.near = p.fogNear; this.scene.fog.far = p.fogFar
    this.renderer.toneMappingExposure = p.exposure
    this.night = this.uniforms.night.value
  }
  update(dt, time, focus) {
    if (Math.abs(this.target - this.t) > 1e-4) {
      const d = this.target - this.t
      this.t += Math.sign(d) * Math.min(Math.abs(d), this.rate * dt)
    }
    this.apply(this.t)
    this.uniforms.time.value = time
    // shadow frustum follows the player
    this.sunTarget.position.copy(focus)
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 180)
    this.dome.position.copy(focus)
  }
}

// Light, slanting rain for the dusk beat.
export class Rain {
  constructor(scene) {
    const n = 2600
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(n * 6)
    this.seeds = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      this.seeds[i * 3] = Math.random() * 80 - 40; this.seeds[i * 3 + 1] = Math.random() * 30; this.seeds[i * 3 + 2] = Math.random() * 80 - 40
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xdfe6ee, transparent: true, opacity: 0 }))
    this.mesh.frustumCulled = false
    this.n = n; this.on = false; this.a = 0
    scene.add(this.mesh)
  }
  update(dt, time, focus) {
    this.a += ((this.on ? 0.35 : 0) - this.a) * Math.min(1, dt * 0.8)
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
