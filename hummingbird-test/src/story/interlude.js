import * as THREE from 'three'
import { INTERLUDES } from './data.js'
import { L, heightAt } from '../world/terrain.js'
import { wait } from '../ui/ui.js'

function downTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d'); g.fillStyle = '#5c5752'; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 9000; i++) {
    g.strokeStyle = `rgba(${150 + Math.random() * 80},${140 + Math.random() * 70},${125 + Math.random() * 60},${0.25 + Math.random() * 0.4})`
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * 6.28, l = 3 + Math.random() * 9
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke()
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); t.colorSpace = THREE.SRGBColorSpace
  return t
}

const quiltFrag = `
uniform float time; uniform float detail; uniform float color;
varying vec2 vUv;
vec2 h2(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
vec3 cell(vec2 uv, float s){
  vec2 g = floor(uv*s), f = fract(uv*s); float md = 8.0; vec2 mc = vec2(0.0);
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 o = vec2(float(x),float(y)); vec2 r = o + h2(g+o) - f; float d = dot(r,r); if(d<md){ md=d; mc=g+o; } }
  vec2 hh = h2(mc);
  vec3 c = 0.5 + 0.5*cos(6.2831*(hh.x + vec3(0.0,0.33,0.67)) + time*0.2);
  return mix(vec3(0.97,0.95,0.9), c, color) ;
}
void main(){
  vec3 a = cell(vUv, 2.0 + detail*6.0);
  vec3 b = cell(vUv + 3.7, 8.0 + detail*30.0);
  vec3 c = cell(vUv + 9.1, 30.0 + detail*120.0);
  vec3 col = mix(a, b, clamp(detail*1.4,0.0,1.0)*0.5);
  col = mix(col, c, clamp(detail*1.8-0.6,0.0,1.0)*0.5);
  col = mix(vec3(0.985,0.975,0.95), col, clamp(detail*2.0, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export class Interlude {
  constructor(world) {
    this.w = world
    const s = new THREE.Scene(); this.scene = s
    s.background = new THREE.Color('#050406')
    this.cam = new THREE.PerspectiveCamera(70, 1, 0.01, 100)
    const nest = new THREE.Mesh(new THREE.SphereGeometry(0.55, 40, 24, 0, Math.PI * 2, 0.95, Math.PI - 0.95),
      new THREE.MeshStandardMaterial({ map: downTexture(), side: THREE.BackSide, roughness: 1, color: '#9a938a' }))
    s.add(nest); this.nest = nest
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.1, 10, 40), new THREE.MeshStandardMaterial({ map: downTexture(), roughness: 1, color: '#8a837a' }))
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.32; s.add(rim)
    this.hemi = new THREE.HemisphereLight('#223', '#000', 0.2); s.add(this.hemi)
    this.warm = new THREE.PointLight('#ff9a3a', 0, 2.5); this.warm.position.set(0, 0.6, 0); s.add(this.warm)
    this.warmSprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffb067', transparent: true, opacity: 0 }))
    this.warmSprite.scale.setScalar(0.5); this.warmSprite.position.set(0, 0.7, 0); s.add(this.warmSprite)
    this.quiltU = { time: { value: 0 }, detail: { value: 0 }, color: { value: 0 } }
    this.quilt = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShaderMaterial({ uniforms: this.quiltU, fragmentShader: quiltFrag, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ` }))
    this.quilt.position.set(0, 3, 0); this.quilt.rotation.x = Math.PI / 2; this.quilt.visible = false; s.add(this.quilt)
    this.cam.position.set(0, -0.05, 0); this.cam.lookAt(0, 1, 0.15)
    this.t = 0; this.fx = {}
    // a nest up in the oak for the branching interludes, seen from inside
    const m = this.w.scene
    const nest2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 10, 40), rim.material)
    nest2.rotation.x = Math.PI / 2
    this.nestPos = new THREE.Vector3(L.oak.x - 4.5, heightAt(L.oak.x, L.oak.z) + 12.2, L.oak.z + 2.5)
    nest2.position.copy(this.nestPos); m.add(nest2)
  }
  async play(kind) {
    const w = this.w, ui = w.ui
    const lines = INTERLUDES[kind]
    const inOak = kind === 'branching' || kind === 'fire'
    await ui.fade(true)
    ui.hud(false); ui.vision(''); ui.letterbox(true)
    this.kind = kind; this.t = 0
    this.fx = { warm: 0, detail: 0, color: 0, shake: 0, lift: 0, dark: 1 }
    if (inOak) {
      this.look = new THREE.Vector3(L.oak.x - 60, heightAt(L.oak.x, L.oak.z) + 8, L.oak.z - 40)
      w.override = { scene: w.scene, camera: w.camera, update: (dt) => this.updateOak(dt) }
      w.camera.position.copy(this.nestPos).add(new THREE.Vector3(0, 0.25, 0)); w.camera.lookAt(this.look)
      if (kind === 'fire') { w.sky.setTime(0.93, true); this.fx.dark = 0.6 }
    } else {
      this.quilt.visible = kind === 'sight'
      w.override = { scene: this.scene, camera: this.cam, update: (dt) => this.updateNest(dt) }
      if (kind === 'sight') { ui.vision('white') }
    }
    await ui.fade(false)
    for (let i = 0; i < lines.length; i++) {
      this.cue(kind, i)
      ui.interlude(lines[i], false)
      await wait(900)
      ui.interlude(lines[i], true)
      await ui.key(['Space', 'KeyE', 'Enter'])
      ui.interlude(null, false)
      await wait(350)
    }
    await ui.fade(true)
    ui.interlude(null, false); ui.vision(''); ui.letterbox(false)
    w.override = null; ui.hud(true)
    this.quilt.visible = false
  }
  cue(kind, i) {
    const f = this.fx
    if (kind === 'egg') { f.warmTarget = [0.9, 0.5, 0.15][i]; f.darkTarget = [1, 0.9, 0.5][i] }
    if (kind === 'sight') {
      if (i === 0) { f.detailTarget = 0; f.colorTarget = 0; setTimeout(() => this.w.ui.vision(''), 900) }
      if (i === 1) { f.detailTarget = 0.6; f.colorTarget = 1 }
      if (i === 2) { f.detailTarget = 1; f.colorTarget = 1; f.saccade = true }
      if (i === 3) { f.warmTarget = 1; f.saccade = false }
    }
    if (kind === 'branching') { f.shake = [0, 0.004, 0.02, 0.03, 0.05, 0.09, 0.14][i]; f.lift = [0, 0, 0, 0, 0, 0.25, 0.6][i]; this.w.sky.setTime([0.3, 0.33, 0.36, 0.4, 0.42, 0.45, 0.5][i]) }
    if (kind === 'fire') { f.shake = 0; f.lift = 0; f.warmTarget = [0.2, 0.1, 0.5][i] }
  }
  updateNest(dt) {
    this.t += dt
    const f = this.fx
    const ease = (k, tgt, r) => { f[k] += ((f[tgt] ?? f[k]) - f[k]) * Math.min(1, dt * r) }
    ease('warm', 'warmTarget', 0.6); ease('dark', 'darkTarget', 0.5); ease('detail', 'detailTarget', 0.35); ease('color', 'colorTarget', 0.5)
    const pulse = 0.7 + 0.3 * Math.sin(this.t * 1.1)
    this.warm.intensity = f.warm * 2.4 * pulse
    this.warmSprite.material.opacity = f.warm * 0.55 * pulse
    this.warmSprite.position.y = 0.55 + 0.35 * (1 - f.warm)
    this.hemi.intensity = 0.05 + (1 - f.dark) * 0.9
    this.scene.background.setRGB(0.02 * (1 - f.dark) + 0.01, 0.015, 0.02)
    this.quiltU.time.value = this.t; this.quiltU.detail.value = f.detail; this.quiltU.color.value = f.color
    if (this.kind === 'sight') this.hemi.intensity = 0.4 + f.color * 0.5
    // eyes: slow drift, then saccades
    const look = new THREE.Vector3(Math.sin(this.t * 0.3) * 0.15, 1, 0.15 + Math.cos(this.t * 0.2) * 0.1)
    if (f.saccade) { const s = Math.floor(this.t * 3.3); look.x += Math.sin(s * 12.9) * 0.5; look.z += Math.cos(s * 7.1) * 0.4 }
    this.cam.lookAt(look)
    this.cam.rotation.z += Math.sin(this.t * 0.5) * 0.03
  }
  updateOak(dt) {
    this.t += dt
    const f = this.fx, cam = this.w.camera
    const base = this.nestPos.clone().add(new THREE.Vector3(0, 0.25, 0))
    const wing = f.shake > 0 ? Math.sin(this.t * 40) * f.shake : 0
    base.y += f.lift * (0.5 + 0.5 * Math.sin(this.t * 1.5)) + wing
    base.x += (Math.random() - 0.5) * f.shake * 0.5; base.z += (Math.random() - 0.5) * f.shake * 0.5
    cam.position.copy(base)
    const look = this.look.clone(); look.y += Math.sin(this.t * 0.4) * 2
    cam.lookAt(look)
    if (this.kind === 'fire') { this.w.sky.update(dt, this.t, cam.position) }
  }
}
