import { useCallback, useEffect, useRef, useState } from 'react'
import Stage from './Stage.jsx'
import Atmosphere from './Atmosphere.jsx'
import Now from './states/Now.jsx'
import Music from './states/Music.jsx'
import Day from './states/Day.jsx'
import { TRACKS, TODAY } from './data/mock.js'
import { theme } from './theme.js'

// The room can be turned to exactly these three walls, in this order.
const ORDER = ['now', 'music', 'day']

/*
  The mechanism.

  - Withholding: exactly ONE state is the active wall at any rest. The others
    are not in the DOM.
  - The turn: it dissolves, it doesn't switch. The outgoing wall fades up and
    out while the incoming wall condenses in a beat later, so the middle of the
    turn is mostly just the atmosphere — the room rotating, not a slide.
  - It turns on its own (a timer) and on touch (tap / swipe) or keys.
  - Music as light: the track advances on its own, so the shared atmosphere
    recolors even when nothing is touched.
  - Reduced motion: no auto-turn, no auto-recolor, frozen light; turning by hand
    still works, instantly.
*/
export default function TurningRoom() {
  const reduced = usePrefersReducedMotion()

  const [idx, setIdx] = useState(0) // active wall
  const [prevKey, setPrevKey] = useState(null) // outgoing wall during a turn
  const [turnSeq, setTurnSeq] = useState(0) // bump to replay the turn animation

  const [trackIdx, setTrackIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0) // whole seconds into the current track
  const [clock, setClock] = useState(() => new Date())

  // Refs so the single heartbeat always reads current values without resubscribing.
  const idxRef = useRef(idx)
  idxRef.current = idx
  const trackIdxRef = useRef(trackIdx)
  trackIdxRef.current = trackIdx
  const elapsedRef = useRef(0)
  const lastTurnRef = useRef(0)
  const clearPrevRef = useRef(null)

  const track = TRACKS[trackIdx]

  // --- the turn ---------------------------------------------------------------
  const turnTo = useCallback(
    (next) => {
      const cur = idxRef.current
      if (next === cur) return
      lastTurnRef.current = nowMs()
      setTurnSeq((s) => s + 1)
      if (reduced) {
        // Frozen light: snap, no dissolve.
        setPrevKey(null)
        setIdx(next)
        return
      }
      setPrevKey(ORDER[cur])
      setIdx(next)
      clearTimeout(clearPrevRef.current)
      clearPrevRef.current = setTimeout(() => setPrevKey(null), 900)
    },
    [reduced],
  )

  const turnBy = useCallback(
    (delta) => {
      const cur = idxRef.current
      turnTo((cur + delta + ORDER.length) % ORDER.length)
    },
    [turnTo],
  )

  // --- one heartbeat drives clock, track drift, and the auto-turn -------------
  useEffect(() => {
    lastTurnRef.current = nowMs()
    const id = setInterval(() => {
      setClock(new Date())
      if (reduced) return

      // Track position; when it runs out, drift to the next track (recolor).
      const len = TRACKS[trackIdxRef.current].lenSec
      if (elapsedRef.current + 1 >= len) {
        elapsedRef.current = 0
        setElapsed(0)
        setTrackIdx((t) => (t + 1) % TRACKS.length)
      } else {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
      }

      // Turn on its own once the room has rested long enough.
      if (nowMs() - lastTurnRef.current >= theme.turnMs) {
        turnTo((idxRef.current + 1) % ORDER.length)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [reduced, turnTo])

  // --- touch / pointer: tap advances, horizontal swipe turns ------------------
  const downRef = useRef(null)
  const onPointerDown = (e) => {
    downRef.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e) => {
    const d = downRef.current
    downRef.current = null
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) {
      turnBy(dx < 0 ? 1 : -1) // swipe left → next wall
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      turnBy(1) // tap → next wall
    }
  }

  // --- keyboard: arrows / space, for accessibility ----------------------------
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      turnBy(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      turnBy(-1)
    }
  }

  const paletteStyle = {
    '--a1': track.palette.a1,
    '--a2': track.palette.a2,
    '--a3': track.palette.a3,
  }

  const progress = Math.min(1, elapsed / track.lenSec)

  return (
    <Stage paletteStyle={paletteStyle}>
      {/* Always-on light. Never re-mounts — the constant the walls compose on. */}
      <Atmosphere />

      <div
        className="room"
        tabIndex={0}
        role="group"
        aria-label="Turning room. Tap, swipe, or use arrow keys to turn."
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {/* Incoming / active wall. Keyed by turnSeq so the turn-in replays. */}
        <div className="wall wall-in" key={`in-${turnSeq}`}>
          {renderWall(ORDER[idx], { clock, track, progress })}
        </div>

        {/* Outgoing wall, briefly, dissolving away through the atmosphere. */}
        {prevKey && (
          <div className="wall wall-out" key={`out-${turnSeq}`}>
            {renderWall(prevKey, { clock, track, progress })}
          </div>
        )}
      </div>
    </Stage>
  )
}

function renderWall(key, { clock, track, progress }) {
  switch (key) {
    case 'now':
      return <Now clock={clock} today={TODAY} />
    case 'music':
      return <Music track={track} progress={progress} />
    case 'day':
      return <Day today={TODAY} />
    default:
      return null
  }
}

// performance.now() avoids wall-clock jumps; falls back to Date for old engines.
function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
}

function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(query).matches,
  )
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia(query)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}
