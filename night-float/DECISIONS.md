# DECISIONS

One-liners for calls the spec left open (SPEC §0).

- **Repo layout:** built in `night-float/` inside the existing `home-hub` repo so the unrelated Home Hub app at the root stays untouched; run everything from `night-float/`.
- **Node/tooling:** Node 22 in this environment (spec floor is 20+); latest stable deps — React 19, three 0.185, zod 4, zustand 5, Vite 7.
- **Playwright browser:** uses the environment's vendored Chromium (`/opt/pw-browsers`) with SwiftShader flags so WebGL smoke tests run headless; config falls back to default resolution elsewhere.
- **zod v4:** content schemas use `z.partialRecord` for zone/view maps (exam/US findings are sparse; engine merges defaults).
- **Event → UI semantics** live in `src/bridge/apply-event.ts` (one reducer), keeping the engine store-free and the UI mutation-free.
- **Engine → app boundary:** the engine emits events via an `onEvent` callback; a small typed bus fans them out to audio/UI. World/screens read live engine getters per frame (no store churn at 60fps).
- **US clip images:** the event log stores media IDs only; dataURLs live in the store (log stays light for export/replay).
- **CXR image:** painted canvas-side (screens layer) via a painter registered with the bridge, since the pure engine cannot touch canvas; engine owns only findings text.
- **Save/load:** engine state snapshot (patient + log + clock + RNG state) rather than full log-replay reconstruction; determinism tests still guard replayability of the sim itself.
- **Nurse pathing:** engine tracks abstract stations + task timing; the world maps stations to positions and animates the walk (no navmesh, per spec).
- **Sim-time units:** all engine timing (lab turnaround, PK, scripts) is sim-seconds, so time compression accelerates everything coherently.
- **M-mode ultrasound:** skipped (explicitly optional in SPEC §8.2) to protect the schedule.
- **Waveforms run on real time** (not sim time): tracings stay physiologic under 8×/32× compression while numerics/alarms/labs follow sim time — matches how the sim is actually read.
- **Beat sync without shared state:** monitor, ultrasound wall motion and the QRS beep each build a `BeatClock(beatSeed)`; beat times are a pure function of seed + params, so instances agree bit-exactly.
- **Probe window quality** uses lateral (along-skin) distance to the view anchor; proximity gate is camera↔patient distance.
- **Stethoscope pickup** lives on the supply cart (no other diegetic source existed); probe/kits can be returned to their holsters.
- **Procedure holds:** the HUD panel's [Complete step] button drives steps standalone (holds render an indeterminate ring); world-gesture holds can layer on later without contract changes.
- **NIBP interval ± buttons dropped** from the monitor zoom (no clean command); Silence + NIBP-now shipped.
