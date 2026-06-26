# CLAUDE.md — Home Hub

> This file is the operating manual. A new session should be able to read this +
> PLAYGROUND.md and continue with full context. Keep it true to the code.

## What we're building
A wall-mounted **home hub**: a beautiful, touch-friendly surface that runs
full-screen in a tablet's browser (kiosk mode) on the wall of Forrest & Katie's
apartment. Target device: **Samsung Galaxy Tab (S-series) with the S Pen —
~16:10, landscape** (e.g. Tab S9, 2560×1600). The stylus matters: notes are
hand-scribbled with pressure. Authored at a 16:10 logical canvas and scaled as
one unit, so it stays identical across the Galaxy Tab line.

It is **not a dashboard.** It is a *turning room* (it shows one thing at a time
and dissolves between states) plus a *playground* (you act on it directly — tap,
swipe, press, scribble, drag — and play is the shortest path to the real thing).

The tablet is the **face**. Real automations later run through **Home Assistant**
as the brain; the UI talks to it. For now, **everything uses mock data** behind
store interfaces, so it works with no network.

## Who it's for (make choices that serve this)
- **Forrest** — medical resident, chaotic night-float schedule. Make his rotation
  and rest windows glanceable.
- **Katie** — drives the visual design; loves music and design; restyles in plain
  language, so keep everything she'd touch centralized and obvious.
- **Both are creative-but-professional adults with ADHD + autism.** That is a real
  design lens, and the needs partly oppose each other (ADHD wants
  stimulation/novelty; autism wants calm/predictability). Design for the tension —
  see **PLAYGROUND.md** for the full principles. Short version: capture before it
  evaporates · keep things visible (object permanence) · make time *felt* ·
  predictable & consistent gestures · forgiving (undo everywhere) · let each
  person dial their own stimulation.
- **Current goal:** a demo that *inspires confidence* — genuinely beautiful,
  smooth, and visibly running on the real tablet.

## Stack & how to run
- **Vite + React (plain JSX — no TypeScript) + Tailwind CSS.** `lucide-react`
  for the few icons. Self-hosted fonts via `@fontsource` (no network).
- `npm run dev` → http://localhost:5173 · `npm run build` · `npm run preview`.
- **Live:** https://fwilkemd.github.io/home-hub/ (GitHub Pages — see Deploy below).

## Design laws (non-negotiable — the soul is the behavior, not the costume)
1. **Withholding — one thing at a time.** The room shows ONE poster-state at rest.
   Never clock + schedule + music at once. If you can see three kinds of info at
   once, it's wrong. (Transient overlap *during* a dissolve is fine.)
2. **The turn — it dissolves, it doesn't switch.** States cross-fade *through* the
   shared atmosphere (outgoing leaves first, incoming condenses a beat later, so
   the middle is mostly just light). Weather changing, not a tab switch.
3. **Composition — every frame is a poster.** Asymmetry, one focal point, dramatic
   scale contrast, type as the image. No centered-everything, no even grids.
4. **Music as light — always on.** The whole surface is lit by the now-playing
   album's palette (`--a1/--a2/--a3`): slow-drifting glows + bloom. Changing track
   crossfades the *entire* atmosphere (~1.8s) via `@property <color>` transitions.
   It never turns off and is always gently moving on its own.
5. **Function first (especially the calendar).** For information-dense things,
   build the true, conventional thing (a real month/week/day calendar) and *then*
   skin it to the aesthetic — never the reverse. Aesthetic is downstream of
   behavior; do not bolt on a style reference.
6. **Scale as ONE unit.** Everything sizes in **container-query units (cqw/cqh)**
   inside the 16:10 `.stage` (`container-type: size`). Only exceptions: gesture
   thresholds (raw px, by design) and 1px hairlines. Always judge inside 16:10.
7. **Type carries it; minimal icons; no emoji, ever.** Display **Fraunces**
   (restraint — clock, headings), Body **Inter**, tiny labels **Space Mono**.
   The only icons are lucide chevrons/plus/x in the calendar chrome.
8. **Reduced motion is respected.** `prefers-reduced-motion` freezes all drift,
   makes turns/raises instant, and drops drag momentum. Verify it still functions.
9. **Zero console errors** at the target size, every time. This is a hard gate.

## The states & how you navigate them (THE GESTURE MAP)
The room is the hub. Three ambient poster-states + three reachable layers. Exactly
one thing listens to gestures at a time (hard modal ownership via mounted flags).

**Room — the three poster-states** (`ORDER = ['now','music','day']`):
- **Now** — time is the hero (live clock), date/weather whispered, the one glowing
  thing is the night-float arrival.
- **Music** — the album's world forward: big disc, track as type, color floods.
- **Day** — the schedule as an editorial spread (NOT a list); the important event
  big + glowing.
- **Turn between them:** tap (→ next) · horizontal swipe (left = next, right =
  prev) · `←/→/Space/Enter` · and **auto-turn every 9s** (`theme.turnMs`).
  The dissolve is `.wall-in` / `.wall-out` over the constant `Atmosphere`.
- Tracks also **auto-advance** (~18–23s each) so the light recolors on its own.

**Calendar — the legible layer (pull UP):**
- Open: on the **Day** wall, swipe **up** / `ArrowUp` / tap the "the week ↑"
  handle. Dismiss: swipe **down** from the chrome (or at scroll-top) / `Escape` /
  the × / tap the scrim. Rises in, **falls + fades** out.
- While open: the room is inert and does **not** auto-turn (but the light keeps
  drifting/recoloring), so you drop back onto the Day wall you left.
- Inside: Month / Week / Day; ‹ Today › ; horizontal swipe = prev/next period;
  vertical scrolls the time grid; tap empty = create, tap event = edit; four
  toggleable family calendars; editor sheet slides in from the right.

**Catch a thought — motes (press & hold):**
- **Press-and-hold anywhere** in the room (460ms; moving >10px cancels → it was a
  swipe) → the light pools at your finger and a card blooms; type, `Enter`/Catch
  commits, `Esc` cancels. `c` catches from the keyboard.
- Caught thoughts live in the **"mind"** (quiet cluster, bottom-right, with a
  count — object permanence). Open it → per thought: **Today / Tomorrow / Weekend**
  (files it as a real all-day calendar event) or **let go** (with Undo). Tap a
  thought to edit; `Escape` closes the mind.

**Notes — the shared board (pull DOWN):**
- Open: swipe **down** from the top of the room / `ArrowDown` / tap the "notes ↓"
  handle. Dismiss: `Escape` / ×. Drops in from above, lifts back out.
- Pick who's holding the pen (**Forrest** / **Katie**), tap **+**, **scribble with
  the S Pen** (pressure → ink width, stored as scalable vectors) → **Leave it**.
- Notes are **physical**: drag, and **fling** carries momentum and settles
  (reduced-motion: no momentum). Color-coded by author; a note from the *other*
  person **glows "NEW"** until tapped (acknowledge). Two-tap × deletes.

**Gesture grammar / thresholds** (`src/calendar/gestures.js` + the handlers):
- Room turn: horizontal swipe > 44px (dx dominates) or tap < 12px.
- Raise (calendar): `RAISE_DY = -72`, vertical dominates by `AXIS_DOMINANCE 1.4`.
- Pull-down (notes): `DISMISS_DY = 72` (mirror), same dominance.
- Calendar paging: `PERIOD_DX = 56`. Tap: `TAP_MAX = 12`.
- Long-press (catch): 460ms hold, cancelled by >10px move.
- Conflict resolution: only one layer listens at a time; horizontal-vs-vertical are
  disjoint by dominance; long-press is distinct from tap/swipe via timer +
  move-cancel. Keep it this way.

## Architecture & file map
- `src/main.jsx` → `App.jsx` → **`TurningRoom.jsx`** (the orchestrator).
- **`TurningRoom.jsx`** — owns the turn (`idx` / `prevKey` / `turnSeq`), a single
  1s **heartbeat** (ticks the clock, advances the track + recolor, runs the
  auto-turn), all room gesture routing, and mounts everything. Holds the layer
  flags (`calMounted`/`calOpen`, `notesMounted`/`notesOpen`, `catching`).
  Each layer uses a **mount-through-exit** pattern: a `*Mounted` flag keeps it in
  the DOM while `*Open=false` plays the exit (~380ms), then it unmounts (instant
  under reduced motion).
- `src/Stage.jsx` — the 16:10 surface; `container-type: size`; sets `--a1/2/3` and
  the `transition` that makes the whole room recolor.
- `src/Atmosphere.jsx` — always-on drifting glows + bloom + grain + vignette.
- `src/states/{Now,Music,Day}.jsx` — the posters. `Day` takes `onRaise`.
- `src/theme.js` — tokens (`screen`, `turnMs`). `src/data/mock.js` — `TRACKS`
  (each with a palette), `TODAY`.
- `src/calendar/` — the legible layer:
  `dateUtils.js` (pure, no deps) · `layoutDay.js` (overlap packing +
  splitAtMidnight) · `select.js` (selectors) · `seed.js` (events relative to
  today) · `store.js` + `useCalendarStore.js` · `calendarConfig.js` (the four
  family calendars, people colors) · `gestures.js` (thresholds + decideCalGesture
  + isRaiseGesture/isPullDownGesture) · `CalendarLayer/Header/MonthView/WeekView/
  DayView/TimeGrid/EventChip/EventEditor.jsx`.
- `src/playground/` — the playground:
  `motesStore.js` + `useMotes.js` · `CatchInput.jsx` · `Mind.jsx`
  (catch-a-thought) ; `notesStore.js` + `useNotes.js` · `InkCanvas.jsx` ·
  `NoteCard.jsx` · `NotesBoard.jsx` (the shared board).
- `src/index.css` — **all** styles + tokens, in clearly fenced sections (stage,
  atmosphere, the turn, the three posters, CALENDAR, PLAYGROUND/catch+mind,
  NOTES). `@property --a1/--a2/--a3` are registered as `<color>` so they
  transition. This is the one place to restyle.

## Conventions that keep it consistent
- **Stores** are module singletons (created once outside React, StrictMode-safe),
  exposed via `useSyncExternalStore`. Each: versioned `localStorage`
  (`homehub.calendar.v1`, `homehub.motes.v1`, `homehub.notes.v1`), **every storage
  call try/caught** (a locked kiosk must never throw), 250ms debounced
  write-through + a flush on `pagehide`/visibility-hidden. **Bump the version key
  to reset** seeded data.
- **Color roles:** `--a1/--a2/--a3` = the album palette = the *light* (drives the
  recolor; used for mood/accents). **Family/people colors live in
  `calendarConfig.js` and are identity — independent of the album palette** (a
  person's color never shifts when the music changes).
- **Reduced motion:** global CSS kills animations; JS disables auto-turn,
  auto-track-advance, and drag momentum; layers snap open/closed.
- **Exit animations** require keeping a layer mounted through its exit (the
  `*Mounted` + `*Open` pattern above) — a bare `{flag && <X/>}` would pop.

## What's built (status)
- ✓ **Turning room** — Now / Music / Day, the dissolve-turn, the always-on
  music-lit atmosphere + on-its-own track recolor.
- ✓ **Calendar depth layer** — real Month/Week/Day, overlap layout, overnight
  night-float shifts, all-day row, 4 toggleable family calendars, full
  create/edit/delete, persistence, seeded relative to today. (Hardened by an
  adversarial review.)
- ✓ **Transitions** — raise/fall, view fade, editor slide; backdrop-blur decoupled
  so opening is smooth; reduced-motion safe.
- ✓ **Playground v1 — catch a thought** — press-hold → mote → "mind" → file to
  the calendar / let go (undo).
- ✓ **Notes board** — S Pen scribble notes for each other, draggable with
  momentum, color-coded by author, "new" glow until acknowledged.
- ✓ **Deployed** to GitHub Pages, auto-deploys on push to the working branch.

## What's next (see PLAYGROUND.md for the full backlog + rationale)
- **Events have weight** — pick up / fling calendar blocks to reschedule (calendar
  has a `moveEvent`; drag-to-move was deferred as the gnarliest gesture).
- **Voice capture** — speak a thought into a mote.
- **Fling a thought onto a day** — throw a caught mote straight onto the calendar.
- **The calm ↔ lively dial** — one control that scales the whole room's energy
  (the sensory frame for the ADHD↔autism tension); the highest-leverage next step.
- **Automations ("wire it up")** — drag a thread from a trigger to an action; later
  becomes real Home Assistant automations behind a clean interface.
- Smaller: calendar `+N more` for stacked all-day events; on-device perf mode
  (the always-on `backdrop-filter` blur is the heaviest thing on weak GPUs).

## Run & deploy
- **GitHub Pages** via `.github/workflows/pages.yml` (builds with `GH_PAGES=true`
  so Vite `base` = `/home-hub/`, then `actions/deploy-pages`).
- **Important for a new session:** the workflow triggers on push to
  **`branches: ['claude/turning-room-music-5uxojn']`** only, and the `github-pages`
  environment branch policy was set to **No restriction**. To deploy from a new
  branch: add that branch to the workflow's `on.push.branches`, OR run the workflow
  via **workflow_dispatch** for your branch (the env allows any branch now).
  Pages source = **GitHub Actions** (already enabled by the repo owner).
- **Judging motion honestly:** the headless CI/preview here is software-rendered
  (SwiftShader, ~1–5fps) + captured at 25fps, so recordings *understate*
  smoothness. The faithful test is the live URL on a real GPU. On device: hold it
  **landscape** and turn **Reduce Motion OFF** (iOS/Android), or the motion is
  intentionally frozen.

## Working rules
- Nothing is "done" until it builds and runs with **zero console errors** at 16:10.
- **Small, single-purpose components.** **Commit at every working checkpoint.**
- Keep design tokens / colors / fonts / spacing in **one place** (`index.css` +
  `theme.js` + `calendarConfig.js`).
- Quality floor: scales within the frame, visible keyboard focus, reduced-motion
  respected, no emoji.
- Verify behavior before pushing (Playwright at the target size is the pattern used
  throughout) — pushing auto-deploys.
- Explain changes in plain language. If something's genuinely ambiguous, ask; the
  collaborators iterate fast and trust strong, stated defaults.

## For Katie
You should be able to change how this looks and feels just by talking — "warmer,"
"more spacing here," "make the music card bigger," "Katie's notes in coral." Keep
everything you'd want to touch (colors in `index.css` `:root` + `calendarConfig`,
fonts, spacing, the family calendars) in obvious, centralized, well-named places.
