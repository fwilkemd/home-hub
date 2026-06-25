/*
  The create/edit/delete sheet — slides in from the right over the grid so you
  keep the calendar as context. It owns only local form state and emits a
  complete event object on save (the store does the persisting).

  Time handling note: a single Date field + start/end times. If end <= start we
  read it as OVERNIGHT and roll the end to the next day — which is exactly how a
  9p→7a night-float shift is expressed. No timezone math (one home, one clock).
*/
import { useState } from 'react'
import { KINDS } from './calendarConfig.js'
import { parseDateKey, addDays, dateKey } from './dateUtils.js'

export default function EventEditor({ mode, draft, calendars, closing, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(draft)
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const overnight = !form.allDay && form.endTime <= form.startTime

  const save = () => {
    const title = (form.title || '').trim() || 'Untitled'
    let event
    if (form.allDay) {
      event = { calendarId: form.calendarId, title, allDay: true, shift: false, start: form.date, end: form.date }
    } else {
      const endDate = overnight ? dateKey(addDays(parseDateKey(form.date), 1)) : form.date
      event = {
        calendarId: form.calendarId,
        title,
        allDay: false,
        shift: !!form.shift,
        start: `${form.date}T${form.startTime}`,
        end: `${endDate}T${form.endTime}`,
      }
    }
    event.kind = form.kind
    event.note = form.note
    event.important = !!form.important
    if (form.id) event.id = form.id
    onSave(event)
  }

  return (
    <div className={`cal-editor${closing ? ' is-closing' : ''}`} role="dialog" aria-label={mode === 'edit' ? 'Edit event' : 'New event'}>
      <div className="cal-editor-head">
        <span className="cal-editor-kicker">{mode === 'edit' ? 'Edit' : 'New event'}</span>
      </div>

      <label className="cal-field">
        <span className="cal-field-label">Title</span>
        <input
          className="cal-input"
          type="text"
          value={form.title}
          placeholder="Untitled"
          autoFocus
          onChange={(e) => set({ title: e.target.value })}
        />
      </label>

      <div className="cal-field">
        <span className="cal-field-label">Calendar</span>
        <div className="cal-radios">
          {calendars.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cal-radio${form.calendarId === c.id ? ' is-on' : ''}`}
              style={{ '--chip': c.color }}
              onClick={() => set({ calendarId: c.id })}
              aria-pressed={form.calendarId === c.id}
            >
              <span className="cal-radio-dot" />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <label className="cal-field cal-field-row">
        <span className="cal-field-label">All-day</span>
        <input type="checkbox" className="cal-check" checked={!!form.allDay} onChange={(e) => set({ allDay: e.target.checked })} />
      </label>

      <label className="cal-field">
        <span className="cal-field-label">Date</span>
        <input className="cal-input" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
      </label>

      {!form.allDay && (
        <div className="cal-field cal-field-times">
          <label className="cal-time-field">
            <span className="cal-field-label">Start</span>
            <input className="cal-input" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
          </label>
          <label className="cal-time-field">
            <span className="cal-field-label">End</span>
            <input className="cal-input" type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
          </label>
        </div>
      )}
      {overnight && <p className="cal-hint">Ends next morning (overnight)</p>}

      <div className="cal-field">
        <span className="cal-field-label">Kind</span>
        <div className="cal-segmented">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={`cal-seg${form.kind === k ? ' is-on' : ''}`}
              onClick={() => set({ kind: k })}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <label className="cal-field">
        <span className="cal-field-label">Note</span>
        <textarea className="cal-input cal-textarea" rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} />
      </label>

      <label className="cal-field cal-field-row">
        <span className="cal-field-label">Important</span>
        <input type="checkbox" className="cal-check" checked={!!form.important} onChange={(e) => set({ important: e.target.checked })} />
      </label>

      <div className="cal-editor-actions">
        <button type="button" className="cal-btn cal-btn-save" onClick={save}>
          Save
        </button>
        <button type="button" className="cal-btn cal-btn-cancel" onClick={onClose}>
          Cancel
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            className={`cal-btn cal-btn-delete${confirmDel ? ' is-armed' : ''}`}
            onClick={() => (confirmDel ? onDelete(form.id) : setConfirmDel(true))}
            onBlur={() => setConfirmDel(false)}
          >
            {confirmDel ? 'Delete?' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  )
}
