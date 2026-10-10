import * as THREE from 'three'
import { EffectComposer, RenderPass, EffectPass, NormalPass, SSAOEffect, BloomEffect, DepthOfFieldEffect, GodRaysEffect, VignetteEffect, NoiseEffect, ToneMappingEffect, ToneMappingMode, BlendFunction, Effect, EffectAttribute, HueSaturationEffect, KernelSize } from 'postprocessing'
import { QUALITY } from './quality.js'

// Height fog with sun in-scatter, reconstructed from depth, plus exposure.
const fogFrag = `
uniform mat4 invProj; uniform mat4 camWorld; uniform vec3 fogColor; uniform float density; uniform float heightK; uniform vec3 sunDir; uniform vec3 sunColor; uniform float exposure;
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor){
  vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 view = invProj * clip; view /= view.w;
  vec3 world = (camWorld * view).xyz;
  vec3 camPos = camWorld[3].xyz;
  vec3 ray = world - camPos; float dist = length(ray); vec3 dir = ray / max(dist, 1e-4);
  float sky = step(0.99995, depth);
  float h0 = camPos.y, dy = dir.y;
  float od = (abs(dy) > 1e-3) ? (exp(-heightK * h0) - exp(-heightK * (h0 + dy * dist))) / (heightK * dy) : exp(-heightK * h0) * dist;
  float f = (1.0 - exp(-density * od)) * (1.0 - sky);
  float sunAmt = pow(max(dot(dir, sunDir), 0.0), 10.0);
  vec3 fc = mix(fogColor, sunColor, sunAmt * 0.65);
  vec3 col = mix(inputColor.rgb, fc, clamp(f, 0.0, 0.94));
  outputColor = vec4(col * exposure, inputColor.a);
}`
class HeightFogEffect extends Effect {
  constructor(camera, sky) {
    super('HeightFogEffect', fogFrag, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['invProj', new THREE.Uniform(new THREE.Matrix4())], ['camWorld', new THREE.Uniform(new THREE.Matrix4())],
        ['fogColor', new THREE.Uniform(new THREE.Color())], ['density', new THREE.Uniform(0.003)], ['heightK', new THREE.Uniform(0.03)],
        ['sunDir', new THREE.Uniform(new THREE.Vector3(0, 1, 0))], ['sunColor', new THREE.Uniform(new THREE.Color())], ['exposure', new THREE.Uniform(1)],
      ]),
    })
    this.camera = camera; this.sky = sky
  }
  update() {
    const u = this.uniforms
    u.get('invProj').value.copy(this.camera.projectionMatrixInverse)
    u.get('camWorld').value.copy(this.camera.matrixWorld)
    u.get('fogColor').value.copy(this.sky.fogColor).multiplyScalar(1.15)
    u.get('density').value = this.sky.fogDensity; u.get('heightK').value = this.sky.fogHeight
    u.get('sunDir').value.copy(this.sky.sunDir)
    u.get('sunColor').value.copy(this.sky.sun.color).multiplyScalar(Math.min(2.2, this.sky.sun.intensity * 0.6))
    u.get('exposure').value = this.sky.exposure
  }
}

// Grass, leaf cards and flowers are skipped in the normal pass (SSAO) — they'd only add noise.
const SKIP = new Set(['grass', 'cards', 'flowers'])
class MaskedNormalPass extends NormalPass {
  render(renderer, input, output, dt, stencil) {
    const hidden = []
    this.scene.traverse((o) => { if (SKIP.has(o.name) && o.visible) { o.visible = false; hidden.push(o) } })
    super.render(renderer, input, output, dt, stencil)
    hidden.forEach((o) => { o.visible = true })
  }
}

export class Post {
  constructor(renderer, scene, camera, sky) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.sky = sky
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: QUALITY.msaa })
    this.composer.addPass(new RenderPass(scene, camera))
    const first = []
    if (QUALITY.ssao) {
      this.normalPass = new MaskedNormalPass(scene, camera, { resolutionScale: 0.5 })
      this.composer.addPass(this.normalPass)
      this.ssao = new SSAOEffect(camera, this.normalPass.texture, {
        blendFunction: BlendFunction.MULTIPLY, worldDistanceThreshold: 80, worldDistanceFalloff: 20, worldProximityThreshold: 0.35, worldProximityFalloff: 0.15,
        radius: 0.06, intensity: 1.6, luminanceInfluence: 0.55, samples: 12, rings: 4, resolutionScale: 0.5, color: new THREE.Color('#1a1510'),
      })
      first.push(this.ssao)
    }
    this.fog = new HeightFogEffect(camera, sky)
    if (QUALITY.fog) first.push(this.fog)
    if (first.length) this.composer.addPass(new EffectPass(camera, ...first))
    if (QUALITY.dof) {
      this.dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 5, worldFocusRange: 12, bokehScale: 2.2, resolutionScale: 0.6 })
      this.composer.addPass(new EffectPass(camera, this.dof))
    }
    const last = []
    if (QUALITY.godrays) {
      this.godrays = new GodRaysEffect(camera, sky.sunDisc, { density: 0.96, decay: 0.94, weight: 0.28, exposure: 0.5, samples: 48, clampMax: 1, resolutionScale: 0.5, kernelSize: KernelSize.SMALL, blur: true })
      last.push(this.godrays)
    }
    this.bloom = new BloomEffect({ luminanceThreshold: 0.9, luminanceSmoothing: 0.3, mipmapBlur: false, kernelSize: KernelSize.LARGE, intensity: 0.55, resolutionScale: 0.5 })
    this.grade = new HueSaturationEffect({ saturation: 0.06 })
    this.vignette = new VignetteEffect({ offset: 0.28, darkness: 0.6 })
    this.noise = new NoiseEffect({ premultiply: true }); this.noise.blendMode.opacity.value = 0.22
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX })
    const fx = QUALITY.fx
    const chain = [...last]
    if (fx.has('bloom')) chain.push(this.bloom)
    if (fx.has('grade')) chain.push(this.grade)
    if (fx.has('vignette')) chain.push(this.vignette)
    if (fx.has('noise')) chain.push(this.noise)
    this.composer.addPass(QUALITY.grade ? new EffectPass(camera, ...chain, this.tone) : new EffectPass(camera, this.tone))
    this.focus = 5; this.range = 12
  }
  setSize(w, h) { this.composer.setSize(w, h) }
  render(dt, focusPoint, tight) {
    if (this.dof && focusPoint) {
      const d = this.camera.position.distanceTo(focusPoint)
      this.focus += (d - this.focus) * Math.min(1, dt * 4)
      this.range += ((tight ? 4 : 14) - this.range) * Math.min(1, dt * 2)
      this.dof.cocMaterial.worldFocusDistance = this.focus
      this.dof.cocMaterial.worldFocusRange = this.range
    }
    if (this.godrays) this.godrays.blendMode.opacity.value = this.sky.night > 0.5 ? 0 : 1
    this.composer.render(dt)
  }
}
