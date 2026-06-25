/*
  Pure selectors that turn the flat event list into what each view needs.
  Kept out of components so the date/overlap logic is testable on its own.
*/
import { dateKey } from './dateUtils.js'
import { splitAtMidnight, layoutDay } from './layoutDay.js'

export function isVisible(ev, visible) {
  return visible ? visible[ev.calendarId] !== false : true
}
export function visibleEvents(events, visible) {
  return events.filter((e) => isVisible(e, visible))
}

// All-day events store start/end as inclusive date keys ("YYYY-MM-DD").
function allDayCoversDay(ev, key) {
  return ev.start <= key && key <= (ev.end || ev.start)
}

export function allDayEventsForDay(events, day, visible) {
  const key = dateKey(day)
  return visibleEvents(events, visible).filter((e) => e.allDay && allDayCoversDay(e, key))
}

/** Timed segments clipped to `day`, packed into overlap columns (for week/day). */
export function timedLayoutForDay(events, day, visible) {
  const key = dateKey(day)
  const segs = []
  for (const e of visibleEvents(events, visible)) {
    if (e.allDay) continue
    for (const s of splitAtMidnight(e)) {
      if (s.dateKey === key) segs.push(s)
    }
  }
  return layoutDay(segs)
}

/** Every event touching `day` (for month cells): all-day / shift first, then by start. */
export function eventsForDayChips(events, day, visible) {
  const key = dateKey(day)
  const out = []
  for (const e of visibleEvents(events, visible)) {
    if (e.allDay) {
      if (allDayCoversDay(e, key)) out.push(e)
    } else if (splitAtMidnight(e).some((s) => s.dateKey === key)) {
      out.push(e)
    }
  }
  return out.sort((a, b) => {
    const ar = a.allDay || a.shift ? 0 : 1
    const br = b.allDay || b.shift ? 0 : 1
    if (ar !== br) return ar - br
    return (a.start || '').localeCompare(b.start || '')
  })
}
