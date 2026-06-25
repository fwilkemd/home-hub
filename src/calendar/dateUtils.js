/*
  Dependency-free date math for the calendar layer.

  Function first: this is plain, correct calendar arithmetic — the kind every
  real calendar needs (month grids, week ranges, overlap layout, time math).
  Everything works in LOCAL wall-clock time (the tablet's clock), which is what
  a family calendar on a wall should show. No timezone library, no UTC surprises.

  Events are stored as local ISO-ish strings so they're human-readable in
  storage and stable across reloads:
    timed   -> start/end = "YYYY-MM-DDTHH:MM"
    all-day -> start/end = "YYYY-MM-DD", allDay: true
*/

export const WEEK_STARTS_ON = 0 // 0 = Sunday (US family-calendar default)

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_NARROW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const MS_DAY = 86400000

// ── construction / cloning ───────────────────────────────────────────────────
export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
export function endOfDay(d) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export function addWeeks(d, n) {
  return addDays(d, n * 7)
}
export function addMonths(d, n) {
  const x = new Date(d)
  const day = x.getDate()
  x.setDate(1) // avoid skipping months (e.g. Jan 31 + 1)
  x.setMonth(x.getMonth() + n)
  // clamp to the last valid day of the target month
  const lastDay = daysInMonth(x.getFullYear(), x.getMonth())
  x.setDate(Math.min(day, lastDay))
  return x
}
export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

// ── comparison ───────────────────────────────────────────────────────────────
export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
export function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}
export function isToday(d, now = new Date()) {
  return isSameDay(d, now)
}
export function isWeekend(d) {
  const g = d.getDay()
  return g === 0 || g === 6
}

// ── week / month boundaries ──────────────────────────────────────────────────
export function startOfWeek(d, weekStartsOn = WEEK_STARTS_ON) {
  const x = startOfDay(d)
  const diff = (x.getDay() - weekStartsOn + 7) % 7
  return addDays(x, -diff)
}
export function endOfWeek(d, weekStartsOn = WEEK_STARTS_ON) {
  return endOfDay(addDays(startOfWeek(d, weekStartsOn), 6))
}
export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
export function endOfMonth(d) {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/** 7 Date objects for the week containing `d`. */
export function weekDays(d, weekStartsOn = WEEK_STARTS_ON) {
  const s = startOfWeek(d, weekStartsOn)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

/**
 * 6×7 = 42 Date objects covering the month of `d`, padded with leading/trailing
 * days so the grid is always full and stable (the standard month view).
 */
export function monthGrid(d, weekStartsOn = WEEK_STARTS_ON) {
  const first = startOfMonth(d)
  const gridStart = startOfWeek(first, weekStartsOn)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

/** Whole days between two dates (calendar days, ignoring time). */
export function diffDays(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / MS_DAY)
}

// ── time-of-day math ─────────────────────────────────────────────────────────
export function minutesOfDay(d) {
  return d.getHours() * 60 + d.getMinutes()
}
export function diffMinutes(a, b) {
  return Math.round((b - a) / 60000)
}
export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

// ── parsing / formatting of stored event strings ─────────────────────────────
/** "YYYY-MM-DD" -> local Date at 00:00. */
export function parseDateKey(key) {
  const [y, m, dd] = key.split('-').map(Number)
  return new Date(y, m - 1, dd)
}
/** "YYYY-MM-DDTHH:MM" (or "YYYY-MM-DD") -> local Date. */
export function parseLocal(s) {
  if (!s) return null
  const [datePart, timePart] = s.split('T')
  const [y, m, dd] = datePart.split('-').map(Number)
  if (!timePart) return new Date(y, m - 1, dd)
  const [hh, mi] = timePart.split(':').map(Number)
  return new Date(y, m - 1, dd, hh, mi)
}
/** Date -> "YYYY-MM-DD". */
export function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** Date -> "YYYY-MM-DDTHH:MM". */
export function localStamp(d) {
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── human formatting ─────────────────────────────────────────────────────────
export function formatTime(d, { ampm = true } = {}) {
  let h = d.getHours()
  const m = d.getMinutes()
  if (!ampm) return `${pad(h)}:${pad(m)}`
  const mer = h < 12 ? 'AM' : 'PM'
  h = ((h + 11) % 12) + 1
  return m === 0 ? `${h} ${mer}` : `${h}:${pad(m)} ${mer}`
}
/** Compact form for dense chips: "7", "7:12", "7p". */
export function formatTimeCompact(d) {
  const h = d.getHours()
  const m = d.getMinutes()
  const mer = h < 12 ? 'a' : 'p'
  const h12 = ((h + 11) % 12) + 1
  return m === 0 ? `${h12}${mer}` : `${h12}:${pad(m)}${mer}`
}
/** Gutter label for an hour 0–24: "12 AM", "1", … (kept short). */
export function hourLabel(hour) {
  if (hour === 0 || hour === 24) return '12 AM'
  if (hour === 12) return '12 PM'
  const mer = hour < 12 ? 'AM' : 'PM'
  const h12 = ((hour + 11) % 12) + 1
  return `${h12} ${mer}`
}
export function monthYear(d) {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
export function rangeLabelForWeek(d, weekStartsOn = WEEK_STARTS_ON) {
  const days = weekDays(d, weekStartsOn)
  const a = days[0]
  const b = days[6]
  if (isSameMonth(a, b)) return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`
  if (a.getFullYear() === b.getFullYear())
    return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`
  return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()}, ${a.getFullYear()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`
}
export function dayLabelLong(d) {
  return `${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function pad(n) {
  return String(n).padStart(2, '0')
}
