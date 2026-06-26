/*
  Pure task logic, kept here so it's testable in isolation and the store/UI stay
  dumb. No React, no storage — just "does this task happen on this day?", "is it
  done?", "is it overdue right now?".

  The model is deliberately Skylight-simple:
   - recurrence.type: 'none' | 'daily' | 'weekly' | 'weekdays'
     · none      → a one-off to-do; shows until it's checked.
     · daily     → every day.
     · weekly    → one chosen weekday (days = [d]).
     · weekdays  → a set of chosen weekdays (days = [d, …]).
   - dueTime: 'HH:MM' (24h) for a TIMED task, or null/'' for an untimed to-do.
   - completions: { 'YYYY-MM-DD': true } — checked off for that day.
   - exceptions:  { 'YYYY-MM-DD': true } — "delete just this one" / skipped day.

  Everything is local wall-clock, like the calendar — one home, one clock.
*/
import { dateKey, minutesOfDay, WEEKDAYS_SHORT } from '../calendar/dateUtils.js'

/** Does this task occur on the given day (a Date)? */
export function occursOn(task, date) {
  const key = dateKey(date)
  if (task.exceptions && task.exceptions[key]) return false // skipped / deleted-just-this-one

  const r = task.recurrence || { type: 'none', days: [] }
  if (r.type === 'daily') return true
  if (r.type === 'weekly' || r.type === 'weekdays') return (r.days || []).includes(date.getDay())

  // 'none' — a one-off to-do. It sits in the list until it's done; on the very
  // day it gets checked it still shows (so the check is satisfying), and after
  // that it's gone. Never completed → always shows.
  const comps = task.completions || {}
  const doneKeys = Object.keys(comps)
  if (doneKeys.length === 0) return true
  return !!comps[key]
}

/** Is this task checked off for the given day key ('YYYY-MM-DD')? */
export function isCompleteOn(task, key) {
  return !!(task.completions && task.completions[key])
}

/** A task's due time in minutes-of-day, or null if it's an untimed to-do. */
export function dueMinutes(task) {
  if (!task.dueTime) return null
  const [h, m] = task.dueTime.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

/** Is this timed task past its due time today and still unchecked? */
export function isOverdue(task, now) {
  const due = dueMinutes(task)
  if (due == null) return false // untimed to-dos never "go overdue" on the ambient face
  if (!occursOn(task, now)) return false
  if (isCompleteOn(task, dateKey(now))) return false
  return minutesOfDay(now) > due
}

/**
 * Today's overdue tasks, most-urgent first (earliest due time = most overdue).
 * This is the ONLY thing that touches the ambient Now face.
 * Returns [{ task, due, overdueBy }].
 */
export function overdueList(tasks, now) {
  const mins = minutesOfDay(now)
  return tasks
    .filter((t) => isOverdue(t, now))
    .map((t) => ({ task: t, due: dueMinutes(t), overdueBy: mins - dueMinutes(t) }))
    .sort((a, b) => a.due - b.due)
}

/** A short, legible label for how a task repeats ('' for a one-off). */
export function recurrenceLabel(task) {
  const r = task.recurrence || { type: 'none', days: [] }
  if (r.type === 'daily') return 'Every day'
  if (r.type === 'weekly') {
    const d = (r.days || [])[0]
    return d == null ? 'Weekly' : `Every ${WEEKDAYS_SHORT[d]}`
  }
  if (r.type === 'weekdays') {
    const days = (r.days || []).slice().sort((a, b) => a - b)
    if (days.length === 0) return ''
    if (days.length === 5 && days.every((d) => d >= 1 && d <= 5)) return 'Weekdays'
    if (days.length === 2 && days[0] === 0 && days[1] === 6) return 'Weekends'
    return days.map((d) => WEEKDAYS_SHORT[d]).join(' · ')
  }
  return '' // 'none' — a plain to-do
}

/** 'HH:MM' (24h) → a compact label like '5:00p' / '7a'. */
export function formatDue(dueTime) {
  if (!dueTime) return ''
  const [h, m] = dueTime.split(':').map(Number)
  const mer = h < 12 ? 'a' : 'p'
  const h12 = ((h + 11) % 12) + 1
  return m === 0 ? `${h12}${mer}` : `${h12}:${String(m).padStart(2, '0')}${mer}`
}
