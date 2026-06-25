/*
  Gesture thresholds + the calendar-mode decision, kept pure and centralized so
  the conflict between "turn the room", "raise the calendar", "page the period",
  "scroll the grid" and "dismiss" is decided in ONE testable place.

  Thresholds are raw client pixels (like the room's existing turn thresholds) —
  intentionally independent of cq scaling so they feel consistent to the hand.
*/
export const GESTURE = {
  RAISE_DY: -72, // pull up this far on the Day wall to raise the calendar
  DISMISS_DY: 72, // pull down this far (from chrome / at scroll top) to drop it
  PERIOD_DX: 56, // horizontal swipe to page prev/next period
  AXIS_DOMINANCE: 1.4, // one axis must beat the other by this factor to commit
  TAP_MAX: 12, // movement under this is a tap, not a drag
}

/**
 * Decide what a finished drag means while the calendar is open.
 * Pure: (dx, dy, startZone, scrollTop) -> 'tap' | 'prev' | 'next' | 'dismiss' | 'none'.
 *
 *  - startZone: 'chrome' if the drag began on the header / grab-handle, else 'body'
 *  - scrollTop: scrollTop of the active scroll body (0 means at the top)
 */
export function decideCalGesture({ dx, dy, startZone, scrollTop = 0 }) {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)

  if (ax < GESTURE.TAP_MAX && ay < GESTURE.TAP_MAX) return 'tap'

  // Horizontal-dominant → page the period.
  if (ax > GESTURE.PERIOD_DX && ax > ay * GESTURE.AXIS_DOMINANCE) {
    return dx < 0 ? 'next' : 'prev'
  }

  // Vertical-dominant DOWN → dismiss, but only when it can't be a scroll:
  // from the chrome, or when the grid body is already at the top (overscroll).
  if (dy > GESTURE.DISMISS_DY && ay > ax * GESTURE.AXIS_DOMINANCE) {
    if (startZone === 'chrome' || scrollTop <= 0) return 'dismiss'
  }

  return 'none' // anything else: let the browser scroll the grid body
}

/**
 * Decide whether a finished drag on the Day wall should RAISE the calendar.
 * Pure mirror of the room's existing turn test, but for the vertical axis.
 */
export function isRaiseGesture(dx, dy) {
  return dy < GESTURE.RAISE_DY && Math.abs(dy) > Math.abs(dx) * GESTURE.AXIS_DOMINANCE
}
