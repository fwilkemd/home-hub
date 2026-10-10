import * as THREE from 'three'
import { heightAt, distToTrail, distToCreek, L } from './terrain.js'
import { tex } from './textures.js'

const vert = `
attribute vec3 iOffset; attribute float iScale; attribute float iRot; attribute float iTrodden; attribute float iRand;
uniform float time; uniform vec3 player; uniform sampler2D noiseMap;
varying vec2 vUv; varying float vShade; varying vec3 vN; varying vec3 vWp; varying float vRand; varying float vTrod;
#include <common>
#include <shadowmap_pars_vertex>
void main(){
  vUv = uv; vRand = iRand; vTrod = iTrodden;
  float y = uv.y;
  // level of detail: thin out and shrink with distance
  float dCam = distance(iOffset, cameraPosition);
  float lod = 1.0 - smoothstep(90.0, 170.0, dCam);
  float keep = step(dCam / 230.0, iRand + 0.08);
  float sc = iScale * lod * keep;
  vec3 p = position; p.y *= sc; p.x *= sc * (0.8 + 0.4 * iRand);
  float c = cos(iRot), s = sin(iRot);
  p.xz = mat2(c, -s, s, c) * p.xz;
  // wind: broad gusts from a noise texture plus a flutter
  float gust = texture2D(noiseMap, iOffset.xz * 0.012 + vec2(time * 0.025, time * 0.01)).r;
  float w = (gust - 0.5) * 1.6 + 0.35 * sin(time * 2.4 + iOffset.x * 0.4 + iOffset.z * 0.3);
  float bend = y * y;
  p.x += w * 0.42 * bend * sc; p.z += (w * 0.2 + 0.1 * sin(time * 1.7 + iOffset.z)) * bend * sc;
  // trodden blades lie flat
  vec3 flat_ = vec3(c * y * sc * 0.95, y * 0.06 * sc, s * y * sc * 0.95);
  p = mix(p, flat_, iTrodden);
  // trampled by the player
  vec2 toP = iOffset.xz - player.xz; float d = length(toP);
  float push = smoothstep(1.3, 0.0, d);
  vec2 dir = d > 0.001 ? toP / d : vec2(1.0, 0.0);
  p.xz += dir * push * y * sc * 1.1; p.y *= (1.0 - push * 0.6);
  vec3 wp = iOffset + p;
  vWp = wp;
  // a curved blade normal so light rolls across it
  vec3 n = normalize(vec3(s * 0.9 + (uv.x - 0.5) * c * 1.2, 0.45, c * 0.9 - (uv.x - 0.5) * s * 1.2));
  vN = n;
  vec4 worldPosition = vec4(wp, 1.0);
  vec3 transformedNormal = (viewMatrix * vec4(n, 0.0)).xyz;
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  #include <shadowmap_vertex>
}`
const frag = `
uniform sampler2D map; uniform sampler2D groundMap; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunI; uniform vec3 ambient; uniform float envI;
varying vec2 vUv; varying float vShade; varying vec3 vN; varying vec3 vWp; varying float vRand; varying float vTrod;
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
void main(){
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.5) discard;
  // tint each blade from the ground it grows in, so the meadow reads as one surface
  vec3 ground = texture2D(groundMap, vWp.xz * 0.16).rgb;
  vec3 albedo = t.rgb * (0.65 + 0.7 * ground / max(0.2, dot(ground, vec3(0.33))) * 0.5);
  albedo = mix(albedo, albedo * vec3(1.15, 1.05, 0.7), vRand * 0.35);
  albedo = mix(albedo, albedo * vec3(0.9, 0.8, 0.55), vTrod * 0.5);
  float shadow = 1.0;
  #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
    shadow = getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowIntensity, directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, vDirectionalShadowCoord[0]);
  #endif
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vWp);
  float ndl = max(dot(n, sunDir), 0.0) * 0.6 + 0.4 * max(dot(-n, sunDir), 0.0) + 0.25;
  // light through the blade when the sun is behind it
  float back = pow(max(dot(v, -sunDir), 0.0), 5.0) * 0.6;
  // specular sheen
  vec3 h = normalize(v + sunDir); float spec = pow(max(dot(n, h), 0.0), 24.0) * 0.18;
  float ao = 0.45 + 0.55 * vUv.y;
  vec3 col = albedo * (ambient * envI * ao + sunColor * sunI * 0.32 * (ndl + back) * shadow * ao) + sunColor * sunI * spec * shadow * 0.3;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export class Grass {
  constructor(scene, count = 220000) {
    const blade = new THREE.PlaneGeometry(0.1, 1.05, 1, 4)
    blade.translate(0, 0.525, 0)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = blade.index; geo.attributes.position = blade.attributes.position; geo.attributes.uv = blade.attributes.uv; geo.attributes.normal = blade.attributes.normal
    const off = new Float32Array(count * 3), sc = new Float32Array(count), rot = new Float32Array(count), tr = new Float32Array(count), rnd = new Float32Array(count)
    let n = 0
    const minX = -230, maxX = 230, minZ = -230, maxZ = L.woodEdgeZ + 2
    while (n < count) {
      const x = minX + Math.random() * (maxX - minX), z = minZ + Math.random() * (maxZ - minZ)
      const dp = Math.hypot(x - L.pond.x, z - L.pond.z)
      if (dp < L.pondR + 2.5) continue
      if (distToCreek(x, z) < 2.4) continue
      if (Math.hypot(x - L.car.x, z - L.car.z) < 2.6) continue
      const h = heightAt(x, z)
      if (h > 24) continue
      const dOak = Math.hypot(x - L.oak.x, z - L.oak.z)
      if (dOak < 7 && Math.random() < 0.94) continue
      const dc = Math.hypot(x + 20, z - 50)
      if (dc > 110 && Math.random() < 0.75) continue
      if (dc > 170 && Math.random() < 0.7) continue
      off[n * 3] = x; off[n * 3 + 1] = h; off[n * 3 + 2] = z
      let s = 0.7 + Math.random() * 0.75
      if (dp < L.pondR + 12) s *= 0.55 + 0.45 * ((dp - L.pondR - 2.5) / 9.5)
      if (dOak < 9) s *= 0.5
      sc[n] = s
      rot[n] = Math.random() * Math.PI * 2
      const dt = distToTrail(x, z)
      tr[n] = dt < 0.8 ? 1 : dt < 1.5 ? (1.5 - dt) / 0.7 : 0
      rnd[n] = Math.random()
      n++
    }
    geo.setAttribute('iOffset', new THREE.InstancedBufferAttribute(off, 3))
    geo.setAttribute('iScale', new THREE.InstancedBufferAttribute(sc, 1))
    geo.setAttribute('iRot', new THREE.InstancedBufferAttribute(rot, 1))
    geo.setAttribute('iTrodden', new THREE.InstancedBufferAttribute(tr, 1))
    geo.setAttribute('iRand', new THREE.InstancedBufferAttribute(rnd, 1))
    geo.instanceCount = count
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
      time: { value: 0 }, player: { value: new THREE.Vector3() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color('#fff') }, sunI: { value: 2 }, ambient: { value: new THREE.Color('#889') }, envI: { value: 1 },
      map: { value: null }, groundMap: { value: null }, noiseMap: { value: null },
    }])
    this.uniforms.map.value = tex('blade.png', { wrap: false, aniso: 4 })
    this.uniforms.groundMap.value = tex('grass_diff.jpg')
    this.uniforms.noiseMap.value = tex('noise.png', { srgb: false })
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide, lights: true, fog: false })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.receiveShadow = true
    this.mesh.name = 'grass'
    scene.add(this.mesh)
  }
  update(time, player, sky) {
    const u = this.uniforms
    u.time.value = time
    u.player.value.copy(player)
    u.sunDir.value.copy(sky.sunDir)
    u.sunColor.value.copy(sky.sun.color); u.sunI.value = sky.sun.intensity
    u.ambient.value.copy(sky.hemi.color).lerp(sky.hemi.groundColor, 0.35).multiplyScalar(0.9 + sky.hemi.intensity)
    u.envI.value = sky.scene.environmentIntensity
  }
}

function flowerTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    g.beginPath(); g.ellipse(64 + Math.cos(a) * 28, 64 + Math.sin(a) * 28, 26, 18, a, 0, Math.PI * 2); g.fill()
  }
  g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(64, 64, 13, 0, Math.PI * 2); g.fill()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Flowers: a petal quad on a stem, instanced with a colour per flower.
export async function buildFlowers(scene) {
  const count = 9000
  const petal = new THREE.PlaneGeometry(0.26, 0.26); petal.rotateX(-Math.PI / 2)
  const bm = new THREE.MeshStandardMaterial({ map: flowerTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 })
  const sm = new THREE.MeshStandardMaterial({ color: '#5a8a2e', roughness: 0.9 })
  const blossoms = new THREE.InstancedMesh(petal, bm, count)
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.012, 1, 4), sm, count)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), sq = new THREE.Quaternion()
  const cols = [new THREE.Color('#8e6fd8'), new THREE.Color('#f2d94a'), new THREE.Color('#6a8fe8'), new THREE.Color('#c79be6'), new THREE.Color('#f4f0f6')]
  const orange = new THREE.Color('#f28a2a'), red = new THREE.Color('#e0432b'), col = new THREE.Color()
  let i = 0
  const put = (x, z, c) => {
    if (i >= count) return
    const h = heightAt(x, z), fy = 0.38 + Math.random() * 0.3
    p.set(x, h + fy, z); q.setFromAxisAngle(up, Math.random() * 6.28)
    const sc = 0.8 + Math.random() * 0.6; s.set(sc, sc, sc)
    m.compose(p, q, s); blossoms.setMatrixAt(i, m); blossoms.setColorAt(i, c)
    p.set(x, h + fy / 2, z); s.set(1, fy, 1); m.compose(p, sq, s); stems.setMatrixAt(i, m)
    i++
  }
  while (i < count - 1100) {
    const x = -200 + Math.random() * 400, z = -200 + Math.random() * 340
    if (Math.hypot(x - L.pond.x, z - L.pond.z) < L.pondR + 6 || distToCreek(x, z) < 3 || heightAt(x, z) > 24) continue
    if (Math.sin(x * 0.09 + 1) * Math.cos(z * 0.08) < 0.35) continue
    put(x, z, cols[Math.floor(Math.random() * cols.length)])
  }
  for (let k = 0; k < 600; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 11; put(L.weed.x + Math.cos(a) * r, L.weed.z + Math.sin(a) * r, col.copy(orange).lerp(red, Math.random() * 0.4)) }
  for (let k = 0; k < 500; k++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 12
    const x = L.riparian.x + Math.cos(a) * r, z = L.riparian.z + Math.sin(a) * r
    if (distToCreek(x, z) < 2.5) continue
    put(x, z, col.copy(red).lerp(orange, Math.random()))
  }
  blossoms.count = i; stems.count = i
  blossoms.instanceMatrix.needsUpdate = true; blossoms.instanceColor.needsUpdate = true; stems.instanceMatrix.needsUpdate = true
  blossoms.name = 'flowers'; stems.name = 'flowers'
  scene.add(blossoms, stems)
  return [blossoms, stems]
}
