/*
  React binding over the module-singleton calendar store. useSyncExternalStore
  gives every component a consistent snapshot and re-renders on any mutation,
  with no prop-drilling and no StrictMode double-seed.
*/
import { useSyncExternalStore } from 'react'
import { calendarStore } from './store.js'

export function useCalendarStore() {
  const state = useSyncExternalStore(
    calendarStore.subscribe,
    calendarStore.getSnapshot,
    calendarStore.getSnapshot,
  )
  return {
    calendars: state.calendars,
    events: state.events,
    visible: state.visible,
    addEvent: calendarStore.addEvent,
    updateEvent: calendarStore.updateEvent,
    removeEvent: calendarStore.removeEvent,
    moveEvent: calendarStore.moveEvent.bind(calendarStore),
    toggleCalendar: calendarStore.toggleCalendar,
    resetAll: calendarStore.resetAll,
  }
}

export default useCalendarStore
