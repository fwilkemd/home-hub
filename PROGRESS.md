# Overnight batch — progress log

Branch: `claude/turning-room-music-5uxojn` (the real project — confirmed). Mock
data only. Verifying each task with Playwright at 1280×800, reduced-motion for
determinism, zero console errors required before commit + push.

---

## 1. TASKS — Skylight-simple chores + overdue concern on Now ✅ DONE

**What shipped**
- A **Tasks view** in the legible layer — a fourth tab beside Month/Week/Day in
  the calendar panel (a section *near* the calendar, not a new surface; honors
  subtraction discipline). Reached the same way as the calendar (pull up on Day →
  the panel → Tasks), and directly from the Now overdue concern.
- **Per-person grouping**, type-led not boxes: Forrest / Katie / Both / Anyone,
  each a heading in that person's identity color (from `calendarConfig`, never
  music-driven). One-line tasks, big round one-tap check, due time + repeat label.
- **Create / assign / recur / edit / check off**, all a couple of taps:
  assignee chips, repeat = Once / Daily / Weekly / Days (weekday picker), optional
  due time. Skylight-fast.
- **Delete with the recurring nuance, explicit**: a one-off gets a single
  "Delete?"; a recurring task gets two labelled choices — "Just this day"
  (skips that occurrence) vs "Delete series". Never a silent series-nuke.
- **Overdue on the ambient Now wall**: when a timed task passes its due time
  unchecked, it replaces the "next" glow as the single bright concern
  ("Roo · unfed · 5:12"), most-urgent first with a quiet "+N more". Tap → opens
  Tasks; the "done" check there (or anywhere) clears the glow. Only overdue
  touches the ambient face — never the full list.
- **Caught thought → task**: the mind gains a fourth triage action, "Task".
- **Persistence**: `homehub.tasks.v1`, same module-singleton + versioned
  localStorage + try/caught + debounce/flush pattern as calendar/motes/notes —
  so the future wall⇄phone cloud sync gets it for free (per-task `updatedAt`
  stamped for last-write-wins).

**Files**
- New: `src/tasks/{tasksConfig,recurrence,store,useTasksStore,seed,TasksView,
  TaskRow,TaskEditor,NowConcern}.{js,jsx}`
- Edited: `calendar/CalendarLayer.jsx`, `calendar/CalendarHeader.jsx`,
  `states/Now.jsx`, `TurningRoom.jsx`, `playground/Mind.jsx`, `index.css`,
  `CLAUDE.md`, `PLAYGROUND.md`.

**Verified (Playwright, 1280×800, reduced-motion, 20/20 green, 0 console errors)**
create recurring → assign Katie → it appears → reads overdue in list → glows on
Now → check off from Now clears the glow → Now returns to the next-event glow →
delete "just this day" (gone today, back tomorrow) → delete "whole series" (gone
today + tomorrow) → both survive a reload. Plus: pure recurrence logic unit-tested
(31/31). Decisions/notes: the family-calendar pill strip is *not rendered* in the
Tasks view (a CSS `display:flex` beat the `hidden` attribute); overdue verification
creates a task due a few minutes ago so it's deterministic regardless of wall-clock
(seed "Feed Roo" only naturally glows after 5pm).

---
