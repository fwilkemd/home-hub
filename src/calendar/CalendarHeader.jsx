/*
  The calendar chrome: title (Fraunces), prev/Today/next, the Month/Week/Day
  switcher, the family-calendar toggle pills, and new/close. The header is a
  `data-dismiss-zone` so a downward drag that starts here drops the calendar
  back into the room (taps on the buttons still register as taps, not drags).

  lucide chevrons/plus/x are the few permitted icons — affordances a real
  calendar needs; everything else is type.
*/
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { monthYear, rangeLabelForWeek, dayLabelLong } from './dateUtils.js'

const VIEWS = [
  ['month', 'Month'],
  ['week', 'Week'],
  ['day', 'Day'],
  ['tasks', 'Tasks'],
]

export default function CalendarHeader({
  view,
  cursor,
  calendars,
  visible,
  onView,
  onPrev,
  onNext,
  onToday,
  onToggleCalendar,
  onNew,
  onClose,
}) {
  const title =
    view === 'month' ? monthYear(cursor) : view === 'week' ? rangeLabelForWeek(cursor) : dayLabelLong(cursor)
  const tasksView = view === 'tasks'

  return (
    <>
      <header className="cal-header" data-dismiss-zone>
        <div className="cal-header-left">
          <h2 className="cal-title">{title}</h2>
          <div className="cal-nav">
            <button type="button" className="cal-navbtn" onClick={onPrev} aria-label="Previous">
              <ChevronLeft strokeWidth={1.75} />
            </button>
            <button type="button" className="cal-today" onClick={onToday}>
              Today
            </button>
            <button type="button" className="cal-navbtn" onClick={onNext} aria-label="Next">
              <ChevronRight strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="cal-views" role="tablist" aria-label="Calendar view">
          {VIEWS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={`cal-viewbtn${view === key ? ' is-active' : ''}`}
              onClick={() => onView(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="cal-header-right">
          <button type="button" className="cal-iconbtn" onClick={onNew} aria-label={tasksView ? 'New task' : 'New event'}>
            <Plus strokeWidth={1.75} />
          </button>
          <button type="button" className="cal-iconbtn" onClick={onClose} aria-label="Close calendar">
            <X strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* The family-calendar toggles only apply to calendar views; the tasks
          section is grouped by person instead, so the strip is absent there.
          (Not rendered rather than [hidden] — a CSS `display:flex` would beat the
          hidden attribute and leave duplicate, focusable controls behind.) */}
      {!tasksView && (
        <div className="cal-cals" role="group" aria-label="Family calendars">
          {calendars.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cal-pill${visible[c.id] ? '' : ' is-off'}`}
              style={{ '--chip': c.color }}
              onClick={() => onToggleCalendar(c.id)}
              aria-pressed={!!visible[c.id]}
            >
              <span className="cal-pill-dot" />
              <span className="cal-pill-name">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
