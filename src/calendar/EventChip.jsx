/*
  One event token for the MONTH view (and the all-day row). Color is the event's
  CALENDAR color (people identity), set as an inline --chip var — never the album
  palette. Tap opens the editor; tapping a chip never falls through to "create".
*/
import { CALENDAR_BY_ID } from './calendarConfig.js'
import { parseLocal, formatTimeCompact } from './dateUtils.js'

export default function EventChip({ event, onClick }) {
  const cal = CALENDAR_BY_ID[event.calendarId]
  const color = cal ? cal.color : '#8a8a8a'
  const timed = !event.allDay && !event.shift
  return (
    <button
      type="button"
      className={`cal-chip${event.shift ? ' is-shift' : ''}${event.allDay ? ' is-allday' : ''}`}
      style={{ '--chip': color }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(event)
      }}
      title={event.title}
    >
      {timed && <span className="cal-chip-time">{formatTimeCompact(parseLocal(event.start))}</span>}
      <span className="cal-chip-title">{event.title}</span>
    </button>
  )
}
