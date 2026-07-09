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
- **`sustained` predicates take `graceS`:** brief sub-threshold lapses pause (not reset) stability clocks — physiologic noise must not make near-threshold end conditions unreachable.
- **Procedure mirror:** the engine returns one mutable ProcedureRuntime; the bridge fingerprints it and clones only on change so React re-renders exactly when steps advance.
- **Hold gestures:** E-hold progress is world-side (20 Hz to the store); a completed hold disarms until a fresh press so mirror lag can't leak into the next step. Panel buttons remain the accessible path.
- **Sterile field:** gown/glove/drape-ish step completion arms it; contaminating interactions are player world-actions on non-patient targets, once per target. Consequences stay a medical-pass hook.
- **Laryngoscopy good-depth band** (0.62–0.78 ≈ 21.4–23.4 cm at the lips) is a placeholder, tagged.
- **Save/load is slice-level:** patient/log/clock/PK levels/lab queues/alarm identity/script+ramp state/RNG streams restore; in-flight nurse tasks and active procedures do not (saving is blocked mid-procedure); US clip images don't survive (the log stores media ids only); `sustained` accumulators re-arm.
- **Audio autoplay:** the context self-arms one-time gesture listeners to resume; alarms compare `silencedUntil` against sim time.
- **Test surface:** `window.__nf` gained `openZoom`/`openSitePicker`/`engineEnded` + synchronous mirror sync after `advanceSim` — headless frames are ~1 fps under SwiftShader and specs must not race the rAF loop.
