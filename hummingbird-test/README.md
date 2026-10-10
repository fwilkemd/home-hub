# The Hummingbird Test — playable prototype

A first playable slice of *The Hummingbird Test*, built from Act 1 ("of mountains & meadows").
You play Ananelia across one day in the hidden meadow: the car at the wood's edge, Jay's zig-zag
trail, the pond, the argument at the butterfly weed, the episode, the oak, the frog, golf at dusk,
the bramble, the white alleyway, and the moonstruck creek. Between beats you are the nestling.

Everything on screen is a stand-in: procedural meadow, primitive figures, no audio. The structure,
the text, and the feel are what this prototype is testing.

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
- `?lite` fewer grass blades, no shadows (laptops, headless)
- `?fast` shortens scripted waits

A debug handle is on `window.__hb` (for example `__hb.player.setPosition(-75, 70)` teleports).

## Where things live

```
src/main.js              boot, render loop, pause
src/quality.js           ?lite / ?beat switches
src/world/terrain.js     the map: landmark positions (L), the trail, the creek, heightAt()
src/world/sky.js         time of day presets, sun, fog, rain
src/world/grass.js       instanced grass with wind, trodden trail, trampling; flowers
src/world/flora.js       the oak, the wood, mountains, bramble
src/world/water.js       pond and creek shader
src/world/props.js       car, golf bag, balls, frog, leaf
src/chars/figure.js      the primitive humanoid and its poses
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
