/*
  The time-grid engine shared by Week (7 columns, 5cqh/hr) and Day (1 column,
  8cqh/hr). This is the part that makes a real day/week view:

  - a sticky day-header strip + an all-day row,
  - a vertically-scrollable 24h grid (default-scrolled to ~6am),
  - timed events absolutely positioned by minute, side-by-side when they overlap
    (via timedLayoutForDay), overnight shifts split across midnight,
  - a now-line on today's column.

  Empty-space tap = create at that 30-min slot; block tap = edit.
*/
import { useLayoutEffect, useRef } from 'react'
import { isToday, minutesOfDay, dateKey, formatTimeCompact, hourLabel, parseLocal, WEEKDAYS_SHORT } from './dateUtils.js'
import { timedLayoutForDay, allDayEventsForDay } from './select.js'
import { CALENDAR_BY_ID } from './calendarConfig.js'

const HOURS = Array.from({ length: 25 }, (_, i) => i) // 0..24 inclusive for the last label

export default function TimeGrid({ days, events, visible, clock, hourCqh = 5, dense = false, onCreate, onPickEvent }) {
  const scrollRef = useRef(null)

  // Open scrolled to the morning (6am) — where a family day actually starts.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = (6 / 24) * el.scrollHeight
  }, [hourCqh, days.length])

  const createAt = (day, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientY - rect.top) / rect.height
    let mins = Math.round((frac * 1440) / 30) * 30
    mins = Math.max(0, Math.min(1410, mins))
    onCreate(day, mins)
  }

  return (
    <div className={`cal-time${dense ? ' is-day' : ''}`} style={{ '--cols': days.length, '--hour': `${hourCqh}cqh` }}>
      <div className="cal-time-head">
        <div className="cal-corner" />
        {days.map((d) => {
          const today = isToday(d, clock)
          return (
            <div key={dateKey(d)} className={`cal-dayhead${today ? ' is-today' : ''}`}>
              <span className="cal-dayhead-dow">{WEEKDAYS_SHORT[d.getDay()]}</span>
              <span className="cal-dayhead-num">{d.getDate()}</span>
            </div>
          )
        })}
      </div>

      <div className="cal-allday">
        <div className="cal-allday-label">all-day</div>
        {days.map((d) => {
          const items = allDayEventsForDay(events, d, visible)
          return (
            <div key={dateKey(d)} className="cal-allday-cell">
              {items.map((ev) => {
                const color = (CALENDAR_BY_ID[ev.calendarId] || {}).color || '#8a8a8a'
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className="cal-allday-chip"
                    style={{ '--chip': color }}
                    onClick={() => onPickEvent(ev)}
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="cal-grid-scroll" data-scroll ref={scrollRef}>
        <div className="cal-grid">
          <div className="cal-gutter">
            {HOURS.map((h) => (
              <span key={h} className="cal-hour-label" style={{ top: `calc(${h} * var(--hour))` }}>
                {h === 0 || h === 24 ? '' : hourLabel(h)}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const blocks = timedLayoutForDay(events, day, visible)
            const today = isToday(day, clock)
            return (
              <div key={dateKey(day)} className="cal-col" onClick={(e) => createAt(day, e)}>
                {blocks.map((seg) => {
                  const ev = seg.event
                  const color = (CALENDAR_BY_ID[ev.calendarId] || {}).color || '#8a8a8a'
                  const top = (seg.startMin / 1440) * 100
                  const height = ((seg.endMin - seg.startMin) / 1440) * 100
                  const widthPct = 100 / seg.colCount
                  return (
                    <button
                      key={ev.id + seg.dateKey + seg.startMin}
                      type="button"
                      className={
                        'cal-block' +
                        (ev.shift ? ' is-shift' : '') +
                        (seg.continuesBefore ? ' is-cont-top' : '') +
                        (seg.continuesAfter ? ' is-cont-bottom' : '')
                      }
                      style={{
                        '--chip': color,
                        top: `${top}%`,
                        height: `${height}%`,
                        left: `calc(${seg.colIndex * widthPct}% + 0.2cqw)`,
                        width: `calc(${widthPct}% - 0.5cqw)`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onPickEvent(ev)
                      }}
                      title={ev.title}
                    >
                      <span className="cal-block-title">{ev.title}</span>
                      <span className="cal-block-time">{timeRange(ev)}</span>
                      {dense && ev.note ? <span className="cal-block-note">{ev.note}</span> : null}
                    </button>
                  )
                })}

                {today ? (
                  <div className="cal-nowline" style={{ top: `${(minutesOfDay(clock) / 1440) * 100}%` }}>
                    <span className="cal-nowdot" />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function timeRange(ev) {
  return `${formatTimeCompact(parseLocal(ev.start))}–${formatTimeCompact(parseLocal(ev.end))}`
}
