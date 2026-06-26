/*
  The scribble surface. Draw with the S Pen (pressure -> stroke width) or a
  finger. Strokes are captured in viewBox units (0..NOTE_W / 0..NOTE_H) so they
  render crisply at any size on the board. getCoalescedEvents keeps fast pen
  strokes smooth.
*/
import { useRef, useState } from 'react'

export const NOTE_W = 1000
export const NOTE_H = 720

function widthFor(pressure) {
  // pen reports real pressure; mouse ~0.5 while down; touch often 0
  return Math.max(5, 4 + 9 * (pressure || 0))
}

export default function InkCanvas({ color = '#f7f4ef', onSave, onCancel }) {
  const svgRef = useRef(null)
  const [strokes, setStrokes] = useState([])
  const [current, setCurrent] = useState(null)
  const drawingRef = useRef(false)

  const toVB = (e) => {
    const r = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * NOTE_W
    const y = ((e.clientY - r.top) / r.height) * NOTE_H
    return [
      Math.max(0, Math.min(NOTE_W, Math.round(x))),
      Math.max(0, Math.min(NOTE_H, Math.round(y))),
    ]
  }

  const onPointerDown = (e) => {
    e.preventDefault()
    svgRef.current.setPointerCapture?.(e.pointerId)
    drawingRef.current = true
    setCurrent({ w: widthFor(e.pressure), pts: [toVB(e)] })
  }
  const onPointerMove = (e) => {
    if (!drawingRef.current) return
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]
    const next = events.map(toVB)
    setCurrent((c) => (c ? { ...c, pts: [...c.pts, ...next] } : c))
  }
  const endStroke = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    setCurrent((c) => {
      if (c && c.pts.length) setStrokes((s) => [...s, c])
      return null
    })
  }

  const all = current ? [...strokes, current] : strokes
  const save = () => strokes.length && onSave(strokes)

  return (
    <div className="ink" role="dialog" aria-label="Scribble a note" onPointerDown={(e) => e.stopPropagation()}>
      <span className="ink-label">scribble a note</span>
      <svg
        ref={svgRef}
        className="ink-surface"
        viewBox={`0 0 ${NOTE_W} ${NOTE_H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
      >
        {all.map((s, i) =>
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
      <div className="ink-actions">
        <button type="button" className="ink-btn ink-btn-save" onClick={save} disabled={!strokes.length}>
          Leave it
        </button>
        <button type="button" className="ink-btn" onClick={() => setStrokes([])}>
          Clear
        </button>
        <button type="button" className="ink-btn ink-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
