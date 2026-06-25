# CLAUDE.md — Home Hub

## What we're building
A wall-mounted **home hub**: a beautiful, touch-friendly dashboard that runs
full-screen in a tablet's browser (kiosk mode) on the wall of Forrest & Katie's
apartment. Target device: **Amazon Fire HD 10 — 1280×800 logical (16:10),
landscape.**

At a glance it shows:
- Time + date
- A shared calendar, including Forrest's night-float / resident rotation
- Now-playing music, where the **album art recolors the whole screen** (the signature feature)
- Room / smart-home states
- Events that can trigger **automations** (e.g. "Forrest home from night shift" → play a song on the kitchen speaker + warm the lights)

The tablet is the **face**. Real automations later run through **Home Assistant**
as the brain; the UI talks to it. For now, **everything uses mock data.**

## Who it's for (make choices that serve this)
- **Forrest** — a medical resident with a chaotic, shifting schedule. The hub should make his rotation and rest windows glanceable.
- **Katie** — drives the visual design; loves music and design. She will restyle this in plain language, so keep it easy to change.
- **Current goal:** a demo that *inspires confidence*. It must be genuinely beautiful, smooth, and visibly run on the real tablet. Polish and "it runs on the wall" matter more than feature count.

## Stack & how to run
- **Vite + React (plain JSX — no TypeScript) + Tailwind CSS**
- **lucide-react** for all icons
- **git** for version control
- Dev server: `npm run dev`

## Design language
One fully-resolved aesthetic. Restraint over decoration.

**Theme tokens — keep these centralized in ONE place (e.g. `src/theme.js` + CSS variables):**
- Base canvas: deep dimensional charcoal-plum `#141019` (not pure black).
- **Music-driven accents** `--a1 --a2 --a3`: rewritten live from the current album art. This drives the signature recolor.
- Ink: warm white `#F7F4EF`, with dim / faint variants.
- Glass surfaces: low-alpha white, soft blur, hairline border with a subtle top inner-highlight, large soft shadow.

**Type:**
- Display: **Fraunces** (used with restraint — clock, headings)
- Body / UI: **Inter**
- Tiny technical labels: **Space Mono**

**Icons:** lucide-react only. **No emoji as icons, ever.** (Emoji are the #1 thing that makes a UI look unfinished.)

**Motion:** deliberate, smooth, few. View transitions ~400–500ms ease. The album
recolor crossfades over ~1.6s. Respect `prefers-reduced-motion`.

**Signature feature:** the now-playing card themes the whole screen around the
dominant colors of the current album art. With mock data, hardcode a palette per
mock album and transition smoothly between them.

**Critical layout rule:** the entire UI must **scale to the screen as one unit**
(use container-query units / proportional sizing), so it looks identical at any
size. That's what guarantees it looks right on the tablet, not just in a desktop
browser. Always check it inside a 16:10 frame.

## Build order — ONE running checkpoint at a time (do NOT jump ahead)
1. **Phase 1 — One perfect screen.** Tablet device frame (16:10, on a soft wall) + the hub with mock data: clock/date, now-playing (with recolor), a "Today" panel including the "Forrest home — night shift" event, and a room-states row. Running, beautiful, zero errors.
2. **Phase 2 — Calendar.** Tap to expand a full week view; events are tappable.
3. **Phase 3 — Event + automations.** Tap an event → detail panel with an automation builder ("when this happens → do X on a device").
4. **Phase 4 — Make it Katie's.** Clean, centralized tokens + small components so the whole look can be restyled in plain language.
5. **Phase 5 — Real data (later).** Spotify now-playing, the calendar feed, then Home Assistant automations — each behind a clean interface so the UI keeps working offline.

## Working rules (these stop errors from piling up)
- Nothing is "done" until `npm run dev` runs with **zero console errors at 1280×800.**
- **Small, single-purpose components.** One job each.
- **Commit at every working checkpoint**, with a short message.
- **Don't build beyond the current phase.** Ask before adding scope.
- All "real data" stays behind **mock interfaces** so the UI works with no network.
- Keep design tokens in **one place** so colors / type / spacing change in one edit.
- Quality floor every time: responsive within the frame, visible keyboard focus, `prefers-reduced-motion` respected.
- Explain what you changed in plain language. If something's ambiguous, ask before sprawling.

## For Katie
You should be able to change how this looks and feels just by talking — "warmer,"
"more spacing here," "try a different font," "make the music card bigger." So keep
everything you'd want to touch (colors, fonts, spacing, layout) in obvious,
centralized, well-named places.
