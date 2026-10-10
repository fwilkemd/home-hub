import * as THREE from 'three'

const loader = new THREE.TextureLoader()
const BASE = `${import.meta.env.BASE_URL}assets/`
const cache = {}
export const ASSET = (name) => BASE + name

// Shared texture loader. Colour textures are sRGB, data textures (normals, masks) are linear.
export function tex(name, { srgb = true, repeat = 1, aniso = 8, wrap = true } = {}) {
  const key = `${name}|${srgb}|${repeat}|${wrap}`
  if (cache[key]) return cache[key]
  const t = loader.load(ASSET(name))
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat) }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = aniso
  cache[key] = t
  return t
}

// One clock for every wind-driven shader.
export const WIND = { value: 0 }

// Adds a gentle sway to any standard material (used by leaf cards and the bramble).
export function withSway(material, { strength = 0.08, minY = 1.5, maxY = 8 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = WIND
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float windTime;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 swayWP = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vec3 swayWP = (modelMatrix * vec4(position, 1.0)).xyz;
        #endif
        float swayK = smoothstep(${minY.toFixed(2)}, ${maxY.toFixed(2)}, position.y) * ${strength.toFixed(3)};
        transformed.x += (sin(windTime * 1.2 + swayWP.x * 0.35 + swayWP.z * 0.2) + 0.5 * sin(windTime * 2.9 + swayWP.z * 0.7)) * swayK;
        transformed.z += cos(windTime * 1.0 + swayWP.z * 0.3) * swayK * 0.6;`)
  }
  return material
}
