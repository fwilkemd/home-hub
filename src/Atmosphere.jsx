/*
  Music as light. This layer is ALWAYS on, behind every state — it's the air the
  room breathes. Big soft glows in the album's colors (--a1/--a2/--a3) drift on
  their own, a luminous bloom pulses, and a vignette focuses the frame.

  It never re-mounts between turns, so it's the constant the content composes on.
  When the track changes, the colors it references transition (declared on the
  stage), so the entire field crossfades to the new palette over ~1.8s.
*/
export default function Atmosphere() {
  return (
    <div className="atmos" aria-hidden="true">
      <div className="glow glow-1" />
      <div className="glow glow-2" />
      <div className="glow glow-3" />
      <div className="bloom" />
      <div className="grain" />
      <div className="vignette" />
    </div>
  )
}
