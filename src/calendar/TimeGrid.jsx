/*
  The time-grid engine shared by Week (7 columns, 5cqh/hr) and Day (1 column,
  8cqh/hr). This is the part that makes a real day/week view:

  - a sticky day-header strip + an all-day row,
  - a vertically-scrollable 24h grid (default-scrolled to ~6am),
  - timed events absolutely positioned by minute, side-by-side when they overlap
    (via timedLayoutForDay), overnight shifts split across midnight,
  - a now-line on today's column.

  Empty-space tap = create at that 30-min slot; block tap = edit.

  Events have WEIGHT: long-press a single-day block to lift it (it gains scale +
  shadow), then drag it to a new time/day; drag the bottom grip to resize its
  duration. While dragging, blocks it would overlap visibly nudge. Drops commit
  through onReschedule (which offers an undo). See weight.js for the pure rules.
*/
import { useLayoutEffect, useRef, useState } from 'react'
import { isToday, minutesOfDay, dateKey, formatTimeCompact, hourLabel, parseLocal, WEEKDAYS_SHORT } from './dateUtils.js'
import { timedLayoutForDay, allDayEventsForDay } from './select.js'
import { CALENDAR_BY_ID } from './calendarConfig.js'
import { snap, pxToMin, clampStart, clampEnd, dayIndexAtX, overlaps, isDraggable, stampFor, HOLD_MS, MOVE_CANCEL_PX } from './weight.js'

const HOURS = Array.from({ length: 25 }, (_, i) => i) // 0..24 inclusive for the last label

export default function TimeGrid({ days, events, visible, clock, hourCqh = 5, dense = false, onCreate, onPickEvent, onReschedule }) {
  const scrollRef = useRef(null)
  const gridRef = useRef(null)
  const gestureRef = useRef(null) // live drag math (no re-render)
  const draggedRef = useRef(false) // suppress the click that follows a drag
  const [drag, setDrag] = useState(null) // preview: { id, mode, dayIndex, startMin, endMin }

  // Open scrolled to the morning (6am) — where a family day actually starts.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = (6 / 24) * el.scrollHeight
  }, [hourCqh, days.length])

  const createAt = (day, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientY - rect.top) / rect.height
    let mins = Math.round((frac * 1440) / 30) * 30
    mins = Math.max(0, Math.min(1410, mins))
    onCreate(day, mins)
  }

  // ── drag / resize ───────────────────────────────────────────────────────
  const measure = () => {
    const gridRect = gridRef.current.getBoundingClientRect()
    const colRects = Array.from(gridRef.current.querySelectorAll('.cal-col')).map((c) => c.getBoundingClientRect())
    return { gridRect, colRects, colHeightPx: gridRect.height }
  }

  const beginGesture = (e, mode, seg, dayIndex) => {
    const m = measure()
    const g = {
      id: seg.event.id,
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origStartMin: seg.startMin,
      origEndMin: seg.endMin,
      origDayIndex: dayIndex,
      duration: seg.endMin - seg.startMin,
      lifted: false,
      el: e.currentTarget.closest('.cal-block'),
      holdTimer: null,
      ...m,
    }
    gestureRef.current = g
    return g
  }

  const lift = (g) => {
    g.lifted = true
    try {
      g.el?.setPointerCapture(g.pointerId)
    } catch {
      /* capture is best-effort */
    }
    setDrag({ id: g.id, mode: g.mode, dayIndex: g.origDayIndex, startMin: g.origStartMin, endMin: g.origEndMin })
  }

  const onBlockPointerDown = (e, seg, dayIndex) => {
    if (!onReschedule || !isDraggable(seg.event)) return // not weighable → normal tap/scroll
    e.stopPropagation() // a gesture starting on a block never pages the calendar
    const g = beginGesture(e, 'move', seg, dayIndex)
    g.holdTimer = setTimeout(() => lift(g), HOLD_MS) // hold to pick it up
  }

  const onGripPointerDown = (e, seg, dayIndex) => {
    if (!onReschedule || !isDraggable(seg.event)) return
    e.stopPropagation()
    e.preventDefault()
    const g = beginGesture(e, 'resize', seg, dayIndex)
    lift(g) // a grip drag starts immediately — it's already a deliberate target
  }

  const onPointerMove = (e) => {
    const g = gestureRef.current
    if (!g) return
    const dy = e.clientY - g.startY
    const dx = e.clientX - g.startX
    if (!g.lifted) {
      // Moved before the hold completed → it was a scroll, not a pick-up.
      if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
        clearTimeout(g.holdTimer)
        gestureRef.current = null
      }
      return
    }
    e.preventDefault()
    const deltaMin = snap(pxToMin(dy, g.colHeightPx))
    if (g.mode === 'resize') {
      const endMin = clampEnd(g.origEndMin + deltaMin, g.origStartMin)
      setDrag({ id: g.id, mode: 'resize', dayIndex: g.origDayIndex, startMin: g.origStartMin, endMin })
    } else {
      const startMin = clampStart(g.origStartMin + deltaMin, g.duration)
      const dayIndex = dayIndexAtX(e.clientX, g.colRects)
      setDrag({ id: g.id, mode: 'move', dayIndex, startMin, endMin: startMin + g.duration })
    }
  }

  const endGesture = () => {
    const g = gestureRef.current
    gestureRef.current = null
    const preview = drag
    setDrag(null)
    if (!g) return
    clearTimeout(g.holdTimer)
    if (!g.lifted || !preview) return
    draggedRef.current = true // swallow the trailing click
    const day = days[preview.dayIndex] || days[g.origDayIndex]
    const key = dateKey(day)
    const startISO = stampFor(key, preview.startMin)
    const endISO = stampFor(key, preview.endMin)
    // Only fire if something actually changed.
    const movedDay = preview.dayIndex !== g.origDayIndex
    const movedTime = preview.startMin !== g.origStartMin || preview.endMin !== g.origEndMin
    if (movedDay || movedTime) onReschedule(g.id, startISO, endISO)
  }

  const onBlockClick = (e, ev) => {
    e.stopPropagation()
    if (draggedRef.current) {
      draggedRef.current = false // this click is the tail of a drag — ignore it
      return
    }
    onPickEvent(ev)
  }

  return (
    <div className={`cal-time${dense ? ' is-day' : ''}`} style={{ '--cols': days.length, '--hour': `${hourCqh}cqh` }}>
      <div className="cal-time-head">
        <div className="cal-corner" />
        {days.map((d) => {
          const today = isToday(d, clock)
          return (
            <div key={dateKey(d)} className={`cal-dayhead${today ? ' is-today' : ''}`}>
              <span className="cal-dayhead-dow">{WEEKDAYS_SHORT[d.getDay()]}</span>
              <span className="cal-dayhead-num">{d.getDate()}</span>
            </div>
          )
        })}
      </div>

      <div className="cal-allday">
        <div className="cal-allday-label">all-day</div>
        {days.map((d) => {
          const items = allDayEventsForDay(events, d, visible)
          return (
            <div key={dateKey(d)} className="cal-allday-cell">
              {items.map((ev) => {
                const color = (CALENDAR_BY_ID[ev.calendarId] || {}).color || '#8a8a8a'
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className="cal-allday-chip"
                    style={{ '--chip': color }}
                    onClick={() => onPickEvent(ev)}
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="cal-grid-scroll" data-scroll ref={scrollRef}>
        <div className="cal-grid" ref={gridRef}>
          <div className="cal-gutter">
            {HOURS.map((h) => (
              <span key={h} className="cal-hour-label" style={{ top: `calc(${h} * var(--hour))` }}>
                {h === 0 || h === 24 ? '' : hourLabel(h)}
              </span>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const blocks = timedLayoutForDay(events, day, visible)
            const today = isToday(day, clock)
            const previewOnThisDay = drag && days[drag.dayIndex] && dateKey(days[drag.dayIndex]) === dateKey(day)
            return (
              <div key={dateKey(day)} className="cal-col" onClick={(e) => createAt(day, e)}>
                {blocks.map((seg) => {
                  const ev = seg.event
                  const color = (CALENDAR_BY_ID[ev.calendarId] || {}).color || '#8a8a8a'
                  const isSource = drag && drag.id === ev.id
                  const top = (seg.startMin / 1440) * 100
                  const height = ((seg.endMin - seg.startMin) / 1440) * 100
                  const widthPct = 100 / seg.colCount
                  const draggable = !!onReschedule && isDraggable(ev)
                  // Visibly nudge any block the lifted one would now overlap.
                  const nudged =
                    drag && drag.id !== ev.id && previewOnThisDay && overlaps(seg.startMin, seg.endMin, drag.startMin, drag.endMin)
                  return (
                    <button
                      key={ev.id + seg.dateKey + seg.startMin}
                      type="button"
                      className={
                        'cal-block' +
                        (ev.shift ? ' is-shift' : '') +
                        (seg.continuesBefore ? ' is-cont-top' : '') +
                        (seg.continuesAfter ? ' is-cont-bottom' : '') +
                        (draggable ? ' is-weighable' : '') +
                        (isSource ? ' is-source' : '') +
                        (nudged ? ' is-nudged' : '')
                      }
                      style={{
                        '--chip': color,
                        top: `${top}%`,
                        height: `${height}%`,
                        left: `calc(${seg.colIndex * widthPct}% + 0.2cqw)`,
                        width: `calc(${widthPct}% - 0.5cqw)`,
                      }}
                      onPointerDown={draggable ? (e) => onBlockPointerDown(e, seg, dayIndex) : undefined}
                      onPointerMove={draggable ? onPointerMove : undefined}
                      onPointerUp={draggable ? endGesture : undefined}
                      onPointerCancel={draggable ? endGesture : undefined}
                      onClick={(e) => onBlockClick(e, ev)}
                      title={ev.title}
                    >
                      <span className="cal-block-title">{ev.title}</span>
                      <span className="cal-block-time">{timeRange(ev)}</span>
                      {dense && ev.note ? <span className="cal-block-note">{ev.note}</span> : null}
                      {draggable && (
                        <span
                          className="cal-block-grip"
                          aria-hidden="true"
                          onPointerDown={(e) => onGripPointerDown(e, seg, dayIndex)}
                          onPointerMove={onPointerMove}
                          onPointerUp={endGesture}
                          onPointerCancel={endGesture}
                        />
                      )}
                    </button>
                  )
                })}

                {today ? (
                  <div className="cal-nowline" style={{ top: `${(minutesOfDay(clock) / 1440) * 100}%` }}>
                    <span className="cal-nowdot" />
                  </div>
                ) : null}
              </div>
            )
          })}

          {/* The lifted block's ghost — follows the pointer over the whole grid,
              positioned in grid-content pixels so it reads across day columns. */}
          {drag && gestureRef.current && (
            <Ghost drag={drag} gesture={gestureRef.current} days={days} events={events} />
          )}
        </div>
      </div>
    </div>
  )
}

function Ghost({ drag, gesture, days, events }) {
  const { gridRect, colRects } = gesture
  const rect = colRects[drag.dayIndex] || colRects[gesture.origDayIndex] || colRects[0]
  if (!rect) return null
  const left = rect.left - gridRect.left
  const width = rect.width
  const top = (drag.startMin / 1440) * gridRect.height
  const height = ((drag.endMin - drag.startMin) / 1440) * gridRect.height
  const ev = events.find((e) => e.id === drag.id)
  const color = ev ? (CALENDAR_BY_ID[ev.calendarId] || {}).color || '#8a8a8a' : '#8a8a8a'
  return (
    <div
      className={`cal-ghost${drag.mode === 'resize' ? ' is-resize' : ''}`}
      style={{ '--chip': color, left: `${left}px`, width: `${width}px`, top: `${top}px`, height: `${height}px` }}
      aria-hidden="true"
    >
      <span className="cal-block-title">{ev?.title}</span>
      <span className="cal-block-time">
        {fmtMin(drag.startMin)}–{fmtMin(drag.endMin)}
      </span>
    </div>
  )
}

function fmtMin(min) {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  const mer = h < 12 ? 'a' : 'p'
  const h12 = ((h + 11) % 12) + 1
  return m === 0 ? `${h12}${mer}` : `${h12}:${String(m).padStart(2, '0')}${mer}`
}

function timeRange(ev) {
  return `${formatTimeCompact(parseLocal(ev.start))}–${formatTimeCompact(parseLocal(ev.end))}`
}
