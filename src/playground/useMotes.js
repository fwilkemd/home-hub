/* React binding over the module-singleton motes store. */
import { useSyncExternalStore } from 'react'
import { motesStore } from './motesStore.js'

export function useMotes() {
  const state = useSyncExternalStore(motesStore.subscribe, motesStore.getSnapshot, motesStore.getSnapshot)
  return {
    motes: state.motes,
    add: motesStore.add,
    update: motesStore.update,
    remove: motesStore.remove,
    restore: motesStore.restore,
  }
}

export default useMotes
