# ARCHITECTURE

Night Float is three worlds glued by one store and one event log:

```
            commands (SimCommand)                    SimEvents (append-only log)
  UI/world ─────────────────────► ENGINE (pure TS) ──────────────────────────────┐
                                    ▲     │ getters: PatientState, WaveformParams,│
                                    │     │ VentWaveParams, alarms, breath phase  │
                              10 Hz tick  ▼                                       ▼
                                  ┌─────────────┐   bridge/apply-event    ┌──────────────┐
                                  │ bridge/     │ ────────────────────►   │ zustand store │
                                  │ session.ts  │   (one reducer)         │ (HubState)    │
                                  └─────────────┘                         └──────────────┘
                                    │        │                                  ▲    ▲
                          per frame │        │ per frame                        │    │ useHub()
                                    ▼        ▼                                  │    │
                              THREE world   device screens (canvas)      world reads   React UI
                              (src/world)   (src/screens)                imperatively  (src/ui)
```

## The three hard boundaries

1. **Engine purity** (`src/engine`, `src/contracts`, `src/data`): no three / react /
   zustand / bridge imports — enforced by eslint `no-restricted-imports`. The engine
   is deterministic given a seed: fixed 10 Hz tick (`engine/clock.ts`), all randomness
   through `engine/rng.ts` forks, all timing in sim-seconds. Tests replay a scenario
   twice and diff the event logs byte-for-byte.

2. **Render reads parameters, never internals.** Screens and world read
   `WaveformParams` / `VentWaveParams` / `PatientState` via engine getters each frame
   and synthesize at render rate (waveform shapes are pure functions in
   `engine/waveforms/`). A shared deterministic `BeatClock` (seeded per scenario)
   keeps the monitor trace, the ultrasound wall motion, and the QRS beep in sync
   without any event traffic.

3. **UI never mutates.** Everything is `dispatch(SimCommand)` → engine validates,
   mutates, emits `SimEvent`s → `bridge/apply-event.ts` reduces them into the store →
   React re-renders. The event log is the single source of truth for the MAR,
   results, flowsheet, debrief timeline and rubric scoring.

## Module map

| Path | Job |
| --- | --- |
| `src/contracts` | Canonical types + zod schemas. Single source of truth; everything imports from here. |
| `src/engine/clock.ts` | Fixed-timestep scheduler, 0/1/8/32× compression, backlog shedding. |
| `src/engine/physiology/` | Organ-system stubs `(state, dt) → deltas` + integrator. Base params live in `PatientState.physiology`; drug effects overlay per tick (never persisted). All `TODO(MEDICAL)`. |
| `src/engine/pharmacology/` | Generic PK/PD: effect-site level per drug, bolus decay + infusion approach, effects as modifiers on named physiology params. Drugs are data. |
| `src/engine/rhythms/` | Rhythm state machine (waveform-level modes + transition hooks). |
| `src/engine/labs/` | Order → turnaround queue → results from a generator registry (`TODO(MEDICAL)`), CXR findings text. |
| `src/engine/scenario/` | Scenario loader/runtime: scripted events (at-time / predicate), end conditions, tutorial tracker, rubric evaluator. |
| `src/engine/alarms.ts` | Alarm state machine: limits → debounce → raise/resolve/silence, auto time-drop. |
| `src/engine/nurse/` | Order-consuming task queue with sim-time phases + station movement; verbal orders. |
| `src/engine/waveforms/` | Pure waveform synths: ECG (sum-of-Gaussians PQRST), pleth, art line, capno, resp, vent curves, BeatClock. |
| `src/engine/params.ts` | `PatientState → WaveformParams` mapping (the medical-fidelity hook, `TODO(MEDICAL)`). |
| `src/world/` | Procedural ICU room, patient rig, first-person controller, raycast interaction, nurse rig, night lighting. Reads engine via `WorldDeps` getters; reports hover/actions back through callbacks. |
| `src/screens/` | Offscreen-canvas device screens (monitor, vent, pumps, ultrasound, CXR painter). Same canvas is a 3D emissive texture and the fullscreen zoom overlay. |
| `src/ui/` | React overlay: menu, HUD, workstation/EMR, radial verbal orders, zoom overlay, settings, debrief. |
| `src/audio/` | Alarm cadences, ambience, vent whoosh, SpO2-pitched QRS beep, auscultation recipes. Subscribes to the bus + reads engine getters. |
| `src/ai/` | Optional LLM dialogue (off by default; tool-constrained to structured verbal orders). |
| `src/bridge/` | store (zustand), typed bus, session manager (owns the EngineHandle + rAF loop), apply-event reducer, test API (`window.__nf`). |
| `src/data/` | CONTENT: scenarios, drugs, lab panels, procedures — zod-validated, medical-pass editable. |

## Frame loop (bridge/session.ts)

One `requestAnimationFrame` loop: `engine.advance(realDt)` (fixed-step inside) →
`world.update` → `screens.updateAll` → `audio.update` → store mirror sync at 5 Hz
(vitals, alarms, waveform params, nurse, procedure) and patient snapshot at 2 Hz.
Canvas layers (world, screens, flowsheet, debrief timeline) never re-render React.

## Determinism & replay

`SimEvent` log + seed reproduce a run. Saves serialize `{patient, log, clock, rng}`.
The debrief screen and rubric engine run entirely off the log, so any exported JSON
can be re-scored offline.
