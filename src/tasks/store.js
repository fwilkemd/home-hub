/*
  The tasks store — the legible layer's chore list. Same module-singleton +
  versioned-localStorage shape as the calendar and motes stores (created ONCE
  outside React, StrictMode-safe, every storage call try/caught so a locked-down
  kiosk degrades to in-memory and never throws, debounced write-through + a flush
  on page hide). That shape is also what makes the future wall⇄phone cloud-sync
  swap cheap: replace the persistence/transport, keep the UI.

  A task carries its own completion + skip history, so the same record syncs to
  every surface and any device can check a day off:
    completions: { 'YYYY-MM-DD': true }   ← checked for that day
    exceptions:  { 'YYYY-MM-DD': true }   ← "delete just this one" / skipped
  updatedAt is stamped on every mutation so a later sync can resolve conflicts
  last-write-wins without any schema change.

  Delete has the recurring nuance built in, explicitly:
    deleteOccurrence(id, key) → one-off: removed; recurring: that day skipped.
    deleteSeries(id)          → the whole task is gone.
  Nothing silently nukes a series.
*/
import { buildTaskSeed } from './seed.js'

const STORAGE_KEY = 'homehub.tasks.v1'
const VERSION = 1

function freshState() {
  return { version: VERSION, tasks: buildTaskSeed() }
}

let seededFresh = false
function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.tasks)) return null
    return { version: VERSION, tasks: parsed.tasks }
  } catch {
    return null
  }
}

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
if (seededFresh) persistNow()

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
  return `task_${Math.random().toString(36).slice(2, 9)}`
}

function now() {
  return Date.now()
}

// Normalize a partial task into a complete, serializable record.
function makeTask(partial) {
  const rec = partial.recurrence || { type: 'none', days: [] }
  return {
    id: genId(),
    title: (partial.title || '').trim() || 'Untitled',
    assignee: partial.assignee || 'anyone', // 'forrest' | 'katie' | 'both' | 'anyone'
    dueTime: partial.dueTime || null, // 'HH:MM' for a timed task, else null
    recurrence: { type: rec.type || 'none', days: rec.days || [] },
    completions: {},
    exceptions: {},
    concern: partial.concern || '', // optional poetic overdue phrasing (seed only)
    createdAt: now(),
    updatedAt: now(),
  }
}

export const tasksStore = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return state
  },

  addTask(partial) {
    const task = makeTask(partial)
    commit({ ...state, tasks: [...state.tasks, task] })
    return task.id
  },

  updateTask(id, patch) {
    commit({
      ...state,
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: now() } : t)),
    })
  },

  // One-tap check-off for a given day key ('YYYY-MM-DD'). Toggles.
  toggleComplete(id, key) {
    commit({
      ...state,
      tasks: state.tasks.map((t) => {
        if (t.id !== id) return t
        const comps = { ...(t.completions || {}) }
        if (comps[key]) delete comps[key]
        else comps[key] = true
        return { ...t, completions: comps, updatedAt: now() }
      }),
    })
  },

  // "Delete just this one." A one-off has no series, so it's simply removed; a
  // recurring task gets that single day skipped (an exception), never the series.
  deleteOccurrence(id, key) {
    const task = state.tasks.find((t) => t.id === id)
    if (!task) return
    if (!task.recurrence || task.recurrence.type === 'none') {
      this.deleteSeries(id)
      return
    }
    commit({
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, exceptions: { ...(t.exceptions || {}), [key]: true }, updatedAt: now() } : t,
      ),
    })
  },

  // "Delete the whole series." The explicit, deliberate one.
  deleteSeries(id) {
    commit({ ...state, tasks: state.tasks.filter((t) => t.id !== id) })
  },

  resetAll() {
    commit(freshState())
  },
}
