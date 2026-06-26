/*
  Caught thoughts ("motes") — the ADHD capture buffer. A thought you press out of
  the air lands here so it can't evaporate, stays visible (object permanence), and
  gets triaged later into the calendar or let go.

  Same module-singleton + versioned-localStorage pattern as the calendar store:
  created once outside React (StrictMode-safe), every write try/caught so a
  locked-down kiosk degrades to in-memory and never throws, debounced write-through
  plus a flush on page hide so a thought caught a moment before a reload survives.
*/
const STORAGE_KEY = 'homehub.motes.v1'
const VERSION = 1

function freshState() {
  return { version: VERSION, motes: [] }
}

let seededFresh = false
function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.motes)) return null
    return { version: VERSION, motes: parsed.motes }
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
    /* kiosk storage locked — stay in-memory */
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
  return `mote_${Math.random().toString(36).slice(2, 9)}`
}

export const motesStore = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return state
  },
  add(text, stampMs) {
    const mote = { id: genId(), text: (text || '').trim(), createdAt: stampMs || 0 }
    commit({ ...state, motes: [mote, ...state.motes] })
    return mote.id
  },
  update(id, text) {
    commit({ ...state, motes: state.motes.map((m) => (m.id === id ? { ...m, text } : m)) })
  },
  remove(id) {
    commit({ ...state, motes: state.motes.filter((m) => m.id !== id) })
  },
  restore(mote) {
    // put a let-go mote back (for undo)
    if (!mote) return
    commit({ ...state, motes: [mote, ...state.motes.filter((m) => m.id !== mote.id)] })
  },
  clear() {
    commit({ ...state, motes: [] })
  },
}
