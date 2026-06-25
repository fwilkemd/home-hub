/*
  MONTH — the normal 6×7 month grid (always 42 cells so navigating months never
  reflows the row count). Today gets the album-color ring + accent numeral; other
  months dim; weekends get a faint wash. Up to 3 event chips per cell, then
  "+N more". Tap a cell to create on that day; a chip to edit; the date numeral
  or "+N more" to drop into that Day.
*/
import { monthGrid, isSameMonth, isToday, isWeekend, dateKey, WEEKDAYS_SHORT } from './dateUtils.js'
import { eventsForDayChips } from './select.js'
import EventChip from './EventChip.jsx'

const MAX_CHIPS = 3

export default function MonthView({ cursor, events, visible, onCreate, onPickEvent, onPickDay }) {
  const days = monthGrid(cursor)

  return (
    <div className="cal-month">
      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="cal-monthgrid" role="grid">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor)
          const today = isToday(day)
          const dayEvents = eventsForDayChips(events, day, visible)
          const shown = dayEvents.slice(0, MAX_CHIPS)
          const extra = dayEvents.length - shown.length

          return (
            <div
              key={dateKey(day)}
              role="gridcell"
              className={
                'cal-cell' +
                (inMonth ? '' : ' is-other') +
                (today ? ' is-today' : '') +
                (isWeekend(day) ? ' is-weekend' : '')
              }
              onClick={() => onCreate(day)}
            >
              <button
                type="button"
                className={`cal-daynum${today ? ' is-today' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onPickDay(day)
                }}
                aria-label={`Open ${dateKey(day)}`}
              >
                {day.getDate()}
              </button>

              <div className="cal-cell-events">
                {shown.map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={onPickEvent} />
                ))}
                {extra > 0 && (
                  <button
                    type="button"
                    className="cal-more"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPickDay(day)
                    }}
                  >
                    +{extra} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
