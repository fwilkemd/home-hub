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
import TasksView from '../tasks/TasksView.jsx'
import TaskEditor from '../tasks/TaskEditor.jsx'
import { useCalendarStore } from './useCalendarStore.js'
import { useTasksStore } from '../tasks/useTasksStore.js'
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

// Task editor drafts (a flat, form-shaped view of a task record).
function taskDraftForCreate() {
  return { title: '', assignee: 'anyone', timed: false, dueTime: '17:00', recType: 'none', days: [] }
}
function taskDraftFromTask(t) {
  return {
    id: t.id,
    title: t.title,
    assignee: t.assignee,
    timed: !!t.dueTime,
    dueTime: t.dueTime || '17:00',
    recType: t.recurrence?.type || 'none',
    days: t.recurrence?.days || [],
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

export default function CalendarLayer({ open, onClose, clock, initialView = 'week' }) {
  const { events, calendars, visible, addEvent, updateEvent, removeEvent, toggleCalendar } = useCalendarStore()
  const { addTask, updateTask, deleteOccurrence, deleteSeries } = useTasksStore()

  const [view, setView] = useState(initialView) // 'week' is the calendar's home; 'tasks' opens the chore list
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [editing, setEditing] = useState(null) // calendar event editor: { mode, draft, key }
  const [editorClosing, setEditorClosing] = useState(false) // play the sheet's slide-out
  const [taskEditing, setTaskEditing] = useState(null) // task editor: { mode, draft, key }
  const [taskEditorClosing, setTaskEditorClosing] = useState(false)
  const [weightUndo, setWeightUndo] = useState(null) // { id, prev } after a drag/resize
  const weightTimerRef = useRef(null)

  const panelRef = useRef(null)
  const downRef = useRef(null)
  const suppressClickRef = useRef(false)
  const editSeqRef = useRef(0)
  const editorTimerRef = useRef(null)
  const taskEditorTimerRef = useRef(null)

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
  const startEditing = (next) => {
    clearTimeout(editorTimerRef.current)
    setEditorClosing(false)
    setEditing(next)
  }
  const openCreate = (day, mins) =>
    startEditing({ mode: 'create', draft: draftForCreate(day ?? cursor, mins), key: `new-${editSeqRef.current++}` })
  const openEdit = (ev) => startEditing({ mode: 'edit', draft: draftFromEvent(ev), key: `edit-${ev.id}` })
  // Slide the sheet out, then unmount — a bare unmount would pop.
  const closeEditor = () => {
    setEditorClosing(true)
    clearTimeout(editorTimerRef.current)
    editorTimerRef.current = setTimeout(() => {
      setEditing(null)
      setEditorClosing(false)
    }, 220)
  }
  const saveEvent = (event) => {
    if (event.id) updateEvent(event.id, event)
    else addEvent(event)
    closeEditor()
  }
  const deleteEvent = (id) => {
    removeEvent(id)
    closeEditor()
  }

  // Drag/resize commit, with an undo (events are forgiving — law: undo everything).
  const reschedule = (id, start, end) => {
    const ev = events.find((e) => e.id === id)
    if (!ev) return
    updateEvent(id, { start, end })
    setWeightUndo({ id, prev: { start: ev.start, end: ev.end } })
    clearTimeout(weightTimerRef.current)
    weightTimerRef.current = setTimeout(() => setWeightUndo(null), 5000)
  }
  const undoReschedule = () => {
    if (weightUndo) updateEvent(weightUndo.id, weightUndo.prev)
    clearTimeout(weightTimerRef.current)
    setWeightUndo(null)
  }
  useEffect(() => () => clearTimeout(weightTimerRef.current), [])

  // ── task editor (its own sheet, same slide-in/out as the event editor) ──────
  const startTaskEditing = (next) => {
    clearTimeout(taskEditorTimerRef.current)
    setTaskEditorClosing(false)
    setTaskEditing(next)
  }
  const openTaskCreate = () =>
    startTaskEditing({ mode: 'create', draft: taskDraftForCreate(), key: `newtask-${editSeqRef.current++}` })
  const openTaskEdit = (t) => startTaskEditing({ mode: 'edit', draft: taskDraftFromTask(t), key: `task-${t.id}` })
  const closeTaskEditor = () => {
    setTaskEditorClosing(true)
    clearTimeout(taskEditorTimerRef.current)
    taskEditorTimerRef.current = setTimeout(() => {
      setTaskEditing(null)
      setTaskEditorClosing(false)
    }, 220)
  }
  const saveTask = (task) => {
    if (task.id) updateTask(task.id, task)
    else addTask(task)
    closeTaskEditor()
  }
  const deleteTaskOccurrence = (id, key) => {
    deleteOccurrence(id, key)
    closeTaskEditor()
  }
  const deleteTaskSeries = (id) => {
    deleteSeries(id)
    closeTaskEditor()
  }

  // ── calendar-mode gesture router ────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (!open) return // leaving — ignore input
    // A fresh gesture starts: clear any leftover suppression so a previous swipe
    // can only ever swallow its OWN trailing click, never a later tap. (On touch
    // a committed swipe emits no click, so the flag would otherwise stick.)
    suppressClickRef.current = false
    if (editing || taskEditing) return
    const zone = e.target.closest?.('[data-dismiss-zone]') ? 'chrome' : 'body'
    const scrollEl = e.target.closest?.('[data-scroll]') || null
    downRef.current = { x: e.clientX, y: e.clientY, zone, scrollEl }
  }
  const onPointerUp = (e) => {
    const d = downRef.current
    downRef.current = null
    if (!d || editing || taskEditing || !open) return
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
    if (!open) return // leaving — ignore input
    // Lightweight focus trap so Tab stays within the layer.
    if (e.key === 'Tab') {
      // While the editor sheet is open it's the modal — trap Tab within it, not
      // the whole panel (the grid behind it stays visible but must not catch focus).
      const scope = ((editing || taskEditing) && panelRef.current?.querySelector('.cal-editor')) || panelRef.current
      const nodes = scope?.querySelectorAll(
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
    if (taskEditing) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeTaskEditor()
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
        if (view === 'tasks') openTaskCreate()
        else openCreate(cursor, null)
        break
      default:
        break
    }
  }

  return (
    <div
      className={`cal-scrim${open ? '' : ' is-closing'}`}
      onClick={(e) => {
        if (open && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`cal-panel${open ? '' : ' is-closing'}`}
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
          onNew={() => (view === 'tasks' ? openTaskCreate() : openCreate(cursor, null))}
          onClose={onClose}
        />

        <div className="cal-body">
          {/* Keyed by view so each switch fades the new view in (no hard cut). */}
          <div className="cal-view-swap" key={view}>
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
              <WeekView cursor={cursor} events={events} visible={visible} clock={clock} onCreate={openCreate} onPickEvent={openEdit} onReschedule={reschedule} />
            )}
            {view === 'day' && (
              <DayView cursor={cursor} events={events} visible={visible} clock={clock} onCreate={openCreate} onPickEvent={openEdit} onReschedule={reschedule} />
            )}
            {view === 'tasks' && (
              <TasksView cursor={cursor} clock={clock} onCreate={openTaskCreate} onPickTask={openTaskEdit} />
            )}
          </div>
        </div>

        {editing && (
          <EventEditor
            key={editing.key}
            mode={editing.mode}
            draft={editing.draft}
            calendars={calendars}
            closing={editorClosing}
            onSave={saveEvent}
            onDelete={deleteEvent}
            onClose={closeEditor}
          />
        )}

        {taskEditing && (
          <TaskEditor
            key={taskEditing.key}
            mode={taskEditing.mode}
            draft={taskEditing.draft}
            dayKey={dateKey(cursor)}
            closing={taskEditorClosing}
            onSave={saveTask}
            onDeleteOccurrence={deleteTaskOccurrence}
            onDeleteSeries={deleteTaskSeries}
            onClose={closeTaskEditor}
          />
        )}

        {weightUndo && (
          <div className="cal-undo" role="status">
            <span>Moved</span>
            <button type="button" onClick={undoReschedule}>
              Undo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
