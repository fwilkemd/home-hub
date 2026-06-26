# CLAUDE.md — Home Hub

> Operating manual. A new session should read **this + PLAYGROUND.md** and
> continue with full context from the repo alone. Keep it true to the code.

## What we're building
A wall-mounted **home hub**: a beautiful, touch-friendly surface that runs
full-screen in a tablet's browser (kiosk mode) on the wall of Forrest & Katie's
apartment.

It is **not a dashboard.** It is a *turning room* (it shows one thing at a time
and dissolves between states) plus a *playground* (you act on it directly — tap,
swipe, press, scribble, drag — and play is the shortest path to the real thing).

**The soul is the STRUCTURE, not the costume.** The novelty is the behavior —
what it withholds, how it composes a moment, how it turns, how music becomes its
light, how you act on it. Build the mechanism, not the mood; the look falls out of
the structure. Never bolt on a style reference.

The tablet is the **face**. Real automations later run through **Home Assistant**
as the brain; the UI talks to it. For now, **everything uses mock data** behind
store interfaces, so it works with no network.

## The shape: two layers (the core model)
- **The ambient face — the "turning room."** Up top. It **withholds** (one thing
  at a time) and **composes** (every frame is a poster). Three poster-states —
  **Now, Music, Day** — dissolve between each other through one always-on,
  music-lit atmosphere. This is where the artistry and restraint live.
- **The legible layer — one tap deeper.** The information-dense things (calendar,
  and **tasks** next). Here **FUNCTION WINS**: build the true, conventional thing
  (a real month/week/day calendar; a real task list) and then dress it *lightly*.
  The contrast between the ambient face and the legible layer is intentional.
- **Katie's simplicity guardrail (non-negotiable in the legible layer):** basic
  function — task CRUD, calendar editing — must **never be obscured by the
  artistry.** Think **Skylight-simple**: obvious, legible, utilitarian, just a
  light skin. Save the drama for the ambient face. If artistry and "can I quickly
  add/check/finish a task" ever conflict in the legible layer, function wins.

## Who it's for (make choices that serve this)
- **Forrest** — medical resident, chaotic night-float schedule. Make his rotation
  and rest windows glanceable.
- **Katie** — drives the visual design; loves music and design; restyles in plain
  language, so keep everything she'd touch centralized and obvious.
- **Both are creative-but-professional adults with ADHD + autism.** A real design
  lens, and the needs partly oppose each other (ADHD wants stimulation/novelty;
  autism wants calm/predictability). **Design for the tension** — see
  **PLAYGROUND.md**. Short version: capture before it evaporates · keep things
  visible (object permanence) · make time *felt* · predictable & consistent
  gestures · forgiving (undo everywhere) · let each person dial their stimulation.
- **Identity colors — Forrest is blue (`#5b8cff`), Katie is pink (`#ff6fae`)** —
  set in `calendarConfig.js`. These are *identity*: they never shift with the
  music. The hub is **shared memory across opposite schedules** (Forrest's night
  float vs Katie's days): anything one person leaves for the other **persists and
  glows until seen** (notes glow "NEW" until tapped). Build new shared things to
  follow that pattern.
- **Current goal:** a demo that *inspires confidence* — genuinely beautiful,
  smooth, and visibly running on the real tablet.

## Hardware target & future architecture
- **Now:** one wall device — **Samsung Galaxy Tab S-series with the S Pen, ~16:10,
  landscape, full-screen kiosk** (e.g. Tab S9, 2560×1600). The stylus matters:
  notes are hand-scribbled with pressure. Authored at a 16:10 logical canvas and
  scaled as one unit, identical across the Galaxy Tab line.
- **Later (noted phase):** **phones as web-app clients on a shared cloud "brain"**
  so the wall tablet + Forrest's phone + Katie's phone all see the same calendar /
  notes / tasks in real time. The stores are already module-singletons behind
  interfaces persisting to versioned `localStorage` — swap that transport for a
  synced backend later without touching the UI. Home Assistant stays the
  automation brain.

## Stack & how to run
- **Vite + React (plain JSX — no TypeScript) + Tailwind CSS.** `lucide-react`
  for the few icons. Self-hosted fonts via `@fontsource` (no network).
- `npm run dev` → http://localhost:5173 · `npm run build` · `npm run preview`.
- **Live:** https://fwilkemd.github.io/home-hub/ (GitHub Pages — see Deploy below).

## Design laws (non-negotiable — the soul is the behavior, not the costume)
1. **Withholding — one thing at a time** (on the ambient face). The room shows ONE
   poster-state at rest. Never clock + schedule + music at once. If you can see
   three kinds of info at once on the face, it's wrong. (Overlap *during* a
   dissolve is fine.)
2. **The turn — it dissolves, it doesn't switch.** States cross-fade *through* the
   shared atmosphere (outgoing leaves first, incoming condenses a beat later, so
   the middle is mostly just light). Weather changing, not a tab switch.
3. **Composition — every frame is a poster.** Asymmetry, one focal point, dramatic
   scale contrast, type as the image. No centered-everything, no even grids.
4. **Music as light — always on.** The whole surface is lit by the now-playing
   album's palette (`--a1/--a2/--a3`): slow-drifting glows + bloom. Changing track
   crossfades the *entire* atmosphere (~1.8s) via `@property <color>` transitions.
   It never turns off and is always gently moving on its own.
5. **Function first in the legible layer.** Build the true, conventional thing,
   then skin it lightly (Katie's guardrail). Aesthetic is downstream of behavior.
6. **Capture is a gesture, not a button.** You create by pressing the surface
   itself — **press-and-hold the empty room to catch a thought**; tap an empty
   day/slot to make an event. Avoid abstract "+ New" as the *primary* path
   (a small chrome affordance is an acceptable light fallback in the legible
   layer, never the main way).
7. **Subtraction discipline.** A new capability should mostly be a **gesture on an
   existing state**, not a new visible surface. We already have three
   poster-states + three reachable layers; enrich those before inventing screens.
   When in doubt, withhold.
8. **Scale as ONE unit.** Everything sizes in **container-query units (cqw/cqh)**
   inside the 16:10 `.stage` (`container-type: size`). Only exceptions: gesture
   thresholds (raw px, by design) and 1px hairlines. Always judge inside 16:10.
9. **Type carries it; minimal icons; no emoji, ever.** Display **Fraunces**
   (restraint — clock, headings), Body **Inter**, tiny labels **Space Mono**. The
   only icons are lucide chevrons/plus/x in the calendar chrome.
10. **Reduced motion respected** + **zero console errors** at the target size,
    every time. Hard gates. `prefers-reduced-motion` freezes drift, makes
    turns/raises instant, drops momentum — and it must still *function*.

## The states & how you navigate them (THE GESTURE MAP)
The room is the hub. Three ambient poster-states + three reachable layers. Exactly
one thing listens to gestures at a time (hard modal ownership via mounted flags).
The grammar is **small and consistent** so nothing conflicts.

**Room — the three poster-states** (`ORDER = ['now','music','day']`):
- **Now** — time is the hero (live clock); date/weather whispered; the one glowing
  thing is the night-float arrival.
- **Music** — the album's world forward: big disc, track as type, color floods.
- **Day** — the schedule as an editorial spread (NOT a list); the important event
  big + glowing.
- **Turn between them:** **tap (→ next)** · horizontal swipe (left = next, right =
  prev) · `←/→/Space/Enter` · **auto-turn every 9s** (`theme.turnMs`). The
  dissolve is `.wall-in` / `.wall-out` over the constant `Atmosphere`. Tracks also
  **auto-advance** (~18–23s) so the light recolors on its own.

**Calendar — the legible layer (pull UP):**
- Open: on the **Day** wall, swipe **up** / `ArrowUp` / tap the "the week ↑"
  handle. Dismiss: swipe **down** from the chrome (or at scroll-top) / `Escape` /
  × / tap the scrim. Rises in, **falls + fades** out.
- While open the room is inert and does **not** auto-turn (the light keeps
  drifting/recoloring), so you drop back onto the Day wall you left.
- Inside: Month / Week / Day / **Tasks**; ‹ Today › ; horizontal swipe =
  prev/next period (in Tasks it steps a day); vertical scrolls the time grid; tap
  empty = create, tap event = edit; four toggleable family calendars; editor sheet
  slides in from the right.
- **Tasks** is the chore list: grouped by person, one-tap check-off, `+`/`n` to
  add, tap a task to edit, delete asks "just this day" vs "delete series". The
  overdue **signal** is the only part that reaches the ambient face — it surfaces
  on the **Now** wall (tap it → opens Tasks; the check there clears the glow).
- **Events have weight** (week/day grid): **long-press a block to lift it**, drag
  to a new time/day, or drag the **bottom grip** to resize; overlaps nudge; an
  **undo** toast follows. Hold-to-lift keeps it disjoint from scroll (immediate
  drag) and tap-to-edit (quick release).

**Catch a thought — motes + the "mind" (press & hold):**
- **Press-and-hold anywhere** in the room (460ms; moving >10px cancels → it was a
  swipe) → the light pools at your finger and a card blooms; type, `Enter`/Catch
  commits, `Esc` cancels. `c` catches from the keyboard. (This is law #6 in the
  flesh — no "+ New".)
- Caught thoughts live in the **"mind"** (quiet cluster, bottom-right, with a
  count — object permanence). Open it → per thought: **Today / Tomorrow / Weekend**
  (files it as a real all-day calendar event), become a **Task**, or **let go**
  (with Undo). Tap a thought to edit; `Escape` closes the mind.
- **Fling a thought onto a day:** **long-press a thought to lift it** (same
  pick-up grammar as a calendar block), then drag it onto the **day rail** that
  appears (Today / Tomorrow / Weekend) → it files to the calendar there.

**Notes — the shared board (pull DOWN):**
- Open: swipe **down** from the top of the room / `ArrowDown` / tap the "notes ↓"
  handle. Dismiss: `Escape` / ×. Drops in from above, lifts back out.
- Pick who's holding the pen (**Forrest** / **Katie**), tap **+**, **scribble with
  the S Pen** (pressure → ink width, stored as scalable vectors) → **Leave it**.
- Notes are **physical**: drag, and **fling** carries momentum and settles
  (reduced-motion: no momentum). Color-coded by author; a note from the *other*
  person **glows "NEW"** until tapped (acknowledge). Two-tap × deletes.

**Gesture grammar / thresholds** (`src/calendar/gestures.js` + the handlers) — and
**why nothing conflicts:**
- Room turn: horizontal swipe > 44px (dx dominates) or tap < 12px.
- Raise (calendar): `RAISE_DY = -72`, vertical dominates by `AXIS_DOMINANCE 1.4`.
- Pull-down (notes): `DISMISS_DY = 72` (the mirror), same dominance.
- Calendar paging: `PERIOD_DX = 56`. Tap: `TAP_MAX = 12`.
- Long-press (catch): 460ms hold, cancelled by >10px move.
- **Distinctness:** only one layer listens at a time (mounted flags); horizontal
  (turn) vs vertical (raise/pull-down) are disjoint by axis dominance; long-press
  is distinct from tap/swipe via the timer + move-cancel. Keep it this way — every
  new gesture must stay disjoint from these.
- **Corner controls** (the **mind** bottom-right, the **mood dial** bottom-left)
  are buttons that **swallow their own pointer events**, so tapping them never also
  turns the room. That's the pattern for any small always-on affordance — and the
  same trick the Now overdue concern uses.

## Architecture & file map
- `src/main.jsx` → `App.jsx` → **`TurningRoom.jsx`** (the orchestrator).
- **`TurningRoom.jsx`** — owns the turn (`idx` / `prevKey` / `turnSeq`), a single
  1s **heartbeat** (clock + track advance/recolor + auto-turn), all room gesture
  routing, and mounts everything. Holds the layer flags (`calMounted`/`calOpen`,
  `notesMounted`/`notesOpen`, `catching`). Each layer uses a **mount-through-exit**
  pattern: a `*Mounted` flag keeps it in the DOM while `*Open=false` plays the exit
  (~380ms), then it unmounts (instant under reduced motion).
- `src/Stage.jsx` — the 16:10 surface; `container-type: size`; sets `--a1/2/3` and
  the `transition` that makes the whole room recolor.
- `src/Atmosphere.jsx` — always-on drifting glows + bloom + grain + vignette.
- `src/states/{Now,Music,Day}.jsx` — the posters. `Day` takes `onRaise`.
- `src/theme.js` — tokens (`screen`, `turnMs`). `src/data/mock.js` — `TRACKS`
  (each with a palette), `TODAY`.
- `src/calendar/` — the legible layer: `dateUtils.js` (pure) · `layoutDay.js`
  (overlap packing + splitAtMidnight) · `select.js` · `seed.js` (relative to
  today) · `store.js` + `useCalendarStore.js` · `calendarConfig.js` (the four
  family calendars + people colors) · `gestures.js` (thresholds + decideCalGesture
  + isRaiseGesture/isPullDownGesture) · `CalendarLayer/Header/MonthView/WeekView/
  DayView/TimeGrid/EventChip/EventEditor.jsx`.
- `src/playground/` — `motesStore.js` + `useMotes.js` · `CatchInput.jsx` ·
  `Mind.jsx` (catch-a-thought) ; `notesStore.js` + `useNotes.js` · `InkCanvas.jsx`
  · `NoteCard.jsx` · `NotesBoard.jsx` (the shared board).
- `src/index.css` — **all** styles + tokens, in fenced sections (stage,
  atmosphere, the turn, the posters, CALENDAR, PLAYGROUND/catch+mind, NOTES).
  `@property --a1/--a2/--a3` registered as `<color>` so they transition. The one
  place to restyle.

## Conventions that keep it consistent
- **Stores** are module singletons (created once outside React, StrictMode-safe),
  exposed via `useSyncExternalStore`. Each: versioned `localStorage`
  (`homehub.calendar.v1`, `homehub.motes.v1`, `homehub.notes.v1`), **every storage
  call try/caught** (a locked kiosk must never throw), 250ms debounced
  write-through + flush on `pagehide`/visibility-hidden. **Bump the version key to
  reset** seeded data. (This shape is also what makes the future cloud-sync swap
  cheap — replace the persistence/transport, keep the UI.)
- **Color roles:** `--a1/--a2/--a3` = the album palette = the *light* (drives the
  recolor; mood/accents). **Family/people colors in `calendarConfig.js` are
  identity — independent of the album palette** (a person's color never shifts
  when the music changes).
- **Reduced motion:** global CSS kills animations; JS disables auto-turn,
  auto-track-advance, and drag momentum; layers snap open/closed.
- **Exit animations** require keeping a layer mounted through its exit (the
  `*Mounted` + `*Open` pattern) — a bare `{flag && <X/>}` would pop.

## What's built (status)
- ✓ **Turning room** — Now / Music / Day, the dissolve-turn, the always-on
  music-lit atmosphere + on-its-own track recolor.
- ✓ **Calendar depth layer** — real Month/Week/Day, overlap layout, overnight
  night-float shifts, all-day row, 4 toggleable family calendars, full
  create/edit/delete, persistence, seeded relative to today. (Hardened by an
  adversarial review.)
- ✓ **Transitions** — raise/fall, view fade, editor slide; backdrop-blur decoupled
  so opening is smooth; reduced-motion safe.
- ✓ **Playground v1 — catch a thought** — press-hold → mote → "mind" → file to the
  calendar / let go (undo).
- ✓ **Notes board** — S Pen scribble notes for each other, draggable with
  momentum, color-coded by author, "new" glow until acknowledged.
- ✓ **Tasks** — the legible layer's chore list (a "Tasks" view beside
  Month/Week/Day): grouped by person (Forrest / Katie / Both / Anyone), one-tap
  check-off, recurring (daily / weekly / specific weekdays) or one-off, timed or
  untimed, full create/edit, and delete with the explicit "just this day" vs
  "delete series" choice (never a silent series-nuke). Persists
  (`homehub.tasks.v1`). A caught thought can become a task from the mind. When a
  timed task slips past its due time unchecked, it surfaces on the **Now** wall as
  the single glowing concern ("Roo · unfed · 5:12") — check it off from anywhere
  to clear it; several overdue shows the most urgent + a quiet "+N more".
- ✓ **Events have weight** — in the calendar week/day grid, **long-press a
  single-day block to lift it** (ghost follows the pointer), drag to a new
  time/day, or drag the **bottom grip** to resize duration; overlapping blocks
  **nudge**; every move/resize offers **undo**. Snaps to 15 min. Disjoint from
  scroll/page/tap (hold-to-lift; grip is a dedicated target). All-day + night-float
  shifts stay edit-only. (`src/calendar/weight.js` + `TimeGrid.jsx`.)
- ✓ **Calm ↔ lively dial** — one control (bottom-left: calm · auto · lively)
  scales the whole room's energy through `--motion` / `--lum` / `--veil` on
  `.stage`: motion speed, glow brightness, vignette/density, and the auto-turn
  cadence. Auto follows time of day; a manual override sticks (`homehub.mood.v1`);
  reduced motion forces calm. The explicit ADHD↔autism dial. (`src/room/*`.)
- ✓ **Deployed** to GitHub Pages, auto-deploys on push to the working branch.

## What's next (in priority order — see PLAYGROUND.md for rationale)
1. **Wire-it-up automations** — drag a thread from a trigger ("Forrest home 7:12")
   to an action ("kitchen → warm", "play Slow Tide"); later real Home Assistant.
2. **Voice capture** — speak a thought into a mote.
- Smaller: calendar `+N more` for stacked all-day events; on-device perf mode (the
  always-on `backdrop-filter` blur is the heaviest thing on weak GPUs).

## Run & deploy
- **GitHub Pages** via `.github/workflows/pages.yml` (builds with `GH_PAGES=true`
  so Vite `base` = `/home-hub/`, then `actions/deploy-pages`). **Auto-deploys on
  push** to the working branch.
- **For a new session:** the workflow triggers on push to
  **`branches: ['claude/turning-room-music-5uxojn']`** only, and the `github-pages`
  environment branch policy is **No restriction**. To deploy from a new branch:
  add it to the workflow's `on.push.branches`, OR run the workflow via
  **workflow_dispatch** for your branch. Pages source = **GitHub Actions**.
- **Judging motion honestly:** headless CI/preview here is software-rendered
  (SwiftShader, ~1–5fps) + captured at 25fps, so recordings *understate*
  smoothness. The faithful test is the live URL on a real GPU. On device: hold it
  **landscape** and turn **Reduce Motion OFF**, or motion is intentionally frozen.

## Working rules (standing)
- **Mock data only**, behind store interfaces, so it works with no network.
- **Persists** (the store pattern above), **reduced-motion safe**, **zero console
  errors** at 16:10 — before anything is "done".
- **Auto-deploy on push** — so verify behavior first (Playwright at the target size
  is the pattern used throughout) before pushing.
- **Subtraction discipline** (law #7): new toys are mostly gestures on existing
  states, not new surfaces.
- **Small, single-purpose components. Commit at every working checkpoint.** Keep
  tokens/colors/fonts/spacing in one place (`index.css` + `theme.js` +
  `calendarConfig.js`). Explain changes in plain language; ask only when genuinely
  ambiguous — the collaborators iterate fast and trust strong, stated defaults.

## For Katie
You should be able to change how this looks and feels just by talking — "warmer,"
"more spacing here," "make the music card bigger," "Katie's notes in coral." Keep
everything you'd want to touch (colors in `index.css` `:root` + `calendarConfig`,
fonts, spacing, the family calendars) in obvious, centralized, well-named places.
And remember the guardrail: in the legible layer (calendar, tasks) **function wins
— keep it Skylight-simple**; the artistry belongs on the ambient face.
