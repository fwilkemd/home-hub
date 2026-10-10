import * as THREE from 'three'
import { Water as PlanarWater } from 'three/examples/jsm/objects/Water.js'
import { heightAt, L, POND_WATER_Y, CREEK } from './terrain.js'
import { tex } from './textures.js'
import { QUALITY } from '../quality.js'

const vert = `
varying vec3 vWorld; varying vec3 vNormalW;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz; vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`
const frag = `
uniform float time; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunI; uniform vec3 skyColor; uniform vec3 deepColor; uniform float night; uniform sampler2D normalMap;
varying vec3 vWorld; varying vec3 vNormalW;
vec3 getNoise(vec2 uv){
  vec2 uv0 = uv / 11.0 + vec2(time / 17.0, time / 29.0);
  vec2 uv1 = uv / 7.0 - vec2(time / -19.0, time / 31.0);
  vec2 uv2 = uv / vec2(8.0, 10.0) + vec2(time / 101.0, time / 97.0);
  vec4 n = texture2D(normalMap, uv0) + texture2D(normalMap, uv1) + texture2D(normalMap, uv2);
  return normalize(n.xzy * 2.0 - 3.0);
}
void main(){
  vec3 n = getNoise(vWorld.xz * 2.5); n = normalize(vec3(n.x * 0.35, 1.0, n.z * 0.35));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = mix(deepColor, skyColor, 0.3 + 0.65 * fres);
  vec3 h = normalize(v + sunDir);
  float spec = pow(max(dot(n, h), 0.0), 220.0) * sunI * 1.2;
  float glint = pow(max(dot(n, h), 0.0), 30.0) * night * 1.8;
  col += sunColor * (spec + glint);
  gl_FragColor = vec4(col, 0.82 + 0.16 * fres);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export class Water {
  constructor(scene) {
    const normals = tex('waternormals.jpg', { srgb: false })
    // the pond: a planar reflection
    this.pond = new PlanarWater(new THREE.CircleGeometry(L.pondR + 2, 64), {
      textureWidth: QUALITY.reflection, textureHeight: QUALITY.reflection, waterNormals: normals,
      sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff, waterColor: 0x1d4a44, distortionScale: 1.8, fog: false,
    })
    this.pond.rotation.x = -Math.PI / 2
    this.pond.position.set(L.pond.x, POND_WATER_Y, L.pond.z)
    this.pond.material.uniforms.size.value = 6
    scene.add(this.pond)
    // the creek: a ribbon with the same normal map, no reflection
    this.uniforms = {
      time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color('#fff') }, sunI: { value: 1 },
      skyColor: { value: new THREE.Color('#9fb8d8') }, deepColor: { value: new THREE.Color('#1c3a36') }, night: { value: 0 }, normalMap: { value: normals },
    }
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false })
    const w = 2.2
    const pts = new THREE.CatmullRomCurve3(CREEK, false, 'centripetal', 0.5).getPoints(220)
    const verts = [], idx = [], norm = []
    for (let i = 0; i < pts.length; i++) {
      const c = pts[i], nxt = pts[Math.min(i + 1, pts.length - 1)], prv = pts[Math.max(i - 1, 0)]
      const d = nxt.clone().sub(prv).normalize()
      const side = new THREE.Vector3(-d.z, 0, d.x)
      const y = heightAt(c.x, c.z) + 0.75
      const l = c.clone().addScaledVector(side, -w), r = c.clone().addScaledVector(side, w)
      verts.push(l.x, y, l.z, r.x, y, r.z); norm.push(0, 1, 0, 0, 1, 0)
      if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k) }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3))
    g.setIndex(idx)
    this.creek = new THREE.Mesh(g, mat)
    scene.add(this.creek)
    this.meshes = [this.pond, this.creek]
  }
  update(time, sky, dt = 0.016) {
    const u = this.uniforms
    u.time.value = time
    u.sunDir.value.copy(sky.sunDir); u.sunColor.value.copy(sky.sun.color); u.sunI.value = sky.sun.intensity
    u.skyColor.value.copy(sky.fogColor).lerp(sky.hemi.color, 0.6).multiplyScalar(1 - sky.night * 0.75)
    u.night.value = sky.night
    const pu = this.pond.material.uniforms
    pu.time.value += dt * 0.5
    pu.sunDirection.value.copy(sky.sunDir)
    pu.sunColor.value.copy(sky.sun.color).multiplyScalar(Math.min(1, sky.sun.intensity / 3))
    pu.waterColor.value.set(0x1d4a44).multiplyScalar(1 - sky.night * 0.8)
  }
}
