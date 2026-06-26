/* React binding over the module-singleton mood store. */
import { useSyncExternalStore } from 'react'
import { moodStore } from './moodStore.js'

export function useMood() {
  const state = useSyncExternalStore(moodStore.subscribe, moodStore.getSnapshot, moodStore.getSnapshot)
  return { mode: state.mode, setMode: moodStore.setMode }
}

export default useMood
