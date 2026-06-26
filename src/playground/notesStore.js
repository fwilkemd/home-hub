/*
  Notes — the shared board for two. Handwritten (S Pen) or finger-drawn cards that
  Forrest and Katie leave for each other, draggable like physical sticky notes.

  Same module-singleton + versioned-localStorage pattern as the other stores
  (StrictMode-safe, every write try/caught, debounced, flushed on page hide).

  Shapes:
    me     : 'forrest' | 'katie'  (whose hand is on the pen right now)
    note   : { id, author, strokes, x, y, rot, createdAt, ack }
      strokes : [ { w, pts: [[x,y], ...] } ]   x,y in 0..1000 (svg viewBox units)
      x, y    : board position as % (0..100) so it scales with the screen
      rot     : a few degrees of tilt, for the physical-note feel
      ack     : has the *other* person seen it yet
*/
const STORAGE_KEY = 'homehub.notes.v1'
const VERSION = 1

function freshState() {
  return { version: VERSION, me: 'forrest', notes: [] }
}

let seededFresh = false
function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p || p.version !== VERSION || !Array.isArray(p.notes)) return null
    return { version: VERSION, me: p.me === 'katie' ? 'katie' : 'forrest', notes: p.notes }
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
  return `note_${Math.random().toString(36).slice(2, 9)}`
}

export const notesStore = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return state
  },
  setMe(me) {
    commit({ ...state, me: me === 'katie' ? 'katie' : 'forrest' })
  },
  add(note) {
    const full = {
      id: genId(),
      author: note.author || state.me,
      strokes: note.strokes || [],
      x: note.x ?? 40,
      y: note.y ?? 30,
      rot: note.rot ?? 0,
      createdAt: note.createdAt || 0,
      ack: false,
    }
    commit({ ...state, notes: [...state.notes, full] })
    return full.id
  },
  move(id, x, y) {
    commit({ ...state, notes: state.notes.map((n) => (n.id === id ? { ...n, x, y } : n)) })
  },
  ack(id) {
    commit({ ...state, notes: state.notes.map((n) => (n.id === id ? { ...n, ack: true } : n)) })
  },
  remove(id) {
    commit({ ...state, notes: state.notes.filter((n) => n.id !== id) })
  },
}
