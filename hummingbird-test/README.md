# The Hummingbird Test — playable prototype

A first playable slice of *The Hummingbird Test*, built from Act 1 ("of mountains & meadows").
You play Ananelia across one day in the hidden meadow: the car at the wood's edge, Jay's zig-zag
trail, the pond, the argument at the butterfly weed, the episode, the oak, the frog, golf at dusk,
the bramble, the white alleyway, and the moonstruck creek. Between beats you are the nestling.

The rendering is a real-time pipeline in the spirit of a modern open-world game (see DESIGN.md,
"Rendering"): physically based materials, image-based lighting from a physical sky, soft shadows,
textured wind-blown grass that takes shadows, leaf-card trees, a planar-reflection pond, and a
post-processing stack (ambient occlusion, height fog with sun scatter, bloom, depth of field, god
rays, film grain, AgX tone mapping). Characters are a rigged, animated mannequin for now. No audio.

## Run it

```
cd hummingbird-test
npm install
npm run dev
```

Open the printed URL in Chrome/Edge/Firefox on a machine with a real GPU. Click to begin.

| key | does |
| --- | --- |
| W A S D | walk |
| shift | run (her lungs burn fast) |
| mouse | look |
| E | interact |
| J | journal, ledger, leaf tracings |
| space | advance a line |
| 1 2 3 | pick a reply |
| esc | pause |

URL switches for testing:

- `?beat=dusk` start at a beat: `car trail weed oak frog dusk bramble alley moon`
- `?lite` fewer grass blades, no shadows, no SSAO / DOF / god rays (laptops, headless)
- `?nopost` plain forward render, no post-processing at all
- `?fast` shortens scripted waits

A debug handle is on `window.__hb` (for example `__hb.player.setPosition(-75, 70)` teleports).

## Where things live

```
src/main.js              boot, asset loading, render loop, pause
src/post.js              post-processing stack (SSAO, height fog, DOF, god rays, bloom, grain, tone map)
src/quality.js           ?lite / ?beat / ?nopost switches
src/world/textures.js    texture loader and the shared wind sway for leaf cards
public/assets/           textures (generated + CC0), the rigged mannequin, water normals
src/world/terrain.js     the map: landmark positions (L), the trail, the creek, heightAt(), splat material
src/world/sky.js         time of day presets, physical sky + IBL, sun/moon, clouds, stars, lens flare, rain
src/world/grass.js       instanced textured grass (wind, shadows, translucency, LOD, trampling); flowers
src/world/flora.js       leaf-card trees, the oak, mountains, bramble
src/world/water.js       reflective pond and the creek
src/world/props.js       car, golf bag, balls, frog, leaf
src/chars/rig.js         the rigged mannequin: locomotion clips + layered static poses
src/chars/figure.js      the old primitive humanoid (still used for the alley statue)
src/chars/player.js      third-person controller, stamina, camera
src/chars/jay.js         Jay: paths, poses, golf swing
src/chars/hummingbird.js the golden flit
src/story/data.js        ALL text: ledger documents, journal pages, interludes, dialogue scripts
src/story/director.js    the beats, in order, with their staging
src/story/interlude.js   "you are a hummingbird" scenes (nest, sight, branching, fire)
src/story/alley.js       the white alleyway vision
src/ui/*                 HUD, dialogue box, journal, overlays, styles
```

To change what a scene says, edit `src/story/data.js`. To change where things are, edit `L` in
`src/world/terrain.js`. To change how a beat is staged, edit the matching `beat_*` in
`src/story/director.js`.

See `DESIGN.md` for the full-game vision and what a real production would need.
