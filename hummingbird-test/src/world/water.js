import * as THREE from 'three'
import { heightAt, L, POND_WATER_Y, CREEK } from './terrain.js'

const vert = `
varying vec3 vWorld; varying vec3 vNormalW;
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`
const frag = `
uniform float time; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunI; uniform vec3 skyColor; uniform vec3 deepColor; uniform float night;
varying vec3 vWorld; varying vec3 vNormalW;
#include <fog_pars_fragment>
void main(){
  vec2 p = vWorld.xz;
  float r1 = sin(p.x * 1.7 + time * 1.1) + sin(p.y * 1.3 - time * 0.9);
  float r2 = sin((p.x + p.y) * 0.9 + time * 1.7) + sin((p.x - p.y) * 2.3 + time * 0.6);
  vec3 n = normalize(vec3(r1 * 0.04, 1.0, r2 * 0.04));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  vec3 col = mix(deepColor, skyColor, 0.35 + 0.6 * fres);
  vec3 h = normalize(v + sunDir);
  float spec = pow(max(dot(n, h), 0.0), 160.0) * sunI * 0.9;
  float glint = pow(max(dot(n, h), 0.0), 40.0) * night * 1.6;
  col += sunColor * (spec + glint);
  float alpha = 0.78 + 0.2 * fres;
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export class Water {
  constructor(scene) {
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color('#fff') }, sunI: { value: 1 },
      skyColor: { value: new THREE.Color('#9fb8d8') }, deepColor: { value: new THREE.Color('#1f3a3a') }, night: { value: 0 },
    }])
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, fog: true, depthWrite: false })
    const pond = new THREE.Mesh(new THREE.CircleGeometry(L.pondR + 2, 64), mat)
    pond.rotation.x = -Math.PI / 2
    pond.position.set(L.pond.x, POND_WATER_Y, L.pond.z)
    scene.add(pond)
    // creek ribbon
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
    const creek = new THREE.Mesh(g, mat)
    scene.add(creek)
    this.meshes = [pond, creek]
  }
  update(time, sky) {
    this.uniforms.time.value = time
    this.uniforms.sunDir.value.copy(sky.sunDir)
    this.uniforms.sunColor.value.copy(sky.sun.color); this.uniforms.sunI.value = sky.sun.intensity
    this.uniforms.skyColor.value.copy(sky.uniforms.horizon.value).lerp(sky.uniforms.zenith.value, 0.5)
    this.uniforms.night.value = sky.night
  }
}
