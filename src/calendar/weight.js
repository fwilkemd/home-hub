/*
  Pure geometry + rules for "events have weight" — dragging a calendar block to a
  new time/day and resizing its duration. Kept separate from the grid component so
  the math is testable and the gesture logic lives in one place.

  Distinctness (why this never fights scroll / page / tap, per the gesture laws):
   - MOVE needs a deliberate **long-press to lift** first; a finger that just
     slides is a scroll, a quick release is a tap-to-edit. Only after the lift do
     we capture the pointer and own the drag.
   - RESIZE starts on a dedicated bottom **grip**, which captures immediately.
   - Both are gated to single-day, non-all-day, non-shift events (the night-float
     rotation and multi-day spans stay edit-only).
*/
const DAY_MIN = 1440

export function snap(min, step = 15) {
  return Math.round(min / step) * step
}

/** Vertical pixels dragged → minutes, given the full 24h column height in px. */
export function pxToMin(dyPx, colHeightPx) {
  return colHeightPx ? (dyPx * DAY_MIN) / colHeightPx : 0
}

/** Keep a moved block fully inside the day, preserving its duration. */
export function clampStart(startMin, duration) {
  return Math.max(0, Math.min(DAY_MIN - duration, startMin))
}

/** Keep a resized end after the start (min length) and inside the day. */
export function clampEnd(endMin, startMin, minLen = 15) {
  return Math.max(startMin + minLen, Math.min(DAY_MIN, endMin))
}

/** Which day column the pointer x is over (clamped to the ends). */
export function dayIndexAtX(clientX, colRects) {
  if (!colRects.length) return 0
  for (let i = 0; i < colRects.length; i++) {
    if (clientX >= colRects[i].left && clientX < colRects[i].right) return i
  }
  return clientX < colRects[0].left ? 0 : colRects.length - 1
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

/** Only single-day timed events can be picked up (not all-day, not shifts). */
export function isDraggable(ev) {
  if (!ev || ev.allDay || ev.shift) return false
  return (ev.start || '').slice(0, 10) === (ev.end || '').slice(0, 10)
}

const pad = (n) => String(n).padStart(2, '0')

/** "YYYY-MM-DD" + minutes-of-day → "YYYY-MM-DDTHH:MM". */
export function stampFor(dayKey, min) {
  const m = Math.max(0, Math.min(DAY_MIN, Math.round(min)))
  return `${dayKey}T${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export const HOLD_MS = 300 // press-and-hold to lift a block
export const MOVE_CANCEL_PX = 8 // moving more than this before the hold = a scroll
