# PLAYGROUND.md — the playground concept

> The creative direction for Home Hub's interaction model. **CLAUDE.md** is the
> operating manual (how it works, the gesture map, what's built); this is the
> *why* and the *backlog*. Read both before continuing — together they should let
> a fresh session pick up with full context from the repo alone.

## The thesis
A dashboard makes you **operate** it. A playground you **play with** — and the
move here is making **play the shortest path to function.** The koan we're
building to:

- **Everything is interactive** → you can act from *anywhere*, no menus, no
  "+ New". (You create by pressing the surface itself — see CLAUDE.md law #6,
  "Capture is a gesture, not a button.")
- **Even nothing is interactive** → the empty space and the light respond to
  touch (press-and-hold the void → the light pools and becomes a thought), *and*
  there is a real, valued **nothing** to retreat into.
- **Rooted in function first** → every playful gesture is just the fastest way to
  capture / schedule / coordinate / regulate. Play *is* the interface, not
  decoration on one.

**The soul is the STRUCTURE, not the costume.** Aesthetic is downstream of
behavior — get the mechanism right and the look falls out of it. Never bolt on a
style reference.

## The shape: two layers (the frame everything sits in)
The playground lives across **two layers**, and they have *opposite* jobs. Hold
both in your head before adding anything:

- **The ambient face — the "turning room."** Up top. It **withholds** (one thing
  at a time) and **composes** (every frame is a poster): Now / Music / Day,
  dissolving through one always-on, music-lit atmosphere. This is where the
  artistry, restraint, and play-with-the-void live. Stimulation is *chosen* here,
  never dumped.
- **The legible layer — one tap deeper.** The information-dense things: the
  calendar today, **tasks** next. Here **FUNCTION WINS.** Build the true,
  conventional thing (a real month/week/day calendar; a real task list) and then
  dress it *lightly*. The jump from poster to plain-and-useful is intentional.

### Katie's simplicity guardrail (non-negotiable in the legible layer)
Basic function — task CRUD, calendar editing, checking what's next — must **never
be obscured by the artistry.** Think **Skylight-simple**: obvious, legible,
utilitarian, just a light skin over the real thing. Save the drama for the
ambient face. **If "make it beautiful" and "can I quickly add / check / finish
this" ever fight in the legible layer, function wins.** Every time.

### Subtraction discipline
A new capability should mostly be a **gesture on an existing state**, not a new
visible surface. We already have three poster-states + three reachable layers;
enrich those before inventing screens. Playful ≠ noisy — when in doubt, withhold,
and **kill any interaction without a job.** This is the antidote to "playground"
turning into clutter (which would hurt both people — see watch-outs).

## Who it's for (this sharpens every decision)
Two creative-but-professional adults — **ADHD + autism**. The needs partly
oppose each other, and **designing for that tension is the whole game.**

- **ADHD:** capture before it evaporates · out of sight = gone (keep it visible) ·
  time-blindness (make time *felt*, not calculated) · novelty keeps you engaged ·
  forgiving of mess.
- **Autism:** predictable & consistent gestures · explicit, literal feedback (no
  hidden state) · control over sensory load · routine you can trust.
- **The clash:** ADHD craves stimulation; autism craves calm. **Don't choose —
  make it a dial each person controls** (the calm ↔ lively dial, below).

**Identity & shared memory.** **Forrest is blue (`#5b8cff`), Katie is pink
(`#ff6fae`)** (set in `calendarConfig.js`). These are *identity* — they never
shift with the music. The hub is **shared memory across opposite schedules**
(Forrest's night float vs Katie's days): anything one person leaves for the other
**persists and glows until seen** (a note from the other person glows "NEW" until
tapped). Any new shared thing should follow that pattern — leave it for them,
glow until acknowledged, never nag.

Design principles that follow:
1. Capture before it evaporates — act from anywhere, zero friction, no "+ New".
2. Externalize & keep visible — nothing important hidden in a menu (object
   permanence). (Why the "mind" cluster shows a count and notes stay on the wall.)
3. Make time physical — "how long until" should be felt.
4. Predictable & consistent — one small gesture grammar everywhere; explicit
   feedback; discoverable, never surprising; never silently change state.
5. Dial your own stimulation — calm ↔ lively, per person, per time of day.
6. Forgiving sandbox — undo everything; nothing breaks; safe to play.
7. Two hands, one wall — async handoffs for opposite schedules; glow until seen,
   gentle, never nagging.
8. Beautiful enough to want to touch (creative) *and* reliable enough to trust
   (professional) — and in the legible layer, trust beats beauty (Katie's
   guardrail).

## What's built in the playground
- **Catch a thought (motes).** Press-and-hold anywhere → the music's light pools
  under your finger → a card to type the thought. Caught thoughts live in the
  **"mind"** (always-visible count) and triage into the calendar (Today /
  Tomorrow / Weekend) or get let go (with undo). Files:
  `src/playground/{motesStore,useMotes,CatchInput,Mind}.*`.
  — Serves: capture-before-gone, object permanence, "even nothing is interactive."
- **Notes — the shared board.** Pull down from the top → a shared surface where
  Forrest & Katie **scribble with the S Pen** (pressure → ink width) and leave
  each other **physical, draggable** notes (fling = momentum + settle),
  color-coded by author, with a "NEW" glow until acknowledged. Files:
  `src/playground/{notesStore,useNotes,InkCanvas,NoteCard,NotesBoard}.*`.
  — Serves: two-hands/one-wall shared memory, creative expression, dynamics/weight.
- **Tasks — the legible layer's chore list.** A "Tasks" view beside the calendar's
  Month/Week/Day: grouped by person, one-tap check-off, recurring (daily / weekly /
  specific weekdays) or one-off, timed or untimed, full create/edit, and delete
  with the explicit "just this day" vs "delete series" choice. A caught thought can
  become a task (the mind's fourth triage). The only thing that reaches the ambient
  face is the **overdue concern** on the **Now** wall — the room responding to an
  unmet need ("Roo · unfed · 5:12"), most-urgent-first with a quiet "+N more",
  cleared by checking off from anywhere. Files: `src/tasks/*`
  (`store,useTasksStore,recurrence,seed,tasksConfig`; `TasksView,TaskRow,TaskEditor,
  NowConcern`). — Serves: Katie's Skylight-simple guardrail; keep-it-visible; the
  room reacting only when something is genuinely unmet.

(Navigation + gesture details for all three are in CLAUDE.md → "THE GESTURE MAP".)

## The backlog (ideas, in build order)
Pick by value × fit × buildability, and respect subtraction discipline (prefer a
gesture on an existing state over a new surface).

- **Tasks** *(✓ built — see "What's built")* — the legible layer's chore list,
  Skylight-simple, with the overdue concern surfacing on the Now wall. Both hooks
  shipped: a caught thought can become a task, and it lives as a section in the
  calendar layer (no new standalone screen). Store: `homehub.tasks.v1`.
- **The calm ↔ lively dial** *(planned — the sensory frame; earmarked, not built)*
  — one control (auto by time of day + manual override) that scales the whole
  room's energy: CALM = slow, dim, sparse, quiet (autism wind-down / Forrest
  post-shift); LIVELY = brighter, more motion (ADHD novelty). This is the explicit
  resolution of the core ADHD↔autism tension and hands each person agency — the
  highest-leverage frame once tasks land.
- **Events have weight** *(planned)* — pick up / toss calendar blocks to
  reschedule; pinch to stretch duration; conflicts visibly nudge. The calendar
  store already has `moveEvent`; drag-to-move was deferred as the gnarliest
  gesture (competes with scroll/page/dismiss) — build the pure decision helper
  first, like `decideCalGesture`, and keep it disjoint from the existing grammar.
- **Voice capture** *(planned, quick)* — speak a thought into a mote (Web Speech
  API), hands-free; great for ADHD. Add as a second input mode in `CatchInput`.
- **Fling a thought onto a day** *(planned, quick)* — throw a caught mote straight
  from the mind onto the calendar (reuse the note momentum + calendar filing).
- **Automations — "wire it up"** *(planned; the Phase-3 idea)* — drag a glowing
  thread from a trigger ("Forrest home 7:12") to an action ("kitchen → warm",
  "play Slow Tide"). Cause→effect by hand; autism-friendly explicitness. Later
  becomes real **Home Assistant** automations behind a clean interface.
- **Sanctioned nothing — the rest wall** *(idea)* — a state that is *only* the
  breathing light; press-and-hold to co-regulate (light slows to a breath rhythm).
  "Even nothing is interactive," as a decompress/overwhelm reset.
- **Touch-stir the light** *(idea)* — dragging the empty atmosphere bends the glow
  toward your finger; pure ambient play / fidget.

## A noted later phase: phones as clients on a shared brain
Today it's one wall device (Samsung Galaxy Tab S + S Pen, 16:10, full-screen).
**Later:** Forrest's phone + Katie's phone become **web-app clients on a shared
cloud "brain"** so all three surfaces see the same calendar / notes / tasks in
real time — the natural home for "shared memory across opposite schedules." The
stores are deliberately module-singletons behind interfaces persisting to
versioned `localStorage`; **swap that transport for a synced backend without
touching the UI.** Home Assistant stays the *automation* brain; the sync brain is
a separate, later concern. Build new stores to the same shape so they inherit this.

## Watch-outs (don't let the playground hurt the people)
- **Over-stimulation cuts both ways** — too much motion overwhelms (autism) *and*
  distracts from the task (ADHD). Calm default; a motion budget; the dial.
- **"Everything interactive" can wreck predictability** (autism). Keep one small,
  consistent gesture grammar; explicit feedback; discoverable, never surprising.
  Every new gesture must stay *disjoint* from the existing ones (see CLAUDE.md →
  "Distinctness").
- **Toy vs. trust** — never lose a real appointment or task to a fun gesture. Undo
  + a confirm on the few destructive/important actions. In the legible layer,
  function-first guardrails win (Katie's rule).
- **Kill any interaction without a job.** Playful ≠ noisy. Every toy must earn its
  place with a real function — and prefer enriching an existing state over adding a
  new one (subtraction discipline).
