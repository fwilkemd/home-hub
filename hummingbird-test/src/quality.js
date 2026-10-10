// Quality knobs. ?lite in the URL for weak GPUs or headless testing.
const q = new URLSearchParams(location.search)
export const LITE = q.has('lite')
export const QUALITY = {
  grass: LITE ? 30000 : 130000,
  terrainSegments: LITE ? 160 : 360,
  woodDensity: LITE ? 0.45 : 1,
  shadows: !LITE,
  pixelRatio: LITE ? 1 : Math.min(window.devicePixelRatio, 1.5),
}
export const START_BEAT = q.get('beat') || 'car'
