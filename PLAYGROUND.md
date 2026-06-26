# PLAYGROUND.md — the playground concept

> The creative direction for Home Hub's interaction model. CLAUDE.md is the
> operating manual (how it works, the gesture map, what's built). This is the
> *why* and the *backlog*. Read both before continuing.

## The thesis
A dashboard makes you **operate** it. A playground you **play with** — and the
move here is making **play the shortest path to function.** The koan we're
building to:

- **Everything is interactive** → you can act from *anywhere*, no menus, no
  "+ New".
- **Even nothing is interactive** → the empty space and the light respond to
  touch (press-and-hold the void → the light pools and becomes a thought), *and*
  there is a real, valued **nothing** to retreat into.
- **Rooted in function first** → every playful gesture is just the fastest way to
  capture / schedule / coordinate / regulate. Play *is* the interface, not
  decoration on one.

Aesthetic is downstream of behavior. Get the behavior right and the look falls
out of it — don't bolt on a style reference.

## Who it's for (this sharpens every decision)
Two creative-but-professional adults — **ADHD + autism**. The needs partly
oppose each other, and **designing for that tension is the whole game.**

- **ADHD:** capture before it evaporates · out of sight = gone (keep it visible) ·
  time-blindness (make time *felt*, not calculated) · novelty keeps you engaged ·
  forgiving of mess.
- **Autism:** predictable & consistent gestures · explicit, literal feedback (no
  hidden state) · control over sensory load · routine you can trust.
- **The clash:** ADHD craves stimulation; autism craves calm. **Don't choose —
  make it a dial each person controls.**

Design principles that follow:
1. Capture before it evaporates — act from anywhere, zero friction.
2. Externalize & keep visible — nothing important hidden in a menu (object
   permanence). (Why the "mind" cluster shows a count and notes stay on the wall.)
3. Make time physical — "how long until" should be felt.
4. Predictable & consistent — one gesture grammar everywhere; explicit feedback;
   discoverable, never surprising; never silently change state.
5. Dial your own stimulation — calm ↔ lively, per person, per time of day.
6. Forgiving sandbox — undo everything; nothing breaks; safe to play.
7. Two hands, one wall — async handoffs for opposite schedules (night float),
   gentle, never nagging.
8. Beautiful enough to want to touch (creative) *and* reliable enough to trust
   (professional).

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
  — Serves: two-hands/one-wall, creative expression, dynamics/weight.

(Navigation + gesture details for both are in CLAUDE.md → "THE GESTURE MAP".)

## The backlog (ideas, with status)
Pick by value × fit × buildability. The dial is the most audience-defining; events
-have-weight rounds out "everything is physical"; voice + fling are quick wins.

- **The calm ↔ lively dial** *(planned — highest leverage)* — one control (auto by
  time + manual override) that scales the whole room's energy: CALM = slow, dim,
  sparse, quiet (autism wind-down / Forrest post-shift); LIVELY = brighter, more
  motion (ADHD novelty). Resolves the core tension and hands each person agency.
- **Events have weight** *(planned)* — pick up / toss calendar blocks to
  reschedule; pinch to stretch duration; conflicts visibly nudge. The calendar
  store already has `moveEvent`; drag-to-move was deferred as the gnarliest
  gesture (competes with scroll/page/dismiss) — build the pure decision helper
  first, like `decideCalGesture`.
- **Voice capture** *(planned, quick)* — speak a thought into a mote (Web Speech
  API), hands-free; great for ADHD. Add as a second input mode in `CatchInput`.
- **Fling a thought onto a day** *(planned, quick)* — throw a caught mote straight
  from the mind onto the calendar (reuse the note momentum + calendar filing).
- **Automations — "wire it up"** *(planned; the brief's Phase-3 idea)* — drag a
  glowing thread from a trigger ("Forrest home 7:12") to an action ("kitchen →
  warm", "play Slow Tide"). Cause→effect by hand; autism-friendly explicitness.
  Later becomes real Home Assistant automations behind a clean interface.
- **Sanctioned nothing — the rest wall** *(idea)* — a state that is *only* the
  breathing light; press-and-hold to co-regulate (light slows to a breath rhythm).
  "Even nothing is interactive," as a decompress/overwhelm reset.
- **Touch-stir the light** *(idea)* — dragging the empty atmosphere bends the glow
  toward your finger; pure ambient play / fidget.

## Watch-outs (don't let the playground hurt the people)
- **Over-stimulation cuts both ways** — too much motion overwhelms (autism) *and*
  distracts from the task (ADHD). Calm default; a motion budget; the dial.
- **"Everything interactive" can wreck predictability** (autism). Keep one
  consistent gesture grammar; explicit feedback; discoverable, never surprising.
- **Toy vs. trust** — never lose a real appointment to a fun gesture. Undo + a
  confirm on the few destructive/important actions. Function-first guardrails.
- **Kill any interaction without a job.** Playful ≠ noisy. Every toy must earn its
  place with a real function.
