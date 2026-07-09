# ICU VR Simulator

A WebXR ICU training simulator for Meta Quest 2, running in the Meta Quest
Browser. This codebase is the **engine only** — all clinical content
(scenarios, drugs, deterioration logic) is authored separately as JSON under
`/content/` (see `content/README.md` for the authoring handoff). The bundled
demo scenarios use deliberately nonsensical placeholder values.

**Status: v1 complete (M1–M5).** One patient, one room, one scenario at a
time.

## What it does

- **Scenario picker** (flat DOM page) → low-poly ICU bay in VR or flat on
  desktop (pointer-lock mouse look + WASD; click = trigger).
- **Live patient monitor**: sweep-drawn ECG / pleth / resp on one canvas
  texture; parametric rhythms (`sinus`, `afib`, `svt`, `vt`, `vf`,
  `asystole`); 1 Hz numerics; scenario-defined alarms with flashing numerics,
  a positional beep at the monitor, and a 2-minute silence button. NIBP
  cycling mode when the scenario sets `arterialLine: false`.
- **Order panel** on the bedside tablet (tap to enlarge): tabs generated from
  the catalog's categories, tag-gated orders greyed out with the missing
  requirement shown, nurse busy-time delays, running infusions with stop
  buttons. Effects are summed piecewise-linear envelopes that visibly move
  the vitals.
- **Chart panel** (patient info, resulted labs/imaging, order history) and
  **message feed** (newest on top, chime + brief head-locked toast).
- **Exam by pointing**: click a body region for the scenario's
  first-matching finding; events can reveal new findings.
- **Events, endpoints, time limit** from the scenario file; when the run
  ends, the XR session closes into a **debrief page**: outcome, vitals chart,
  interleaved action timeline, and a session-log JSON export designed to be
  handed back to the content-authoring workflow.
- **Locomotion**: teleport (push thumbstick forward, release to jump) + 30°
  snap turn. Everything is also reachable standing beside the bed.
- **Debug panel** (long-press the wall clock, or backtick on desktop):
  pause, 1×/10×/60× time scale, raw variable dump.

## Architecture

```
/src/sim     Pure simulation core. No three.js. Runs headless in Node.
/content     JSON data files, owned by the content author (see content/README.md).
/schema      Exported JSON Schemas for the content author (npm run schema:export).
/src/app     Presentation: three.js scene, XR session, monitor, panels, audio.
/src/cli     Headless tools: validate, simulate, schema export.
```

Data flow: content JSON → zod validation → sim core (1 Hz fixed-tick state
machine, seeded RNG) → the app reads sim state each frame and renders it. The
app sends exactly one kind of input back: ordered interventions (plus
pause/time-scale for debugging).

## Develop

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # vitest, sim core (27 tests)
npm run typecheck    # app + CLI tsconfigs
npm run build        # typecheck + production build
```

Headless content tools (how scenarios are tested without a headset):

```sh
npm run validate -- content/scenarios/demo-placeholder.json
npm run simulate -- content/scenarios/demo-placeholder.json --seed 5
npm run simulate -- content/scenarios/demo-placeholder.json --actions actions.json --json
npm run schema:export
```

Runs are deterministic for a given seed — a headless `simulate` run matches
the in-app sim exactly.

## Getting builds into the headset

WebXR needs a secure context. Two options:

1. **adb reverse (preferred, needs Quest developer mode):**

   ```sh
   npm run dev
   adb reverse tcp:5173 tcp:5173
   ```

   Open `http://localhost:5173` in the Quest Browser. Localhost counts as a
   secure context and hot reload works.

2. **LAN + HTTPS:**

   ```sh
   npm run dev:host
   ```

   Open `https://<pc-ip>:5173` in the Quest Browser and accept the
   self-signed-certificate warning.

## Deploy

GitHub Pages. `vite.config.ts` sets `base: '/home-hub/'` for production
builds; Pages serves HTTPS, so WebXR works directly from the published URL.

## Performance budget (Quest 2 browser)

72 fps target: static geometry merged per material (~a dozen draw calls for
the room), Lambert/Basic materials only, no shadows or postprocessing, one
dynamic texture (the monitor), troika SDF text regenerated only on content
change, `renderer.xr.setFoveation(1)`.
