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
import { tasksStore } from '../tasks/store.js'
import { dateKey, addDays, startOfDay } from '../calendar/dateUtils.js'

function dayFor(when) {
  const base = startOfDay(new Date())
  if (when === 'today') return base
  if (when === 'tomorrow') return addDays(base, 1)
  const daysToSat = (6 - base.getDay() + 7) % 7 // upcoming Saturday (today if it's Sat)
  return addDays(base, daysToSat)
}

// The drop targets when flinging a thought onto a day (same days as the buttons).
const RAIL = [
  { when: 'today', label: 'Today' },
  { when: 'tomorrow', label: 'Tomorrow' },
  { when: 'weekend', label: 'Weekend' },
]

export default function Mind() {
  const { motes, update, remove, restore } = useMotes()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [letGo, setLetGo] = useState(null) // { mote } for the undo toast
  const [fling, setFling] = useState(null) // { id, text, x, y, ox, oy, target } while flinging a mote
  const undoTimer = useRef(null)
  const flingRef = useRef(null) // live drag math (no re-render)
  const flungRef = useRef(false) // suppress the click after a fling
  const railRef = useRef(null)
  const overlayRef = useRef(null)

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

  // A caught thought can also become a chore instead of a dated event — an
  // untimed to-do for no one in particular, ready to assign in the task list.
  const toTask = (mote) => {
    tasksStore.addTask({ title: mote.text || 'Thought', assignee: 'anyone' })
    remove(mote.id)
  }

  // ── fling a thought onto a day ──────────────────────────────────────────
  // Same grammar as picking up a calendar block: long-press a thought to lift it,
  // then drag it onto a day on the rail to file it there (reuses file()).
  const hitTarget = (x, y) => {
    const root = railRef.current
    if (!root) return null
    for (const c of root.querySelectorAll('[data-when]')) {
      const r = c.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return c.getAttribute('data-when')
    }
    return null
  }
  const onMoteDown = (e, m) => {
    const g = { id: m.id, text: m.text, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, lifted: false, el: e.currentTarget, holdTimer: null }
    flingRef.current = g
    g.holdTimer = setTimeout(() => {
      if (flingRef.current !== g) return
      g.lifted = true
      try {
        g.el.setPointerCapture(g.pointerId)
      } catch {
        /* best effort */
      }
      const o = overlayRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
      setFling({ id: g.id, text: g.text, x: g.startX, y: g.startY, ox: o.left, oy: o.top, target: null })
    }, 300)
  }
  const onMoteMove = (e) => {
    const g = flingRef.current
    if (!g) return
    if (!g.lifted) {
      if (Math.abs(e.clientX - g.startX) > 8 || Math.abs(e.clientY - g.startY) > 8) {
        clearTimeout(g.holdTimer)
        flingRef.current = null
      }
      return
    }
    e.preventDefault()
    const target = hitTarget(e.clientX, e.clientY)
    setFling((f) => (f ? { ...f, x: e.clientX, y: e.clientY, target } : f))
  }
  const onMoteUp = (e) => {
    const g = flingRef.current
    flingRef.current = null
    if (!g) return
    clearTimeout(g.holdTimer)
    if (!g.lifted) return
    flungRef.current = true // swallow the trailing click (don't open the editor)
    const target = hitTarget(e.clientX, e.clientY)
    const mote = motes.find((m) => m.id === g.id)
    if (target && mote) file(mote, target)
    setFling(null)
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
        <div className="mind" ref={overlayRef} onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
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
                      <button
                        type="button"
                        className={`mote-text${fling && fling.id === m.id ? ' is-lifted' : ''}`}
                        onClick={() => {
                          if (flungRef.current) {
                            flungRef.current = false // tail of a fling — not an edit
                            return
                          }
                          setEditingId(m.id)
                        }}
                        onPointerDown={(e) => onMoteDown(e, m)}
                        onPointerMove={onMoteMove}
                        onPointerUp={onMoteUp}
                        onPointerCancel={onMoteUp}
                        title="Tap to edit · press &amp; hold to fling onto a day"
                      >
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
                      <button type="button" className="mote-act mote-task" onClick={() => toTask(m)}>
                        Task
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

          {/* Flinging: the lifted thought follows the finger; drop it on a day. */}
          {fling && (
            <>
              <div className="mind-fling" style={{ left: `${fling.x - fling.ox}px`, top: `${fling.y - fling.oy}px` }}>
                {fling.text || 'Thought'}
              </div>
              <div className="mind-rail" ref={railRef} aria-hidden="true">
                <span className="mind-rail-label">fling onto a day</span>
                <div className="mind-rail-chips">
                  {RAIL.map((r) => (
                    <div key={r.when} data-when={r.when} className={`mind-rail-chip${fling.target === r.when ? ' is-over' : ''}`}>
                      {r.label}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
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
