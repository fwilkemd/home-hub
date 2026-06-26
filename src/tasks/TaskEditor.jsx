/*
  Create / edit a task. Slides in from the right over the list, exactly like the
  calendar's event sheet (and reuses its styling) so the legible layer feels of a
  piece. Skylight-fast: title, who, how-often, and an optional time — a couple of
  taps, no hunting.

  Delete carries the recurring nuance EXPLICITLY (the whole point):
   - a one-off → a single "Delete?" confirm, then it's gone.
   - a recurring task → TWO labelled choices, "Just this day" vs "Delete series".
  A series is never nuked silently.
*/
import { useState } from 'react'
import { ASSIGNEES, RECURRENCE } from './tasksConfig.js'
import { WEEKDAYS_NARROW } from '../calendar/dateUtils.js'

export default function TaskEditor({ mode, draft, dayKey, closing, onSave, onDeleteOccurrence, onDeleteSeries, onClose }) {
  const [form, setForm] = useState(draft)
  const [del, setDel] = useState(null) // null | 'once' | 'series'  (the delete sub-state)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const today = new Date().getDay()

  const setRepeat = (type) => {
    if (type === 'weekly') {
      const d = form.days && form.days.length ? form.days[0] : today
      set({ recType: 'weekly', days: [d] })
    } else if (type === 'weekdays') {
      const days = form.days && form.days.length ? form.days : [today]
      set({ recType: 'weekdays', days })
    } else {
      set({ recType: type, days: [] })
    }
  }

  // Weekly = pick exactly one day; Days = toggle a set (never empty).
  const pickDay = (d) => {
    if (form.recType === 'weekly') {
      set({ days: [d] })
    } else {
      const has = form.days.includes(d)
      const next = has ? form.days.filter((x) => x !== d) : [...form.days, d]
      set({ days: next.length ? next : [d] })
    }
  }

  const save = () => {
    const task = {
      title: (form.title || '').trim() || 'Untitled',
      assignee: form.assignee,
      dueTime: form.timed ? form.dueTime : null,
      recurrence: {
        type: form.recType,
        days: form.recType === 'weekly' || form.recType === 'weekdays' ? form.days : [],
      },
    }
    if (form.id) task.id = form.id
    onSave(task)
  }

  const recurring = form.recType !== 'none'

  return (
    <div className={`cal-editor${closing ? ' is-closing' : ''}`} role="dialog" aria-label={mode === 'edit' ? 'Edit task' : 'New task'}>
      <div className="cal-editor-head">
        <span className="cal-editor-kicker">{mode === 'edit' ? 'Edit task' : 'New task'}</span>
      </div>

      <label className="cal-field">
        <span className="cal-field-label">Task</span>
        <input
          className="cal-input"
          type="text"
          value={form.title}
          placeholder="e.g. Feed Roo"
          autoFocus
          onChange={(e) => set({ title: e.target.value })}
        />
      </label>

      <div className="cal-field">
        <span className="cal-field-label">Who</span>
        <div className="cal-radios">
          {ASSIGNEES.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`cal-radio${form.assignee === a.id ? ' is-on' : ''}`}
              style={{ '--chip': a.color }}
              onClick={() => set({ assignee: a.id })}
              aria-pressed={form.assignee === a.id}
            >
              <span className="cal-radio-dot" />
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <div className="cal-field">
        <span className="cal-field-label">Repeats</span>
        <div className="cal-segmented">
          {RECURRENCE.map((r) => (
            <button
              key={r.type}
              type="button"
              className={`cal-seg${form.recType === r.type ? ' is-on' : ''}`}
              onClick={() => setRepeat(r.type)}
              aria-pressed={form.recType === r.type}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {(form.recType === 'weekly' || form.recType === 'weekdays') && (
        <div className="cal-field">
          <span className="cal-field-label">{form.recType === 'weekly' ? 'On' : 'On these days'}</span>
          <div className="task-days">
            {WEEKDAYS_NARROW.map((label, d) => (
              <button
                key={d}
                type="button"
                className={`task-day${form.days.includes(d) ? ' is-on' : ''}`}
                onClick={() => pickDay(d)}
                aria-pressed={form.days.includes(d)}
                aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="cal-field cal-field-row">
        <span className="cal-field-label">Has a time</span>
        <input type="checkbox" className="cal-check" checked={!!form.timed} onChange={(e) => set({ timed: e.target.checked })} />
      </label>

      {form.timed && (
        <label className="cal-field">
          <span className="cal-field-label">Due by</span>
          <input className="cal-input" type="time" value={form.dueTime} onChange={(e) => set({ dueTime: e.target.value })} />
        </label>
      )}

      <div className="cal-editor-actions">
        <button type="button" className="cal-btn cal-btn-save" onClick={save}>
          {mode === 'edit' ? 'Save' : 'Add task'}
        </button>
        <button type="button" className="cal-btn cal-btn-cancel" onClick={onClose}>
          Cancel
        </button>
        {mode === 'edit' &&
          (recurring ? (
            <button
              type="button"
              className={`cal-btn cal-btn-delete${del === 'series' ? ' is-armed' : ''}`}
              onClick={() => setDel((d) => (d === 'series' ? null : 'series'))}
            >
              Delete…
            </button>
          ) : (
            <button
              type="button"
              className={`cal-btn cal-btn-delete${del === 'once' ? ' is-armed' : ''}`}
              onClick={() => (del === 'once' ? onDeleteSeries(form.id) : setDel('once'))}
              onBlur={() => setDel((d) => (d === 'once' ? null : d))}
            >
              {del === 'once' ? 'Delete?' : 'Delete'}
            </button>
          ))}
      </div>

      {/* The recurring nuance, made explicit — never a silent series-nuke. */}
      {mode === 'edit' && recurring && del === 'series' && (
        <div className="task-del" role="group" aria-label="Delete this recurring task">
          <p className="task-del-q">Delete which?</p>
          <div className="task-del-choices">
            <button type="button" className="cal-btn cal-btn-cancel" onClick={() => onDeleteOccurrence(form.id, dayKey)}>
              Just this day
            </button>
            <button type="button" className="cal-btn cal-btn-delete is-armed" onClick={() => onDeleteSeries(form.id)}>
              Delete series
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
