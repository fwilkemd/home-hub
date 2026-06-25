/*
  The legible layer. Mounts as a sibling of .room inside .stage (so it survives
  the room's turn remount, inherits the cq container, and is lit by --a1/2/3 at
  its edges only). It owns view / cursor / editor state and the calendar-mode
  gesture router; the room is inert while it's up.

  Gestures (calendar mode): horizontal swipe = prev/next period; downward drag
  from the chrome (or at the top of a scrolled grid) = dismiss; everything else
  scrolls. Keyboard has full parity (Esc, ←/→, t, m/w/d, n) so a swipe never
  being recognised is never a dead end.
*/
import { useEffect, useRef, useState } from 'react'
import CalendarHeader from './CalendarHeader.jsx'
import MonthView from './MonthView.jsx'
import WeekView from './WeekView.jsx'
import DayView from './DayView.jsx'
import EventEditor from './EventEditor.jsx'
import { useCalendarStore } from './useCalendarStore.js'
import { decideCalGesture } from './gestures.js'
import { startOfDay, addDays, addWeeks, addMonths, dateKey, parseLocal } from './dateUtils.js'

const pad = (n) => String(n).padStart(2, '0')
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const minToHM = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

function draftForCreate(day, mins) {
  const startMin = mins == null ? 9 * 60 : mins
  const endMin = Math.min(startMin + 60, 23 * 60 + 59)
  return {
    calendarId: 'shared',
    title: '',
    allDay: false,
    shift: false,
    date: dateKey(day),
    startTime: minToHM(startMin),
    endTime: minToHM(endMin),
    kind: 'home',
    note: '',
    important: false,
  }
}

function draftFromEvent(ev) {
  if (ev.allDay) {
    return {
      id: ev.id,
      calendarId: ev.calendarId,
      title: ev.title,
      allDay: true,
      shift: !!ev.shift,
      date: ev.start,
      startTime: '09:00',
      endTime: '10:00',
      kind: ev.kind || 'home',
      note: ev.note || '',
      important: !!ev.important,
    }
  }
  const s = parseLocal(ev.start)
  const e = parseLocal(ev.end)
  return {
    id: ev.id,
    calendarId: ev.calendarId,
    title: ev.title,
    allDay: false,
    shift: !!ev.shift,
    date: dateKey(s),
    startTime: hm(s),
    endTime: hm(e),
    kind: ev.kind || 'home',
    note: ev.note || '',
    important: !!ev.important,
  }
}

export default function CalendarLayer({ onClose, clock }) {
  const { events, calendars, visible, addEvent, updateEvent, removeEvent, toggleCalendar } = useCalendarStore()

  const [view, setView] = useState('week') // "the full week" is the legible layer's home
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [editing, setEditing] = useState(null) // { mode, draft, key }

  const panelRef = useRef(null)
  const downRef = useRef(null)
  const suppressClickRef = useRef(false)
  const editSeqRef = useRef(0)

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  const step = (dir) =>
    setCursor((c) => (view === 'month' ? addMonths(c, dir) : view === 'week' ? addWeeks(c, dir) : addDays(c, dir)))
  const goToday = () => setCursor(startOfDay(new Date()))
  const pickDay = (day) => {
    setCursor(day)
    setView('day')
  }
  const openCreate = (day, mins) =>
    setEditing({ mode: 'create', draft: draftForCreate(day ?? cursor, mins), key: `new-${editSeqRef.current++}` })
  const openEdit = (ev) => setEditing({ mode: 'edit', draft: draftFromEvent(ev), key: `edit-${ev.id}` })
  const closeEditor = () => setEditing(null)
  const saveEvent = (event) => {
    if (event.id) updateEvent(event.id, event)
    else addEvent(event)
    setEditing(null)
  }
  const deleteEvent = (id) => {
    removeEvent(id)
    setEditing(null)
  }

  // ── calendar-mode gesture router ────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (editing) return
    const zone = e.target.closest?.('[data-dismiss-zone]') ? 'chrome' : 'body'
    const scrollEl = e.target.closest?.('[data-scroll]') || null
    downRef.current = { x: e.clientX, y: e.clientY, zone, scrollEl }
  }
  const onPointerUp = (e) => {
    const d = downRef.current
    downRef.current = null
    if (!d || editing) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    const scrollTop = d.scrollEl ? d.scrollEl.scrollTop : 0
    const action = decideCalGesture({ dx, dy, startZone: d.zone, scrollTop })
    if (action === 'prev') {
      step(-1)
      suppressClickRef.current = true
    } else if (action === 'next') {
      step(1)
      suppressClickRef.current = true
    } else if (action === 'dismiss') {
      onClose()
      suppressClickRef.current = true
    }
  }
  // Cancel the click that follows a committed swipe so it doesn't also tap a cell.
  const onClickCapture = (e) => {
    if (suppressClickRef.current) {
      e.stopPropagation()
      e.preventDefault()
      suppressClickRef.current = false
    }
  }

  const onKeyDown = (e) => {
    // Lightweight focus trap so Tab stays within the layer.
    if (e.key === 'Tab') {
      const nodes = panelRef.current?.querySelectorAll(
        'button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      const list = Array.from(nodes || []).filter((el) => !el.disabled && el.offsetParent !== null)
      if (list.length) {
        const first = list[0]
        const last = list[list.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
      return
    }

    if (editing) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeEditor()
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'ArrowLeft':
        e.preventDefault()
        step(-1)
        break
      case 'ArrowRight':
        e.preventDefault()
        step(1)
        break
      case 't':
      case 'T':
        goToday()
        break
      case 'm':
      case 'M':
        setView('month')
        break
      case 'w':
      case 'W':
        setView('week')
        break
      case 'd':
      case 'D':
        setView('day')
        break
      case 'n':
      case 'N':
        e.preventDefault()
        openCreate(cursor, null)
        break
      default:
        break
    }
  }

  return (
    <div
      className="cal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="cal-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Family calendar"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="cal-grab" data-dismiss-zone onClick={onClose} aria-label="Close calendar" />

        <CalendarHeader
          view={view}
          cursor={cursor}
          calendars={calendars}
          visible={visible}
          onView={setView}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onToday={goToday}
          onToggleCalendar={toggleCalendar}
          onNew={() => openCreate(cursor, null)}
          onClose={onClose}
        />

        <div className="cal-body">
          {view === 'month' && (
            <MonthView
              cursor={cursor}
              events={events}
              visible={visible}
              onCreate={(day) => openCreate(day, null)}
              onPickEvent={openEdit}
              onPickDay={pickDay}
            />
          )}
          {view === 'week' && (
            <WeekView cursor={cursor} events={events} visible={visible} clock={clock} onCreate={openCreate} onPickEvent={openEdit} />
          )}
          {view === 'day' && (
            <DayView cursor={cursor} events={events} visible={visible} clock={clock} onCreate={openCreate} onPickEvent={openEdit} />
          )}
        </div>

        {editing && (
          <EventEditor
            key={editing.key}
            mode={editing.mode}
            draft={editing.draft}
            calendars={calendars}
            onSave={saveEvent}
            onDelete={deleteEvent}
            onClose={closeEditor}
          />
        )}
      </div>
    </div>
  )
}
