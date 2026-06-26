/*
  The mock chore list — a small, real-feeling set that shows every capability at
  a glance: per-person assignment, daily / weekly / specific-weekday recurrence,
  timed vs. untimed, and the signature "Roo · unfed" overdue concern.

  Recurrence is weekday-based (not calendar-dated), so this stays correct on any
  day the hub first opens — no re-anchoring needed. After first run it's persisted
  and edits are sacred; bump STORAGE_KEY in store.js to reset (see the calendar).

  Weekdays: 0 = Sun … 6 = Sat.
*/
export function buildTaskSeed() {
  let n = 0
  const id = () => `seedtask_${String(n++).padStart(2, '0')}`
  const make = (o) => ({
    id: id(),
    assignee: 'anyone',
    dueTime: null,
    recurrence: { type: 'none', days: [] },
    completions: {},
    exceptions: {},
    concern: '',
    createdAt: 0,
    updatedAt: 0,
    ...o,
  })

  return [
    // The signature timed chore — glows "Roo · unfed" on the Now face after 5p.
    make({
      title: 'Feed Roo',
      assignee: 'both',
      dueTime: '17:00',
      recurrence: { type: 'daily', days: [] },
      concern: 'Roo · unfed',
    }),
    // Forrest's evening meds — timed, every day (resident routine).
    make({
      title: 'Evening meds',
      assignee: 'forrest',
      dueTime: '21:00',
      recurrence: { type: 'daily', days: [] },
      concern: 'meds · not taken',
    }),
    // A daily untimed chore shared by both.
    make({ title: 'Tidy the kitchen', assignee: 'both', recurrence: { type: 'daily', days: [] } }),
    // Weekly, one chosen day — trash goes out Sunday night.
    make({ title: 'Trash & recycling out', assignee: 'forrest', recurrence: { type: 'weekly', days: [0] } }),
    // Specific weekdays — Katie waters the plants Mon & Thu.
    make({ title: 'Water the plants', assignee: 'katie', recurrence: { type: 'weekdays', days: [1, 4] } }),
    // A one-off to-do for no one in particular — sits until someone checks it.
    make({ title: 'Call about the heater', assignee: 'anyone', recurrence: { type: 'none', days: [] } }),
  ]
}
