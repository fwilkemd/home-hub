/* React binding over the module-singleton tasks store (same pattern as the
   calendar + motes hooks): one consistent snapshot, re-render on any mutation,
   no prop-drilling, no StrictMode double-seed. */
import { useSyncExternalStore } from 'react'
import { tasksStore } from './store.js'

export function useTasksStore() {
  const state = useSyncExternalStore(tasksStore.subscribe, tasksStore.getSnapshot, tasksStore.getSnapshot)
  return {
    tasks: state.tasks,
    addTask: tasksStore.addTask,
    updateTask: tasksStore.updateTask,
    toggleComplete: tasksStore.toggleComplete,
    deleteOccurrence: tasksStore.deleteOccurrence,
    deleteSeries: tasksStore.deleteSeries,
    resetAll: tasksStore.resetAll,
  }
}

export default useTasksStore
