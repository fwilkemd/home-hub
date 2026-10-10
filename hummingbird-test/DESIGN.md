# The Hummingbird Test — game design brief

What a full production of the novel would be, and how this prototype maps onto it.

## One line

A slow, cinematic, third-person story game about a day in a meadow with your best friend, told
through a mind that cannot tell what to take as true. Between the human beats you are a hummingbird
nestling learning to see, then to fly.

## Pillars

1. **Glance, then stay.** The pace of Red Dead Redemption 2 without the guns: walking is the main
   verb, the camera is cinematic by default, nothing is rushed. Running is possible and costs her
   something (lungs burning, a blackout risk).
2. **The information ledger.** The novel intercuts the patient file, Gracie's emails, and the journal.
   The game does the same: documents unlock at rest points and the player reads them in a journal,
   the way Arthur Morgan's journal works, but here the documents disagree with the protagonist.
3. **Two worlds, one grip.** Ananelia's day and the nestling's life run in parallel and rhyme
   (branching stage ↔ the bramble; "Again." ↔ the golf swing). The nestling sequences are playable
   perception, not cutscenes: sight exploding, saccades, wing beats.
4. **Episodes are a lens, not a failure state.** Half the world going dark, white light, the alleyway
   and the seraph. Handled with care, the way Hellblade handles psychosis: the player experiences it
   and is never told which reading is correct.
5. **Jay is a person.** A companion with her own day (the frog, the golf bag that is Carson's, "I'm
   unhappy"). Dialogue choices shift the heat between them but never let you "win" the argument.

## Systems

| system | this prototype | full production |
| --- | --- | --- |
| World | procedural meadow, oak, pond, creek, bramble, wood, mountains | hand-built meadow at the novel's scale; the hill country and the drive there |
| Characters | primitive figures with poses | rigged, motion-captured Ananelia and Jay; faces matter more than anything |
| Camera | over-shoulder follow + scripted cinematic shots | full cinematic camera system, letterboxed conversations, slow pushes |
| Movement | walk / run / winded, grass trampling | footstep audio, terrain-aware animation, sitting and lying anywhere |
| Dialogue | choice nodes with "heat" and "venom", inner voice lines | performed VO, interruptions, choices that land mid-sentence (the stutter is a mechanic) |
| Journal | journal pages, ledger docs, leaf tracings | hand-drawn journal, tracing minigame, puns the player can write |
| Compulsions | LOCK pressed five times | counting, re-checking the glovebox, pressing LOCK, all optional and all noticed |
| Episodes | half-vision, black, white, vignette, shake | audio-led perception shifts; the alleyway as an explorable space with the stone steps |
| Nestling | four text-led perception scenes | playable nest: touch-only world, sight bloom, saccade targeting, wing push-and-scoop with real lift |
| Time | four presets lerped per beat; dusk timer | continuous day; the hummingbird feeds before dark and the light actually runs out |
| Audio | none | hummingbird wing hum, Jay's radio song, thwock!, the creek, rain on oak leaves |

## Act structure for Act 1

car → trail (lock ritual, the pond, lungs) → butterfly weed (the argument, choices) → episode →
**nestling: egg** → the oak (journal, leaf) → **nestling: sight** → frog, the push → **nestling:
branching, "Again."** → dusk, golf, "I'm unhappy" → up creek, light running out → bramble →
white alleyway, "given two choices" → fall → **nestling: fire** → moonstruck creek → (after) the
riparian patch, melody both ways.

## Rendering

Rockstar's engine is proprietary and was not touched. What RDR2 does on screen is, however, well
documented (frame studies, GDC talks), and the prototype rebuilds the same stack on the web:

| RDR2 technique | here |
| --- | --- |
| physically based materials, image-based lighting | MeshStandard / Physical materials; the sky is rendered to a PMREM environment map every time of day changes |
| atmospheric sky, time of day | Preetham sky (Three.js `Sky`), sun → moon handoff, stars, a cloud layer, lens flare |
| cascaded shadow maps | one 4k soft shadow map following the player (CSM is the obvious next step) |
| terrain layers | splat material: grass / dirt / sand / rock albedo + normal maps blended per vertex, macro variation to kill tiling |
| grass with wind and shadows | 220k instanced textured blades: gust noise, trampling, trodden trail, shadow sampling, back-lighting, distance LOD |
| trees | leaf-card canopies with alpha test and sway; bark normal maps |
| water | planar reflection with distortion for the pond; normal-mapped creek with moon glints |
| volumetric fog / god rays | depth-reconstructed height fog with sun in-scatter; screen-space god rays from the sun disc |
| SSAO, bloom, DOF, film look | postprocessing: SSAO, bloom, depth of field focused on Ananelia (tighter in dialogue), vignette, grain, AgX tone mapping |

What this is not yet: real character art (the mannequin is a Mixamo rig with idle / walk / run and
layered poses), scanned textures (ground and bark are generated), volumetric clouds, TAA.

## What was "reverse engineered"

Not code. Rockstar's engine and content are proprietary and were not touched. What was studied is
the publicly observable design of games that do this well, and what in the novel maps to each:

- RDR2: deliberate movement, contextual prompts, journal, honor as a running tally → *heat and venom*.
- Firewatch: a companion you argue with, in a landscape, with a timer you feel in the light.
- What Remains of Edith Finch: each interlude plays a different way (the nestling scenes).
- Hellblade: perception as mechanic, handled with consultation.
- Disco Elysium: the inner voice as its own speaker in dialogue.
- Journey / Kentucky Route Zero: restraint, typography, letting silence sit.

## Next steps, in order

1. Audio pass: the single biggest jump in feel for the least work.
2. Replace figures with real characters (even a single good rig for both).
3. Make the nestling scenes playable: saccade targeting, the push-and-scoop lift.
4. The alleyway as a space to walk, with the stone steps.
5. Act 2 beats once the text exists.
