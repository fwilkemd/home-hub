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

## 2. CALM ↔ LIVELY DIAL — the room's mood ✅ DONE

**What shipped**
- One scalar — **energy** (0 calm … 1 lively) — scales the WHOLE room at once via
  three CSS custom properties written on `.stage`: `--motion` (animation-duration
  multiplier — calm slower), `--lum` (glow brightness — calm dimmer), `--veil`
  (vignette — calm closes the frame in). The atmosphere glows/bloom/disc and the
  auto-turn cadence all read them, so calm genuinely slows + dims + sparsens and
  lively energizes — across every state, from one control.
- A quiet **three-stop dial** bottom-left: `calm · auto · lively`, the active stop
  filled with the album's light (the mood recolors with the music). A mood you
  turn, not a settings page. It swallows its own pointer events so turning the
  mood never turns the room.
- **Auto** follows the time of day (calmest overnight ~0.22, brightest midday
  ~0.85). A manual **override sticks** (`homehub.mood.v1`). **Reduced motion
  forces calm** regardless of the dial (and the global CSS already freezes motion).

**Files** — New: `src/room/{energy,moodStore,useMood,MoodDial}.{js,jsx}`.
Edited: `TurningRoom.jsx` (energy → palette vars + turn cadence + dial),
`index.css` (atmosphere reads `--motion/--lum/--veil`; dial styles), docs.

**Verified (Playwright, 1280×800, 9/9 green, 0 console errors)** dial present;
tapping it does NOT turn the room; lively brighter + faster than calm; calm closes
the frame in; manual override persists across reload; reduced-motion forces calm
even with the override set to lively.

---

## 3. EVENTS HAVE WEIGHT — drag / resize / nudge / undo ✅ DONE

**What shipped** (calendar week + day grid)
- **Long-press to lift** a single-day block (300ms) → it gains scale + shadow
  (weight) and a **ghost** follows the pointer; drag to a new time and/or **day**
  (week), drop to reschedule. Snaps to 15 min, clamped inside the day.
- **Resize** by dragging the block's **bottom grip** — changes duration (snap 15,
  min length), clamped to the day.
- **Conflict nudge**: while dragging, any block the lifted event would overlap
  visibly nudges (shake + album-ring).
- **Undo** toast after every move/resize restores the previous start/end
  (forgiving sandbox). Persists through the calendar store.
- **Disjoint by design**: a finger that just slides is a scroll, a quick release
  is tap-to-edit; only a deliberate hold lifts. The grip is a dedicated target.
  Gestures starting on a block don't page the calendar (they stop propagation).
  Gated to single-day timed events — all-day spans and night-float shifts stay
  edit-only.

**Files** — New: `src/calendar/weight.js` (pure geometry/rules). Edited:
`TimeGrid.jsx` (lift/drag/resize/ghost/nudge), `WeekView/DayView.jsx`
(`onReschedule` pass-through), `CalendarLayer.jsx` (reschedule + undo toast),
`index.css`.

**Verified (Playwright, 1280×800, reduced-motion, 19/19 green, 0 console errors)**
pure geometry unit checks; ghost follows the lift; overlapping blocks nudge mid-
drag; drop reschedules (9a–3p → 10:30a–4:30p); undo restores; grip-resize changes
duration (→ 9a–4p) and persists across reload.

---
