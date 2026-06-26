/*
  The calm↔lively dial — the room's mood, not a settings page. A quiet three-stop
  control in the corner: calm · auto · lively. Tap a stop to turn the whole room's
  energy (motion, brightness, how closed-in it feels). 'auto' hands it back to the
  time of day. The choice sticks (persisted) so each person can trust it.

  Type-led, lit by the album like everything else. It swallows its own pointer
  events so turning the mood never also turns the room (gestures stay disjoint).
*/
import { MOOD_STOPS } from './energy.js'

const stop = (e) => e.stopPropagation()
const LABEL = { calm: 'calm', auto: 'auto', lively: 'lively' }

export default function MoodDial({ mode, setMode }) {
  return (
    <div
      className="mood"
      role="group"
      aria-label="Room mood"
      onPointerDown={stop}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      {MOOD_STOPS.map((m) => (
        <button
          key={m}
          type="button"
          className={`mood-stop${mode === m ? ' is-on' : ''}`}
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
        >
          {LABEL[m]}
        </button>
      ))}
    </div>
  )
}
