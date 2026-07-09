# PROGRESS

## Phase 0 — contracts & scaffold (single-threaded)
- [x] Repo scaffold: Vite + TS strict + eslint (engine purity rule) + vitest + Playwright
- [x] `/src/contracts` complete: ids, patient state (zod), waveform params, orders, events, commands, content schemas, runtime boundaries
- [x] Event bus + zustand store bridge + apply-event reducer + session manager
- [x] Fixed-timestep clock (10 Hz, 0/1/8/32× compression), seeded RNG, append-only event log, rubric evaluator
- [x] `npm run verify` skeleton + `npm run handoff` generator

## Phase 1 — parallel workstreams
- [x] A: world — procedural room, patient rig, pointer-lock controller, raycast interaction, probe snapping, nurse rig, 3am lighting (162 drawables, 1 shadow light)
- [x] B: engine — physiology/PK-PD/labs/rhythms/scenario runtime/alarms/nurse tasks; 6 drugs, 6 lab panels, 3 procedures, 2 scenarios; determinism tests
- [x] C: waveforms (BeatClock + ECG/pleth/art/resp/capno/vent curves) + monitor/vent/pump screens + full ultrasound renderer + CXR painter
- [x] D: EMR workstation (8 tabs), HUD, radial verbal orders, zoom overlay, debrief, settings, optional LLM chat

## Phase 2 — vertical slice (integrated & verified)
- [x] Walk room → live monitor → Tab → order pressor → nurse hangs it → MAP responds → alarm resolves → US view → scenario end → debrief
- [x] Crashing treatment arc regression test (treated succeeds, untreated dies)
- [x] `sustained` predicates gained `graceS` (noise-tolerant stability windows)
- [x] Smoke tour: 5-viewpoint screenshot capture, order→MAR, zero console errors

## Phase 3 — parallel
- [x] Audio: spatialized alarm cadences, SpO2-pitched QRS beep, chimes, room tone, breath-synced vent whoosh, stethoscope recipes (all synthesized, headless-safe)
- [x] Procedures experience: site picker, E-hold gestures with progress ring, auto overlays (procedural US + laryngoscopy screen), sterile-field contamination, smoke spec
- [x] US acceptance harness: 12 views render, differ, and react to scripted finding changes
- [x] Vent acceptance tests: settings change curves; alarms trip and silence
- [x] Save/load: engine serialize/restore, settings Save button, menu Resume card

## Phase 4 — polish & docs
- [x] Debrief smoke spec: timeline + rubric render, JSON export via real download
- [x] README, ARCHITECTURE, CONTENT_AUTHORING, MEDICAL_HANDOFF (generated), DECISIONS
- [x] Screenshot gallery: room tour + EMR + all 12 US views + laryngoscopy + running vent + debrief
- [x] Final `npm run verify` green (typecheck · lint · 76 unit tests · 5 smoke specs)

## SPEC §18 acceptance checklist
- [x] `npm run verify` passes clean; zero console errors enforced in every smoke spec
- [x] Vertical slice demoable end to end (tour spec + crashing-arc test)
- [x] All ultrasound views render and visibly change when USFindings change (us-views spec)
- [x] All three procedures completable start to finish; art line makes the arterial waveform appear (procedures spec; engine wires `art.present` to the aline)
- [x] Vent settings change the lung-model curves and can trigger vent alarms (vent-alarms tests + vent-running screenshot)
- [x] Alarms spatialize/silence/auto-drop time compression (engine tests; audio layer code-reviewed — sound output can't be asserted headless)
- [x] Time compression works; labs return on turnaround delays (clock + labs tests)
- [x] Debrief renders timeline + strip chart and exports JSON (debrief spec)
- [x] Both demo scenarios playable (tour = stable-night; crashing validated treated + untreated)
- [x] MEDICAL_HANDOFF.md complete and generated fresh (`npm run handoff`)
- [x] Screenshot gallery reads "3am ICU" at a glance (screenshots/)
