import * as THREE from 'three'
import { heightAt, distToTrail, distToCreek, L } from './terrain.js'

function mergeGeos(list) {
  const pos = [], uv = [], idx = []; let base = 0
  for (const g of list) {
    pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array)
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.array[i] + base)
    base += g.attributes.position.count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setIndex(idx)
  return out
}

const vert = `
attribute vec3 iOffset; attribute float iScale; attribute float iRot; attribute float iTrodden; attribute float iTint;
uniform float time; uniform vec3 player; uniform vec3 sunDir; uniform vec3 oak;
varying float vH; varying float vTint; varying float vShade;
#include <fog_pars_vertex>
void main(){
  float y = uv.y;
  float taper = 1.0 - y * 0.8;
  vec3 p = position; p.x *= taper; p.y *= iScale;
  float c = cos(iRot), s = sin(iRot);
  p.xz = mat2(c, -s, s, c) * p.xz;
  float w = sin(time * 1.3 + iOffset.x * 0.17 + iOffset.z * 0.12) * 0.55 + sin(time * 2.9 + iOffset.z * 0.31 + iOffset.x * 0.05) * 0.25;
  float bend = y * y;
  p.x += w * 0.30 * bend * iScale; p.z += w * 0.14 * bend * iScale;
  vec3 flat_ = vec3(c * y * iScale * 0.95, y * 0.07 * iScale, s * y * iScale * 0.95);
  p = mix(p, flat_, iTrodden);
  vec2 toP = iOffset.xz - player.xz; float d = length(toP);
  float push = smoothstep(1.4, 0.0, d);
  vec2 dir = d > 0.001 ? toP / d : vec2(1.0, 0.0);
  p.xz += dir * push * y * iScale * 1.1; p.y *= (1.0 - push * 0.65);
  vec3 wp = iOffset + p;
  vH = y; vTint = iTint;
  vec3 n = normalize(vec3(s, 0.35, c));
  float shade = 0.55 + 0.45 * abs(dot(n, sunDir));
  float od = distance(iOffset.xz, oak.xz);
  shade *= 1.0 - 0.5 * smoothstep(15.0, 5.0, od) * max(sunDir.y, 0.0);
  vShade = shade;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`
const frag = `
uniform vec3 sunColor; uniform float sunI; uniform vec3 ambient; uniform vec3 baseCol; uniform vec3 tipCol; uniform vec3 dryCol;
varying float vH; varying float vTint; varying float vShade;
#include <fog_pars_fragment>
void main(){
  vec3 col = mix(baseCol, tipCol, pow(vH, 1.3));
  col = mix(col, dryCol, vTint * 0.55);
  vec3 light = ambient * 0.7 + sunColor * sunI * 0.2 * vShade;
  col *= light;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export class Grass {
  constructor(scene, count = 170000) {
    // one instance is a tuft: three blades fanned 60 degrees apart
    const parts = []
    for (let k = 0; k < 5; k++) {
      const b = new THREE.PlaneGeometry(0.075, 0.9 + (k % 2) * 0.25, 1, 3); b.translate(0, (0.9 + (k % 2) * 0.25) / 2, 0); b.rotateY((k / 5) * Math.PI)
      const a = (k / 5) * Math.PI * 2; b.translate(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14)
      parts.push(b)
    }
    const blade = mergeGeos(parts)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = blade.index; geo.attributes.position = blade.attributes.position; geo.attributes.uv = blade.attributes.uv
    const off = new Float32Array(count * 3), sc = new Float32Array(count), rot = new Float32Array(count)
    const tr = new Float32Array(count), tint = new Float32Array(count)
    let n = 0
    const minX = -230, maxX = 230, minZ = -230, maxZ = L.woodEdgeZ + 2
    while (n < count) {
      const x = minX + Math.random() * (maxX - minX), z = minZ + Math.random() * (maxZ - minZ)
      const dp = Math.hypot(x - L.pond.x, z - L.pond.z)
      if (dp < L.pondR + 2.5) continue
      if (distToCreek(x, z) < 2.6) continue
      if (Math.hypot(x - L.car.x, z - L.car.z) < 2.6) continue
      const h = heightAt(x, z)
      if (h > 26) continue
      // soft earth under the oak's canopy, not grass
      const dOak = Math.hypot(x - L.oak.x, z - L.oak.z)
      if (dOak < 7 && Math.random() < 0.96) continue
      // most of the budget goes where the player walks; the far meadow thins out under fog
      const dc = Math.hypot(x + 20, z - 50)
      if (dc > 110 && Math.random() < 0.8) continue
      if (dc > 170 && Math.random() < 0.7) continue
      off[n * 3] = x; off[n * 3 + 1] = h; off[n * 3 + 2] = z
      let s = 0.8 + Math.random() * 0.7
      if (dp < L.pondR + 12) s *= 0.55 + 0.45 * ((dp - L.pondR - 2.5) / 9.5)
      if (dOak < 9) s *= 0.5
      sc[n] = s
      rot[n] = Math.random() * Math.PI * 2
      const dt = distToTrail(x, z)
      tr[n] = dt < 0.8 ? 1 : dt < 1.5 ? (1.5 - dt) / 0.7 : 0
      tint[n] = Math.max(0, Math.sin(x * 0.07) * Math.cos(z * 0.05) + Math.random() * 0.5 - 0.3)
      n++
    }
    geo.setAttribute('iOffset', new THREE.InstancedBufferAttribute(off, 3))
    geo.setAttribute('iScale', new THREE.InstancedBufferAttribute(sc, 1))
    geo.setAttribute('iRot', new THREE.InstancedBufferAttribute(rot, 1))
    geo.setAttribute('iTrodden', new THREE.InstancedBufferAttribute(tr, 1))
    geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(tint, 1))
    geo.instanceCount = count
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, player: { value: new THREE.Vector3() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
      oak: { value: L.oak.clone() }, sunColor: { value: new THREE.Color('#fff') }, sunI: { value: 2 },
      ambient: { value: new THREE.Color('#889') }, baseCol: { value: new THREE.Color('#2a4418') },
      tipCol: { value: new THREE.Color('#7f9e3a') }, dryCol: { value: new THREE.Color('#b8a45e') },
    }])
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide, fog: true })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
  }
  update(time, player, sky) {
    this.uniforms.time.value = time
    this.uniforms.player.value.copy(player)
    this.uniforms.sunDir.value.copy(sky.sunDir)
    this.uniforms.sunColor.value.copy(sky.sun.color); this.uniforms.sunI.value = sky.sun.intensity
    this.uniforms.ambient.value.copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity * 1.6)
  }
}

function flowerTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    g.beginPath(); g.arc(32 + Math.cos(a) * 13, 32 + Math.sin(a) * 13, 11, 0, Math.PI * 2); g.fill()
  }
  g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(32, 32, 7, 0, Math.PI * 2); g.fill()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function buildFlowers(scene) {
  const tex = flowerTexture()
  const quad = new THREE.PlaneGeometry(0.26, 0.26)
  quad.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })
  const count = 9000
  const mesh = new THREE.InstancedMesh(quad, mat, count)
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.012, 0.7, 4), new THREE.MeshLambertMaterial({ color: '#5f8a2e' }), count)
  const stemP = new THREE.Vector3(), stemQ = new THREE.Quaternion(), stemS = new THREE.Vector3(1, 1, 1), stemM = new THREE.Matrix4()
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
  const cols = [new THREE.Color('#8e6fd8'), new THREE.Color('#f2d94a'), new THREE.Color('#6a8fe8'), new THREE.Color('#b791e6'), new THREE.Color('#e9e5f0')]
  const orange = new THREE.Color('#f28a2a'), red = new THREE.Color('#e0432b'), col = new THREE.Color()
  let i = 0
  const put = (x, z, c) => {
    const h = heightAt(x, z)
    const fy = h + 0.42 + Math.random() * 0.3
    p.set(x, fy, z)
    stemP.set(x, h + (fy - h) / 2, z); stemS.set(1, (fy - h) / 0.7, 1); stemM.compose(stemP, stemQ, stemS); stems.setMatrixAt(i, stemM)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28)
    const sc = 0.8 + Math.random() * 0.6; s.set(sc, sc, sc)
    m.compose(p, q, s); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c); i++
  }
  // meadow scatter: purple yellow blue
  while (i < count - 1100) {
    const x = -200 + Math.random() * 400, z = -200 + Math.random() * 340
    if (Math.hypot(x - L.pond.x, z - L.pond.z) < L.pondR + 6 || distToCreek(x, z) < 3 || heightAt(x, z) > 26) continue
    // patches, not an even dusting
    if (Math.sin(x * 0.09 + 1) * Math.cos(z * 0.08) < 0.35) continue
    put(x, z, cols[Math.floor(Math.random() * cols.length)])
  }
  // butterfly weed around the argument spot
  for (let k = 0; k < 600; k++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 11
    put(L.weed.x + Math.cos(a) * r, L.weed.z + Math.sin(a) * r, col.copy(orange).lerp(red, Math.random() * 0.4))
  }
  // the riparian patch up the creek: the red and orange a hummingbird prefers
  for (let k = 0; k < 500; k++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 12
    const x = L.riparian.x + Math.cos(a) * r, z = L.riparian.z + Math.sin(a) * r
    if (distToCreek(x, z) < 2.5) continue
    put(x, z, col.copy(red).lerp(orange, Math.random()))
  }
  mesh.count = i; stems.count = i
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; stems.instanceMatrix.needsUpdate = true
  scene.add(mesh, stems)
  return mesh
}
