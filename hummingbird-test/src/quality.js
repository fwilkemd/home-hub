// Quality knobs. ?lite in the URL for weak GPUs or headless testing.
const q = new URLSearchParams(location.search)
export const LITE = q.has('lite')
export const QUALITY = {
  grass: LITE ? 50000 : 220000,
  terrainSegments: LITE ? 160 : 360,
  woodDensity: LITE ? 0.45 : 1,
  shadows: !LITE,
  shadowMap: LITE ? 1024 : 4096,
  reflection: LITE ? 256 : 1024,
  pixelRatio: LITE ? 1 : Math.min(window.devicePixelRatio, 1.25),
  post: !q.has('nopost'),
  ssao: !LITE, dof: !LITE, godrays: !LITE,
  msaa: LITE ? 0 : 4,
  fog: !q.has('nofog'), grade: !q.has('nograde'),
  fx: new Set((q.get('fx') || 'bloom,grade,vignette,noise').split(',')),
}
export const START_BEAT = q.get('beat') || 'car'
