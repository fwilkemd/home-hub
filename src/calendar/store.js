/*
  The calendar store — a module singleton created ONCE at import (outside React),
  exposed to components via useSyncExternalStore (see useCalendarStore.js). Living
  outside React makes it immune to StrictMode's double-mount (no double-seed) and
  lets the calendar's view/events survive the layer mounting and unmounting.

  Persistence is a versioned localStorage write-through, debounced, and wrapped in
  try/catch everywhere: on a locked-down kiosk where storage throws, the hub
  degrades to in-memory and NEVER surfaces a console error (a hard requirement).

  Seed policy: seed once relative to today, then NEVER re-anchor — a user's edits
  are sacred. Bumping STORAGE_KEY (v1 → v2) is the clean reset path.
*/
import { CALENDARS } from './calendarConfig.js'
import { buildSeed } from './seed.js'
import { dateKey, startOfDay } from './dateUtils.js'

const STORAGE_KEY = 'homehub.calendar.v1'
const VERSION = 1

const allVisible = () => Object.fromEntries(CALENDARS.map((c) => [c.id, true]))

function freshState() {
  return {
    version: VERSION,
    calendars: CALENDARS,
    events: buildSeed(),
    visible: allVisible(),
    seededOn: dateKey(startOfDay(new Date())),
  }
}

let seededFresh = false

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.events)) return null
    // Always reconcile calendars from config; merge visibility for any new ones.
    return {
      version: VERSION,
      calendars: CALENDARS,
      events: parsed.events,
      visible: { ...allVisible(), ...(parsed.visible || {}) },
      seededOn: parsed.seededOn || dateKey(startOfDay(new Date())),
    }
  } catch {
    return null
  }
}

// state is assigned AFTER the helpers above are defined, so persistNow() can read it safely.
let state = readStored()
if (!state) {
  state = freshState()
  seededFresh = true
}

const listeners = new Set()
function emit() {
  for (const l of listeners) l()
}

let saveTimer = null
function persistNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* kiosk storage locked — stay in-memory, never throw */
  }
}
function persistSoon() {
  try {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(persistNow, 250)
  } catch {
    /* no-op */
  }
}

// Lock in the seed immediately so a reload before any edit still finds it.
if (seededFresh) persistNow()

// Best-effort flush when the tablet backgrounds or reloads, so an edit made in
// the last 250ms (still inside the debounce window) is never lost. Wrapped so a
// locked-down kiosk still never throws.
function flushNow() {
  try {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  } catch {
    /* no-op */
  }
  persistNow()
}
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('pagehide', flushNow)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushNow()
    })
  } catch {
    /* no-op */
  }
}

function commit(next) {
  state = next
  persistSoon()
  emit()
}

function genId() {
  return `evt_${Math.random().toString(36).slice(2, 9)}`
}

// ── public store API ─────────────────────────────────────────────────────────
export const calendarStore = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return state
  },

  addEvent(event) {
    const ev = { id: genId(), allDay: false, important: false, shift: false, note: '', kind: 'home', ...event }
    commit({ ...state, events: [...state.events, ev] })
    return ev.id
  },
  updateEvent(id, patch) {
    commit({ ...state, events: state.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  },
  removeEvent(id) {
    commit({ ...state, events: state.events.filter((e) => e.id !== id) })
  },
  moveEvent(id, start, end) {
    this.updateEvent(id, { start, end })
  },
  toggleCalendar(calId) {
    commit({ ...state, visible: { ...state.visible, [calId]: !state.visible[calId] } })
  },
  resetAll() {
    commit(freshState())
  },
}
