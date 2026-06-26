/*
  The mood store — remembers the calm↔lively dial's position. Tiny module
  singleton on the same versioned-localStorage pattern as the rest, so a chosen
  override STICKS across reloads (a deliberate, trusted setting — autism-friendly).
  'auto' lets the time of day drive it; 'calm'/'lively' hold it.
*/
const STORAGE_KEY = 'homehub.mood.v1'
const VERSION = 1
const MODES = ['auto', 'calm', 'lively']

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== VERSION || !MODES.includes(parsed.mode)) return null
    return { version: VERSION, mode: parsed.mode }
  } catch {
    return null
  }
}

let state = readStored() || { version: VERSION, mode: 'auto' }

const listeners = new Set()
function emit() {
  for (const l of listeners) l()
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* kiosk storage locked — stay in-memory */
  }
}

export const moodStore = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot() {
    return state
  },
  setMode(mode) {
    if (!MODES.includes(mode) || mode === state.mode) return
    state = { ...state, mode }
    persist()
    emit()
  },
}
