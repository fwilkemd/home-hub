# PROGRESS

## Phase 0 — contracts & scaffold (single-threaded)
- [x] Repo scaffold: Vite + TS strict + eslint (engine purity rule) + vitest + Playwright
- [x] `/src/contracts` complete: ids, patient state, waveform params, orders, events, commands, content schemas (zod), runtime boundaries
- [x] Event bus + zustand store bridge + apply-event reducer + session manager
- [x] Fixed-timestep clock (10 Hz, 0/1/8/32× compression), seeded RNG, append-only event log
- [x] Rubric evaluator
- [x] `npm run verify` skeleton (typecheck, lint, unit, smoke) + `npm run handoff` script
- [x] Unit tests: clock, rng, log, schemas, rubric; smoke: boots with zero console errors

## Phase 1 — parallel workstreams
- [x] A: world (room, patient, player controller, interaction, nurse rig) — 24 files, 1 shadow light, <300 draw calls
- [ ] B: engine (physiology, pharmacology, labs, rhythms, scenario runtime, nurse tasks, alarms) + placeholder content — in flight
- [x] C: waveforms + DeviceScreen abstraction + monitor/vent/pump/US screens + CXR painter — 36 unit tests green
- [x] D: EMR shell + HUD + orders pipeline + radial verbal orders + debrief + settings + optional LLM chat

## Phase 2 — vertical slice
- [ ] Walk room → live monitor → Tab → order pressor → nurse hangs it → MAP responds → alarm resolves → basic US view → scenario end → debrief

## Phase 3 — parallel
- [ ] Full ultrasound module (all views, knobs, freeze/save)
- [ ] Procedures framework + CVL / a-line / intubation
- [ ] Audio + alarms (spatialized, SpO2-pitched beep)
- [ ] Vent screen behaviors + lung model integration
- [ ] Nurse polish, scenarios (stable-night, crashing), rubric + debrief polish

## Phase 4 — polish & docs
- [ ] Performance pass (draw calls, one shadow light)
- [ ] Settings + save/load + JSON export
- [ ] README, ARCHITECTURE, CONTENT_AUTHORING, MEDICAL_HANDOFF (generated)
- [ ] Final verify + screenshot gallery
