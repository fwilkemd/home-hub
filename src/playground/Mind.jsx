/*
  The mind — where caught thoughts live so they stay visible (object permanence,
  the whole point for an ADHD brain). A quiet cluster in the corner shows the
  count and nudges when something new lands; open it to triage each thought into
  the calendar (Today / Tomorrow / Weekend) or let it go (with undo).

  Filing reuses the existing calendar store, so a triaged thought becomes a real
  all-day event you'll see in the calendar.
*/
import { useEffect, useRef, useState } from 'react'
import { useMotes } from './useMotes.js'
import { calendarStore } from '../calendar/store.js'
import { dateKey, addDays, startOfDay } from '../calendar/dateUtils.js'

function dayFor(when) {
  const base = startOfDay(new Date())
  if (when === 'today') return base
  if (when === 'tomorrow') return addDays(base, 1)
  const daysToSat = (6 - base.getDay() + 7) % 7 // upcoming Saturday (today if it's Sat)
  return addDays(base, daysToSat)
}

export default function Mind() {
  const { motes, update, remove, restore } = useMotes()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [letGo, setLetGo] = useState(null) // { mote } for the undo toast
  const undoTimer = useRef(null)

  useEffect(() => () => clearTimeout(undoTimer.current), [])

  // Escape closes the open mind (consistent with the calendar + catch card).
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const file = (mote, when) => {
    const key = dateKey(dayFor(when))
    calendarStore.addEvent({
      calendarId: 'shared',
      title: mote.text || 'Thought',
      allDay: true,
      start: key,
      end: key,
      kind: 'home',
      note: 'caught thought',
    })
    remove(mote.id)
  }

  const drop = (mote) => {
    remove(mote.id)
    setLetGo({ mote })
    clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setLetGo(null), 5000)
  }
  const undo = () => {
    if (letGo) restore(letGo.mote)
    setLetGo(null)
  }

  const count = motes.length

  return (
    <>
      {/* the quiet, always-there cluster */}
      <button
        type="button"
        className={`mind-cluster${count ? ' has-motes' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={count ? `${count} caught thought${count === 1 ? '' : 's'}` : 'Caught thoughts'}
      >
        <span className="mind-dot" />
        <span className="mind-dot" />
        <span className="mind-dot" />
        {count > 0 && (
          <span className="mind-count" key={count}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="mind" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="mind-panel" role="dialog" aria-label="Caught thoughts">
            <div className="mind-head">
              <span className="mind-title">mind</span>
              <button type="button" className="mind-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            {count === 0 ? (
              <p className="mind-empty">Nothing caught. Press &amp; hold anywhere to catch a thought.</p>
            ) : (
              <ul className="mote-list">
                {motes.map((m) => (
                  <li className="mote" key={m.id}>
                    {editingId === m.id ? (
                      <input
                        className="mote-edit"
                        autoFocus
                        defaultValue={m.text}
                        onBlur={(e) => {
                          update(m.id, e.target.value.trim() || m.text)
                          setEditingId(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                    ) : (
                      <button type="button" className="mote-text" onClick={() => setEditingId(m.id)}>
                        {m.text || 'Thought'}
                      </button>
                    )}
                    <div className="mote-actions">
                      <button type="button" className="mote-act" onClick={() => file(m, 'today')}>
                        Today
                      </button>
                      <button type="button" className="mote-act" onClick={() => file(m, 'tomorrow')}>
                        Tomorrow
                      </button>
                      <button type="button" className="mote-act" onClick={() => file(m, 'weekend')}>
                        Weekend
                      </button>
                      <button type="button" className="mote-act mote-drop" onClick={() => drop(m)} aria-label="Let go">
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {letGo && (
        <div className="mind-undo" role="status">
          <span>Let go</span>
          <button type="button" onClick={undo}>
            Undo
          </button>
        </div>
      )}
    </>
  )
}
