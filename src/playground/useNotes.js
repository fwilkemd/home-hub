/* React binding over the module-singleton notes store. */
import { useSyncExternalStore } from 'react'
import { notesStore } from './notesStore.js'

export function useNotes() {
  const state = useSyncExternalStore(notesStore.subscribe, notesStore.getSnapshot, notesStore.getSnapshot)
  return {
    me: state.me,
    notes: state.notes,
    setMe: notesStore.setMe,
    add: notesStore.add,
    move: notesStore.move,
    ack: notesStore.ack,
    remove: notesStore.remove,
  }
}

export default useNotes
