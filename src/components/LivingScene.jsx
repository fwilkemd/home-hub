import SceneAtmosphere from './SceneAtmosphere.jsx'
import TimeBlock from './TimeBlock.jsx'
import DayArc from './DayArc.jsx'
import NowPlayingCaption from './NowPlayingCaption.jsx'

/*
  THE LIVING SCENE.

  One continuous, full-bleed surface — no panels, no grid, no boxes. The album's
  palette is written into --a1 / --a2 / --a3 right here; because those are
  registered <color> custom properties with a transition, changing the album
  crossfades the WHOLE room over ~1.8s. Type and that moving light carry it all.

  Authored at a fixed 1280×800 (Fire HD 10, 16:10) and scaled as one unit by the
  parent stage. Tap anywhere — or press → — to drift to the next album's world;
  the structured layer (full week, an event's automations) lives one tap deeper,
  later. Right now we are just making it beautiful at rest.
*/
export default function LivingScene({ album, isPlaying, onAdvance }) {
  const [a1, a2, a3] = album.palette

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onClick={onAdvance}
      style={{
        background: 'var(--canvas)',
        '--a1': a1,
        '--a2': a2,
        '--a3': a3,
        transition: '--a1 1800ms ease, --a2 1800ms ease, --a3 1800ms ease',
        cursor: 'pointer',
      }}
    >
      <SceneAtmosphere />

      {/* Left — time, as part of the space. */}
      <div className="absolute" style={{ left: 84, top: '50%', transform: 'translateY(-54%)' }}>
        <TimeBlock />
      </div>

      {/* Right — the day's arc, drifting in. */}
      <div className="absolute" style={{ right: 84, top: '52%', transform: 'translateY(-46%)' }}>
        <DayArc />
      </div>

      {/* Foot — the music, named. */}
      <div className="absolute" style={{ left: 84, bottom: 58 }}>
        <NowPlayingCaption album={album} isPlaying={isPlaying} />
      </div>
    </div>
  )
}
