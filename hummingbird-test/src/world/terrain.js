import * as THREE from 'three'
import { QUALITY } from '../quality.js'
import { tex } from './textures.js'

// ---- World layout (metres). -Z is "north", the way the car faces into the meadow. ----
export const L = {
  car: new THREE.Vector3(0, 0, 140),
  woodEdgeZ: 146,
  oak: new THREE.Vector3(30, 0, 20),
  oakRest: new THREE.Vector3(27, 0, 27),
  pond: new THREE.Vector3(-75, 0, 50),
  pondR: 22,
  pondRest: new THREE.Vector3(-64, 0, 70),
  bramble: new THREE.Vector3(-78, 0, 24),
  brambleExit: new THREE.Vector3(-80, 0, 2),
  creekEnd: new THREE.Vector3(-84, 0, -40),
  weed: new THREE.Vector3(12, 0, 62),
  golf: new THREE.Vector3(46, 0, 36),
  riparian: new THREE.Vector3(-86, 0, -18),
}

export const TRAIL = [
  new THREE.Vector3(2, 0, 134), new THREE.Vector3(-12, 0, 122), new THREE.Vector3(-4, 0, 108),
  new THREE.Vector3(-22, 0, 96), new THREE.Vector3(-30, 0, 100), new THREE.Vector3(-44, 0, 86),
  new THREE.Vector3(-40, 0, 76), new THREE.Vector3(-62, 0, 72), new THREE.Vector3(-50, 0, 66),
  new THREE.Vector3(-30, 0, 70), new THREE.Vector3(-10, 0, 66), new THREE.Vector3(6, 0, 64),
  new THREE.Vector3(12, 0, 62),
]

export const CREEK = [
  new THREE.Vector3(-130, 0, -260), new THREE.Vector3(-104, 0, -190), new THREE.Vector3(-96, 0, -130),
  new THREE.Vector3(-84, 0, -70), new THREE.Vector3(-86, 0, -30), new THREE.Vector3(-80, 0, -4),
  new THREE.Vector3(-78, 0, 18), new THREE.Vector3(-75, 0, 36),
]

function distToPolyline(x, z, pts) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const abx = b.x - a.x, abz = b.z - a.z
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)))
    const dx = x - (a.x + abx * t), dz = z - (a.z + abz * t)
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d < best) best = d
  }
  return best
}
export const distToTrail = (x, z) => distToPolyline(x, z, TRAIL)
export const distToCreek = (x, z) => distToPolyline(x, z, CREEK)

const smooth = (t) => t * t * (3 - 2 * t)
const clamp01 = (v) => Math.max(0, Math.min(1, v))

function base(x, z) {
  let h = 0.9 * Math.sin(x * 0.021 + 0.4) * Math.cos(z * 0.027)
  h += 0.5 * Math.sin(x * 0.053 + 1.3) * Math.sin(z * 0.041 + 0.7)
  h += 0.25 * Math.sin(x * 0.11) * Math.cos(z * 0.13 + 2)
  const n = clamp01((-z - 160) / 260)
  h += smooth(n) * 38 + n * n * 30
  const e = clamp01((x - 200) / 260)
  h += smooth(e) * 30
  const w = clamp01((-x - 240) / 260)
  h += smooth(w) * 26
  return h
}

export const POND_WATER_Y = base(L.pond.x, L.pond.z) - 1.1

export function heightAt(x, z) {
  let h = base(x, z)
  const dp = Math.hypot(x - L.pond.x, z - L.pond.z)
  if (dp < L.pondR + 14) {
    const t = clamp01(1 - (dp - 2) / (L.pondR + 12))
    h -= smooth(t) * 3.4
  }
  const dc = distToCreek(x, z)
  if (dc < 7) h -= smooth(clamp01(1 - dc / 7)) * 1.6
  return h
}

export function groundNormal(x, z) {
  const e = 0.6
  const hx = heightAt(x + e, z) - heightAt(x - e, z)
  const hz = heightAt(x, z + e) - heightAt(x, z - e)
  return new THREE.Vector3(-hx, 2 * e, -hz).normalize()
}

// Per-point ground type weights: grass, dirt, sand, rock.
export function splatAt(x, z, h) {
  let grass = 1, dirt = 0, sand = 0, rock = 0
  const dp = Math.hypot(x - L.pond.x, z - L.pond.z)
  if (dp < L.pondR + 10) { const t = smooth(clamp01((L.pondR + 10 - dp) / 10)); dirt = t; if (dp < L.pondR + 3.5) sand = clamp01((L.pondR + 3.5 - dp) / 3.5) }
  const dc = distToCreek(x, z)
  if (dc < 5) sand = Math.max(sand, smooth(clamp01(1 - dc / 5)))
  const dt = distToTrail(x, z)
  if (dt < 1.6) dirt = Math.max(dirt, 0.55 * smooth(clamp01(1 - dt / 1.6)))
  const dOak = Math.hypot(x - L.oak.x, z - L.oak.z)
  if (dOak < 9) dirt = Math.max(dirt, 0.8 * smooth(clamp01((9 - dOak) / 6)))
  if (z > L.woodEdgeZ - 4) dirt = Math.max(dirt, 0.9 * clamp01((z - L.woodEdgeZ + 4) / 10))
  if (h > 24) rock = clamp01((h - 24) / 14)
  const v = Math.sin(x * 0.07 + 1) * Math.cos(z * 0.05)
  if (v > 0.55 && h < 24) dirt = Math.max(dirt, (v - 0.55) * 0.9)
  const sum = Math.max(0.0001, 1)
  grass = clamp01(1 - dirt - sand - rock)
  const tot = grass + dirt + sand + rock
  return [grass / tot, dirt / tot, sand / tot, rock / tot]
}

export function makeTerrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    map: tex('grass_diff.jpg'), normalMap: tex('grass_nor.jpg', { srgb: false }), roughness: 0.92, metalness: 0,
    vertexColors: true, normalScale: new THREE.Vector2(0.9, 0.9),
  })
  const extra = {
    dirtMap: { value: tex('dirt_diff.jpg') }, dirtNor: { value: tex('dirt_nor.jpg', { srgb: false }) },
    sandMap: { value: tex('sand_diff.jpg') }, sandNor: { value: tex('sand_nor.jpg', { srgb: false }) },
    rockMap: { value: tex('rock_diff.jpg') }, rockNor: { value: tex('rock_nor.jpg', { srgb: false }) },
    macroMap: { value: tex('macro.jpg', { srgb: false }) },
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, extra)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vWorldPos;`)
      .replace('#include <project_vertex>', `#include <project_vertex>\nvSplat = splat; vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vSplat; varying vec3 vWorldPos;
        uniform sampler2D dirtMap, dirtNor, sandMap, sandNor, rockMap, rockNor, macroMap;`)
      .replace('#include <map_fragment>', `
        vec2 tuv = vWorldPos.xz * 0.16;
        vec4 g = texture2D(map, tuv) * vSplat.x + texture2D(dirtMap, tuv * 1.37) * vSplat.y + texture2D(sandMap, tuv * 1.9) * vSplat.z + texture2D(rockMap, tuv * 0.45) * vSplat.w;
        float macro = texture2D(macroMap, vWorldPos.xz * 0.0045).r;
        g.rgb *= 0.72 + 0.5 * macro;
        diffuseColor *= g;`)
      .replace('#include <normal_fragment_maps>', `
        #ifdef USE_NORMALMAP
          vec3 mapN = texture2D(normalMap, tuv).xyz * vSplat.x + texture2D(dirtNor, tuv * 1.37).xyz * vSplat.y + texture2D(sandNor, tuv * 1.9).xyz * vSplat.z + texture2D(rockNor, tuv * 0.45).xyz * vSplat.w;
          mapN = mapN * 2.0 - 1.0;
          mapN.xy *= normalScale;
          normal = normalize( getTangentFrame( - vViewPosition, normal, tuv ) * mapN );
        #endif`)
  }
  return mat
}

export function buildTerrain() {
  const size = 1400, seg = QUALITY.terrainSegments
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3), splat = new Float32Array(pos.count * 4)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const h = heightAt(x, z)
    pos.setY(i, h)
    const s = splatAt(x, z, h)
    splat.set(s, i * 4)
    // a tint: darker under the wood and in the pond bowl, slight variation elsewhere
    let v = 0.92 + 0.1 * Math.sin(x * 0.31) * Math.cos(z * 0.27)
    if (z > L.woodEdgeZ) v *= 0.55 + 0.25 * clamp01(1 - (z - L.woodEdgeZ) / 40)
    const dp = Math.hypot(x - L.pond.x, z - L.pond.z)
    if (dp < L.pondR + 2) v *= 0.75
    colors[i * 3] = v; colors[i * 3 + 1] = v; colors[i * 3 + 2] = v
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, makeTerrainMaterial())
  mesh.receiveShadow = true
  mesh.name = 'terrain'
  return mesh
}
