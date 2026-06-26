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

## 4. FLING A THOUGHT ONTO A DAY ✅ DONE

**What shipped** — In the mind, **long-press a caught thought to lift it** (same
grammar as picking up a calendar block), then **fling it onto a day** on a rail
that appears mid-drag (Today / Tomorrow / Weekend). Drop → it becomes a real
all-day calendar event on that day, reusing the existing `file()` catch→calendar
pipeline; the thought leaves the mind. Tap still edits; the per-mote day buttons
stay as the tap/keyboard fallback. Consistent, additive (no new standalone surface).

**Files** — `playground/Mind.jsx` (lift/fling + day rail), `index.css`.

**Verified (Playwright, 1280×800, reduced-motion, 9/9 green, 0 console errors)**
catch a thought → it's in the mind → long-press lifts it → rail appears → hovered
day highlights → drop files a real all-day event on Tomorrow → thought leaves the
mind.

---

## 5. VOICE CAPTURE — dictate a thought ✅ DONE

**What shipped** — A **"speak"** affordance on the catch card (`useVoiceCapture`
hook over `SpeechRecognition` / `webkitSpeechRecognition`). Tap it → it listens
(pulsing dot) and fills the field with the live transcript; commit as usual. Fully
**additive + forgiving**: if the API is unavailable the affordance simply isn't
shown and typing works unchanged; every call is try/caught so a denied mic never
throws.

**Files** — New: `playground/useVoiceCapture.js`. Edited: `playground/CatchInput.jsx`,
`index.css`.

**Verified (Playwright, 1280×800, two contexts, 7/7 green, 0 console errors)**
*supported* (a mock recognizer): the "speak" button shows, dictation fills the
field ("water the fern tonight"), the thought commits to the mind. *unsupported*
(API nulled): no "speak" button, typing still catches a thought. NOTE: real
dictation needs a mic + the platform speech service, which the headless CI lacks —
so the engine itself is exercised via a mock; on a real Galaxy Tab the native
engine drives it. Flagged per the batch's "skip-if-unsupported" rule: kept (the
graceful path is proven), but the live mic is unverified here.

---

## 6. CONSISTENCY + POLISH + FULL RE-VERIFY ✅ DONE

- **Authoritative gesture map** written into PLAYGROUND.md ("The authoritative
  gesture map"), covering every surface and the invariants. The grammar unified
  around two shared idioms: **long-press-to-lift** (calendar blocks *and* flinging
  motes) and **corner controls that swallow their own taps** (mind, mood dial, and
  the Now overdue concern).
- **Reduced motion**: every new feature verified to still *function* with motion
  frozen (all suites run under `reducedMotion: 'reduce'`); the dial additionally
  forces calm.
- **Console**: the full-app run captures **errors AND warnings** — zero of either.
- **Persistence**: tasks (`homehub.tasks.v1`), mood (`homehub.mood.v1`), plus the
  existing calendar/motes/notes — all survive reload (spot-checked in the suites).

**Full re-verification (Playwright, 1280×800, reduced-motion, 16/16 green, 0
console errors/warnings)** — one session exercising EVERY feature with no
regressions: the turn (Now/Music/Day) · notes open+close · catch→mind · calendar
create+delete · tasks check-off+create · events-have-weight resize · the mood dial
(reduced-motion forced calm) · fling a thought onto a day (real event created) ·
persistence across reload.

---

## MORNING SUMMARY

**Branch / deploy:** all work is on `claude/turning-room-music-5uxojn` (the real
project), pushed in 6 commits (one per queue item). Pages auto-deploys on push to
this branch → **https://fwilkemd.github.io/home-hub/**.

**Shipped tonight (all verified with Playwright at 1280×800, zero console
errors/warnings, reduced-motion safe, persisted):**
1. **Tasks** — Skylight-simple chores in the legible layer (a "Tasks" view beside
   Month/Week/Day): per-person groups, one-tap check-off, recurring/one-off, timed/
   untimed, delete with explicit "just this day" vs "delete series", and the
   **overdue concern glowing on the Now wall**. A caught thought can become a task.
2. **Calm↔lively dial** — one corner control scaling the whole room's motion, glow,
   and density; auto by time, sticky override, reduced-motion forces calm.
3. **Events have weight** — long-press to lift a calendar block, drag to a new
   time/day, grip-resize, conflict nudge, undo.
4. **Fling a thought onto a day** — long-press a mote, fling it onto a day rail →
   real calendar event.
5. **Voice capture** — dictate a thought on the catch card; graceful fallback.
6. **Consistency pass** — authoritative gesture map; full re-verify.

**States / gestures that changed:** the **Now** wall gained the overdue concern;
the **Day** wall is unchanged but the calendar panel gained a **Tasks** tab and
**weight** (lift/drag/resize) on blocks; the **mind** gained Task triage + fling;
the **catch card** gained a speak button; two new corner controls (mood dial) and
signals (Now concern). New persistence key `homehub.tasks.v1`, `homehub.mood.v1`.

**Skipped / unsure (please review):**
- **Voice — live mic unverified.** The Web Speech path is exercised via a mock
  recognizer in CI (no mic/speech service headless). It should work on the Galaxy
  Tab, but please confirm real dictation on-device.
- **Touch vs. mouse for lift/drag.** Verified with mouse (CI). On a touch device,
  the long-press-lift then `preventDefault` to stop scrolling relies on
  non-passive pointer handlers — worth a quick on-device check that dragging a
  calendar block / flinging a mote doesn't fight the scroll. (Tap, scroll, and
  page-swipe are unaffected.)
- **Automations ("wire it up")** — the remaining backlog item — not attempted
  (the next-biggest feature; out of tonight's scope after 1–5).

**Recommended next step:** do a 5-minute on-device pass on the real Galaxy Tab
(landscape, Reduce Motion OFF) focused on the two touch caveats above — real voice
dictation and drag-vs-scroll — then pick up **wire-it-up automations** as the next
build.

