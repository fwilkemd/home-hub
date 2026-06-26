/*
  A physical note. Renders the saved ink as scalable SVG, colour-coded by who
  wrote it, tilted a touch. You can pick it up and drag it; on release it carries
  momentum and settles (the "weight"). A note from the other person glows until
  you tap it (acknowledge). Tiny × deletes (two taps).
*/
import { useRef, useState } from 'react'
import { NOTE_W, NOTE_H } from './InkCanvas.jsx'

const THROW_MS = 140 // how far a fling carries
const reduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export default function NoteCard({ note, me, color, onMove, onAck, onRemove }) {
  const [drag, setDrag] = useState(null) // { x, y } live position while dragging/throwing
  const [throwing, setThrowing] = useState(false)
  const [armedDelete, setArmedDelete] = useState(false)
  const ref = useRef(null)
  const g = useRef({ boardW: 1, boardH: 1, startX: 0, startY: 0, originX: 0, originY: 0, moved: 0, last: null, vx: 0, vy: 0 })

  const isNew = note.author !== me && !note.ack
  const pos = drag || { x: note.x, y: note.y }

  const onPointerDown = (e) => {
    e.stopPropagation()
    const board = ref.current.closest('.notes-surface')
    const r = board.getBoundingClientRect()
    g.current = {
      boardW: r.width,
      boardH: r.height,
      startX: e.clientX,
      startY: e.clientY,
      originX: note.x,
      originY: note.y,
      moved: 0,
      last: { t: e.timeStamp, x: e.clientX, y: e.clientY },
      vx: 0,
      vy: 0,
    }
    ref.current.setPointerCapture?.(e.pointerId)
    setThrowing(false)
    setDrag({ x: note.x, y: note.y })
  }
  const onPointerMove = (e) => {
    if (!drag) return
    const c = g.current
    const nx = clamp(c.originX + ((e.clientX - c.startX) / c.boardW) * 100)
    const ny = clamp(c.originY + ((e.clientY - c.startY) / c.boardH) * 100)
    c.moved += Math.abs(e.clientX - c.last.x) + Math.abs(e.clientY - c.last.y)
    const dt = Math.max(1, e.timeStamp - c.last.t)
    c.vx = (e.clientX - c.last.x) / dt
    c.vy = (e.clientY - c.last.y) / dt
    c.last = { t: e.timeStamp, x: e.clientX, y: e.clientY }
    setDrag({ x: nx, y: ny })
  }
  const onPointerUp = (e) => {
    if (!drag) return
    const c = g.current
    if (c.moved < 6) {
      // a tap, not a drag
      setDrag(null)
      if (isNew) onAck(note.id)
      return
    }
    let tx = pos.x
    let ty = pos.y
    if (!reduced()) {
      tx = clamp(pos.x + (c.vx / c.boardW) * 100 * THROW_MS)
      ty = clamp(pos.y + (c.vy / c.boardH) * 100 * THROW_MS)
      setThrowing(true)
    }
    setDrag({ x: tx, y: ty })
    onMove(note.id, tx, ty)
    window.setTimeout(() => {
      setThrowing(false)
      setDrag(null)
    }, 460)
  }

  return (
    <div
      ref={ref}
      className={`note${isNew ? ' is-new' : ''}${throwing ? ' is-throwing' : ''}`}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        '--note-rot': `${note.rot}deg`,
        '--note-color': color,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      <svg className="note-ink" viewBox={`0 0 ${NOTE_W} ${NOTE_H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {note.strokes.map((s, i) =>
          s.pts.length === 1 ? (
            <circle key={i} cx={s.pts[0][0]} cy={s.pts[0][1]} r={s.w / 2} fill={color} />
          ) : (
            <polyline
              key={i}
              points={s.pts.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={s.w}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        )}
      </svg>
      {isNew && <span className="note-new" aria-label="new note">new</span>}
      <button
        type="button"
        className={`note-x${armedDelete ? ' is-armed' : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          if (armedDelete) onRemove(note.id)
          else setArmedDelete(true)
        }}
        onBlur={() => setArmedDelete(false)}
        aria-label={armedDelete ? 'Tap again to delete' : 'Delete note'}
      >
        ×
      </button>
    </div>
  )
}

function clamp(n) {
  return Math.max(4, Math.min(96, n))
}
