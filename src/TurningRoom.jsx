import { useCallback, useEffect, useRef, useState } from 'react'
import Stage from './Stage.jsx'
import Atmosphere from './Atmosphere.jsx'
import Now from './states/Now.jsx'
import Music from './states/Music.jsx'
import Day from './states/Day.jsx'
import CalendarLayer from './calendar/CalendarLayer.jsx'
import CatchInput from './playground/CatchInput.jsx'
import Mind from './playground/Mind.jsx'
import NotesBoard from './playground/NotesBoard.jsx'
import { motesStore } from './playground/motesStore.js'
import { isRaiseGesture, isPullDownGesture } from './calendar/gestures.js'
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

  // The depth axis: the legible calendar raised over the room. We keep it mounted
  // through its exit so it can fall back down — a bare unmount would pop away.
  const [calMounted, setCalMounted] = useState(false) // in the DOM (open OR leaving)
  const [calOpen, setCalOpen] = useState(false) // true = open; false = leaving/closed
  const [calInitialView, setCalInitialView] = useState('week') // which view it opens on
  const calMountedRef = useRef(false)
  calMountedRef.current = calMounted
  const closeTimerRef = useRef(null)

  // Playground: catch a thought by pressing and holding anywhere in the room.
  const [catching, setCatching] = useState(null) // { xPct, yPct } while the catch card is open
  const [pressPoint, setPressPoint] = useState(null) // { xPct, yPct } during the hold (feedback)
  const catchingRef = useRef(false)
  catchingRef.current = !!catching
  const holdTimerRef = useRef(null)

  // Playground: the shared notes board, pulled down from the top of the room.
  const [notesMounted, setNotesMounted] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const notesMountedRef = useRef(false)
  notesMountedRef.current = notesMounted
  const notesCloseTimerRef = useRef(null)
  const firstNotesRef = useRef(true)

  // Refs so the single heartbeat always reads current values without resubscribing.
  const idxRef = useRef(idx)
  idxRef.current = idx
  const trackIdxRef = useRef(trackIdx)
  trackIdxRef.current = trackIdx
  const elapsedRef = useRef(0)
  const lastTurnRef = useRef(0)
  const clearPrevRef = useRef(null)
  const roomRef = useRef(null)
  const firstCalRef = useRef(true)

  const track = TRACKS[trackIdx]

  const openCal = useCallback((initial) => {
    // Accepts an optional initial view ('week' | 'tasks' | …). When wired straight
    // to an onClick the arg is a DOM event, so anything non-string falls back to
    // the calendar's home view.
    setCalInitialView(typeof initial === 'string' ? initial : 'week')
    clearTimeout(closeTimerRef.current)
    setCalMounted(true)
    setCalOpen(true)
  }, [])
  const closeCal = useCallback(() => {
    setCalOpen(false) // play the fall…
    lastTurnRef.current = nowMs() // …and give the room a fresh rest on Day when it returns
    if (reduced) {
      setCalMounted(false)
      return
    }
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setCalMounted(false), 380)
  }, [reduced])

  const openNotes = useCallback(() => {
    clearTimeout(notesCloseTimerRef.current)
    setNotesMounted(true)
    setNotesOpen(true)
  }, [])
  const closeNotes = useCallback(() => {
    setNotesOpen(false) // play the lift…
    lastTurnRef.current = nowMs() // …and rest the room when it returns
    if (reduced) {
      setNotesMounted(false)
      return
    }
    clearTimeout(notesCloseTimerRef.current)
    notesCloseTimerRef.current = setTimeout(() => setNotesMounted(false), 380)
  }, [reduced])

  // Return focus to the room once the calendar has fully dropped away.
  useEffect(() => {
    if (firstCalRef.current) {
      firstCalRef.current = false
      return
    }
    if (!calMounted) roomRef.current?.focus?.()
  }, [calMounted])

  // Same, for the notes board.
  useEffect(() => {
    if (firstNotesRef.current) {
      firstNotesRef.current = false
      return
    }
    if (!notesMounted) roomRef.current?.focus?.()
  }, [notesMounted])

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

      // While the calendar is raised (or leaving), keep the light alive (clock +
      // track drift above still run) but never auto-turn the room underneath it —
      // so dropping the calendar always lands on the Day wall you left it on.
      if (calMountedRef.current || catchingRef.current || notesMountedRef.current) return

      // Turn on its own once the room has rested long enough.
      if (nowMs() - lastTurnRef.current >= theme.turnMs) {
        turnTo((idxRef.current + 1) % ORDER.length)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [reduced, turnTo])

  // --- catch: press-and-hold anywhere to catch a thought ----------------------
  const HOLD_MS = 460
  const ptToPct = (clientX, clientY) => {
    const r = roomRef.current?.getBoundingClientRect()
    if (!r || !r.width || !r.height) return { xPct: 50, yPct: 45 }
    return {
      xPct: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
      yPct: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
    }
  }
  const clearHold = () => {
    clearTimeout(holdTimerRef.current)
    setPressPoint(null)
  }
  const beginCatch = (pt) => {
    clearHold()
    setCatching(pt || { xPct: 50, yPct: 45 })
  }
  const commitCatch = (text) => {
    motesStore.add(text, Date.now())
    setCatching(null)
  }
  const cancelCatch = () => setCatching(null)

  // --- touch / pointer: tap advances, swipe turns, press-and-hold catches -----
  const downRef = useRef(null)
  const onPointerDown = (e) => {
    if (calMounted || notesMounted || catching) return
    downRef.current = { x: e.clientX, y: e.clientY }
    const pt = ptToPct(e.clientX, e.clientY)
    setPressPoint(pt)
    clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => {
      downRef.current = null // consume, so the trailing pointerup doesn't also turn
      beginCatch(pt)
    }, HOLD_MS)
  }
  const onPointerMove = (e) => {
    const d = downRef.current
    if (!d) return
    if (Math.abs(e.clientX - d.x) > 10 || Math.abs(e.clientY - d.y) > 10) clearHold() // moved → a swipe, not a hold
  }
  const onPointerUp = (e) => {
    clearTimeout(holdTimerRef.current)
    setPressPoint(null)
    const d = downRef.current
    downRef.current = null
    if (!d || calMounted || notesMounted || catching) return // other layers own gestures while up
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    // Pull up on the Day wall to raise the calendar (vertical-dominant).
    if (ORDER[idx] === 'day' && isRaiseGesture(dx, dy)) {
      openCal()
      return
    }
    // Pull down anywhere to bring the shared notes board down.
    if (isPullDownGesture(dx, dy)) {
      openNotes()
      return
    }
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) {
      turnBy(dx < 0 ? 1 : -1) // swipe left → next wall
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      turnBy(1) // tap → next wall
    }
  }
  const onPointerCancel = () => {
    clearHold()
    downRef.current = null
  }

  // --- keyboard: arrows / space, for accessibility ----------------------------
  const onKeyDown = (e) => {
    if (calMounted || notesMounted || catching) return // other layers handle their own keys
    if (e.key === 'c' || e.key === 'C') {
      e.preventDefault()
      beginCatch({ xPct: 50, yPct: 42 }) // catch a thought from the keyboard
    } else if (e.key === 'ArrowUp' && ORDER[idx] === 'day') {
      e.preventDefault()
      openCal() // pull the calendar up from the Day wall
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      openNotes() // pull the shared notes board down
    } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
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
        ref={roomRef}
        tabIndex={calMounted || notesMounted ? -1 : 0}
        role="group"
        aria-label="Turning room. Tap, swipe, or use arrow keys to turn."
        aria-hidden={calMounted || notesMounted || undefined}
        style={calMounted || notesMounted ? { pointerEvents: 'none' } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
      >
        {/* Incoming / active wall. Keyed by turnSeq so the turn-in replays. */}
        <div className="wall wall-in" key={`in-${turnSeq}`}>
          {renderWall(ORDER[idx], { clock, track, progress, onRaise: openCal, onOpenTasks: () => openCal('tasks') })}
        </div>

        {/* Outgoing wall, briefly, dissolving away through the atmosphere. */}
        {prevKey && (
          <div className="wall wall-out" key={`out-${turnSeq}`}>
            {renderWall(prevKey, { clock, track, progress, onRaise: openCal, onOpenTasks: () => openCal('tasks') })}
          </div>
        )}
      </div>

      {/* Playground: the light pools under a held finger, then a thought is caught. */}
      {pressPoint && !catching && (
        <div
          className="catch-pool catch-pool-pre"
          style={{ left: `${pressPoint.xPct}%`, top: `${pressPoint.yPct}%` }}
          aria-hidden="true"
        />
      )}
      {catching && <CatchInput xPct={catching.xPct} yPct={catching.yPct} onCommit={commitCatch} onCancel={cancelCatch} />}

      {/* A quiet handle at the top: pull down (or tap) for the shared notes board. */}
      {!calMounted && !notesMounted && !catching && (
        <button type="button" className="notes-handle" onClick={openNotes} aria-label="Open the shared notes board">
          <span className="notes-handle-arrow" aria-hidden="true">↓</span>
          <span className="notes-handle-label">notes</span>
        </button>
      )}

      {/* Caught thoughts live here, always glanceable (hidden under a raised layer). */}
      {!calMounted && !notesMounted && <Mind />}

      {/* The legible layer — a sibling of the room, lit by the same music.
          Stays mounted through its fall-away exit (open=false) before unmounting. */}
      {calMounted && <CalendarLayer open={calOpen} onClose={closeCal} reduced={reduced} clock={clock} initialView={calInitialView} />}

      {/* The shared notes board — pulled down from the top, lifted back to close. */}
      {notesMounted && <NotesBoard open={notesOpen} onClose={closeNotes} />}
    </Stage>
  )
}

function renderWall(key, { clock, track, progress, onRaise, onOpenTasks }) {
  switch (key) {
    case 'now':
      return <Now clock={clock} today={TODAY} onOpenTasks={onOpenTasks} />
    case 'music':
      return <Music track={track} progress={progress} />
    case 'day':
      return <Day today={TODAY} onRaise={onRaise} />
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
