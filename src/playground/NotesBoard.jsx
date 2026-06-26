/*
  The board — the shared surface Forrest & Katie leave notes on. Pulled down from
  the top of the room (calendar is up, board is down). Pick who's holding the pen,
  tap + to scribble a note, and it lands as a draggable, colour-coded card.
*/
import { useEffect, useState } from 'react'
import { useNotes } from './useNotes.js'
import NoteCard from './NoteCard.jsx'
import InkCanvas from './InkCanvas.jsx'
import { CALENDARS, CALENDAR_BY_ID } from '../calendar/calendarConfig.js'

const PEOPLE = CALENDARS.filter((c) => c.id === 'forrest' || c.id === 'katie')

export default function NotesBoard({ open, onClose }) {
  const { me, notes, setMe, add, move, ack, remove } = useNotes()
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (composing) setComposing(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, composing, onClose])

  const meColor = (CALENDAR_BY_ID[me] || {}).color || '#f7f4ef'

  const saveNote = (strokes) => {
    add({
      author: me,
      strokes,
      x: 24 + Math.random() * 52,
      y: 28 + Math.random() * 40,
      rot: Math.random() * 8 - 4,
      createdAt: Date.now(),
    })
    setComposing(false)
  }

  return (
    <div
      className={`notes-scrim${open ? '' : ' is-closing'}`}
      onPointerDown={(e) => e.target === e.currentTarget && open && onClose()}
    >
      <div className={`notes-panel${open ? '' : ' is-closing'}`} role="dialog" aria-label="Shared notes board">
        <header className="notes-header" data-dismiss-zone>
          <h2 className="notes-title">notes</h2>

          <div className="notes-me" role="group" aria-label="Who's writing">
            {PEOPLE.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`notes-me-pill${me === p.id ? ' is-on' : ''}`}
                style={{ '--chip': p.color }}
                onClick={() => setMe(p.id)}
                aria-pressed={me === p.id}
              >
                <span className="notes-me-dot" />
                {p.name}
              </button>
            ))}
          </div>

          <div className="notes-header-right">
            <button type="button" className="notes-iconbtn" onClick={() => setComposing(true)} aria-label="New note">
              +
            </button>
            <button type="button" className="notes-iconbtn" onClick={onClose} aria-label="Close board">
              ×
            </button>
          </div>
        </header>

        <div className="notes-surface">
          {notes.length === 0 && !composing && (
            <p className="notes-empty">A blank wall. Tap + and scribble something for each other.</p>
          )}
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              me={me}
              color={(CALENDAR_BY_ID[n.author] || {}).color || '#f7f4ef'}
              onMove={move}
              onAck={ack}
              onRemove={remove}
            />
          ))}
        </div>

        {composing && <InkCanvas color={meColor} onSave={saveNote} onCancel={() => setComposing(false)} />}
      </div>
    </div>
  )
}
