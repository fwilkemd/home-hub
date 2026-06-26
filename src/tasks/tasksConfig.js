/*
  Who a task belongs to, and how it repeats. Centralized so Katie can edit
  people in ONE place. The people colors are pulled straight from the calendar's
  identity palette (calendarConfig.js) — Forrest blue, Katie pink — so a person
  reads the same whether they're an event or a chore, and NEVER shifts with the
  music. "Both" borrows the Home color; "Anyone" is a quiet neutral.
*/
import { CALENDAR_BY_ID } from '../calendar/calendarConfig.js'

// assignee values stored on a task. 'anyone' = nobody in particular (household).
export const ASSIGNEES = [
  { id: 'forrest', name: 'Forrest', color: CALENDAR_BY_ID.forrest.color },
  { id: 'katie', name: 'Katie', color: CALENDAR_BY_ID.katie.color },
  { id: 'both', name: 'Both', color: CALENDAR_BY_ID.shared.color },
  { id: 'anyone', name: 'Anyone', color: 'rgba(247, 244, 239, 0.5)' },
]

export const ASSIGNEE_BY_ID = Object.fromEntries(ASSIGNEES.map((a) => [a.id, a]))

// The order people-groups appear in the legible list (Skylight-style per-person).
export const GROUP_ORDER = ['forrest', 'katie', 'both', 'anyone']

// Recurrence kinds, in the order the editor offers them. 'none' = a one-off
// to-do that simply sits until it's checked; the others repeat.
export const RECURRENCE = [
  { type: 'none', label: 'Once' },
  { type: 'daily', label: 'Daily' },
  { type: 'weekly', label: 'Weekly' },
  { type: 'weekdays', label: 'Days…' },
]
